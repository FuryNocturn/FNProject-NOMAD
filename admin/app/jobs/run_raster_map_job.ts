import { Job, UnrecoverableError } from 'bullmq'
import axios from 'axios'
import { createHash } from 'node:crypto'
import { statfs, unlink } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import logger from '@adonisjs/core/services/logger'
import { QueueService } from '#services/queue_service'
import { RunExtractPmtilesJob } from './run_extract_pmtiles_job.js'
import { DownloadProgressData } from '../../types/downloads.js'
import { ssrfSafeRequestOptions } from '../validators/common.js'
import { deleteFileIfExists } from '../utils/fs.js'
import { convertRasterMbtilesToPmtiles } from '#services/raster_pmtiles_converter'
import { upsertMapArchive } from '../utils/map_archive_manifest.js'
import {
  AVERAGE_TILE_BYTES,
  type Bbox,
  countTiles,
  getRasterProvider,
  tileRange,
  tileUrl,
  xyzRowToTms,
} from '../utils/raster_tiles.js'

export interface RunRasterMapJobParams {
  /** Provider tile template, shown in the downloads list */
  sourceUrl: string
  /** Final .pmtiles path in the maps folder */
  outputFilepath: string
  filetype: 'map'
  title: string
  providerId: string
  regionId: string
  bbox: Bbox
  minzoom: number
  maxzoom: number
  estimatedBytes: number
}

const CONCURRENCY = 6
// Tile servers return the odd 502 under load; one bad tile should not fail
// the whole attempt (1+2+4+8 s of backoff before giving up)
const TILE_RETRIES = 5

/**
 * Builds an offline aerial/topographic map (#1175): fetches a provider's XYZ
 * tiles for a box into an MBTiles file, then converts it to PMTiles and
 * registers it in the map archive manifest so the map can show it as a raster
 * layer. Runs on the pmtiles-extract queue and reuses its job shape
 * (sourceUrl/outputFilepath/title) and cancel key, so the downloads list and
 * its Cancel button work unchanged. Re-running resumes: tiles already in the
 * MBTiles file are skipped.
 */
export class RunRasterMapJob {
  static get queue() {
    return RunExtractPmtilesJob.queue
  }

  static get key() {
    return 'run-raster-map'
  }

  static getJobId(params: Pick<RunRasterMapJobParams, 'providerId' | 'regionId' | 'maxzoom'>) {
    return createHash('sha256')
      .update(`raster:${params.providerId}:${params.regionId}:${params.maxzoom}`)
      .digest('hex')
      .slice(0, 16)
  }

  async handle(job: Job) {
    const params = job.data as RunRasterMapJobParams
    const provider = getRasterProvider(params.providerId)
    if (!provider) throw new UnrecoverableError(`Unknown raster provider ${params.providerId}`)

    const mbtilesPath = params.outputFilepath.replace(/\.pmtiles$/, '.mbtiles')
    const total = countTiles(params.bbox, params.minzoom, params.maxzoom)

    // MBTiles + the converted PMTiles exist side by side for a moment
    const free = await statfs(dirname(params.outputFilepath))
      .then((s) => Number(s.bavail) * Number(s.bsize))
      .catch(() => null)
    if (free !== null && free < params.estimatedBytes * 2) {
      throw new UnrecoverableError(
        `Not enough free space: about ${Math.ceil((params.estimatedBytes * 2) / 1e9)} GB needed`
      )
    }

    const cancelRedis = await QueueService.getInstance().getQueue(RunRasterMapJob.queue).client
    let cancelled = false
    const cancelPoll = setInterval(async () => {
      try {
        if (await cancelRedis.get(RunExtractPmtilesJob.cancelKey(job.id!))) {
          await cancelRedis.del(RunExtractPmtilesJob.cancelKey(job.id!))
          cancelled = true
        }
      } catch {
        // Redis hiccup: the next tick tries again
      }
    }, 2000)

    const db = new DatabaseSync(mbtilesPath)
    let dbOpen = true
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB);
        CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row);
      `)
      const has = db.prepare(
        'SELECT 1 FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
      )
      const insert = db.prepare(
        'INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)'
      )

      let done = 0
      let bytes = 0
      let format: 'jpg' | 'png' | null = null
      let lastReport = 0
      const report = async (force = false) => {
        if (!force && Date.now() - lastReport < 2000) return
        lastReport = Date.now()
        try {
          await job.updateProgress({
            percent: Math.min(99, Math.floor((done / total) * 100)),
            downloadedBytes: bytes,
            totalBytes: Math.max(params.estimatedBytes, bytes),
            lastProgressTime: Date.now(),
          } as DownloadProgressData)
        } catch (err: any) {
          if (err?.code !== -1) throw err
        }
      }

      const fetchTile = async (z: number, x: number, y: number): Promise<Buffer | null> => {
        for (let attempt = 1; ; attempt++) {
          try {
            const res = await axios.get(tileUrl(provider, z, x, y), {
              ...ssrfSafeRequestOptions,
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: { 'User-Agent': 'ProjectNOMAD/1.0 (+https://projectnomad.us)' },
              validateStatus: (s) => s === 200 || s === 204 || s === 404,
            })
            if (res.status !== 200) return null // no imagery there (sea, outside coverage)
            return Buffer.from(res.data)
          } catch (error) {
            if (attempt >= TILE_RETRIES) throw error
            await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
          }
        }
      }

      for (let z = params.minzoom; z <= params.maxzoom; z++) {
        const r = tileRange(params.bbox, z)
        const queue: Array<[number, number]> = []
        for (let x = r.minX; x <= r.maxX; x++) {
          for (let y = r.minY; y <= r.maxY; y++) queue.push([x, y])
        }
        const worker = async () => {
          for (let next = queue.pop(); next; next = queue.pop()) {
            if (cancelled) return
            const [x, y] = next
            const row = xyzRowToTms(y, z)
            if (!has.get(z, x, row)) {
              const data = await fetchTile(z, x, y)
              if (data) {
                // JPEG starts FF D8; anything else these providers send is PNG
                format ??= data[0] === 0xff && data[1] === 0xd8 ? 'jpg' : 'png'
                insert.run(z, x, row, data)
                bytes += data.length
              }
            }
            done++
            await report()
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, worker))
        if (cancelled) throw new UnrecoverableError('Raster map download cancelled by user')
      }

      const meta = db.prepare('INSERT OR REPLACE INTO metadata (name, value) VALUES (?, ?)')
      for (const [name, value] of Object.entries({
        name: params.title,
        format: format ?? 'jpg',
        type: 'baselayer',
        version: '1',
        bounds: params.bbox.join(','),
        minzoom: String(params.minzoom),
        maxzoom: String(params.maxzoom),
        attribution: provider.attribution,
      })) {
        meta.run(name, value)
      }
      db.close()
      dbOpen = false

      // Replacing an earlier download of the same region
      await deleteFileIfExists(params.outputFilepath)
      const { archive } = await convertRasterMbtilesToPmtiles({
        filename: basename(params.outputFilepath),
        resourceId: basename(params.outputFilepath, '.pmtiles').toLowerCase(),
        role: provider.role,
        regionId: params.regionId,
        tileSize: 256,
        attribution: provider.attribution,
        sourceUrl: provider.homepage,
        sourceVersion: new Date().toISOString().slice(0, 10),
        sourceMbtilesPath: mbtilesPath,
        outputDirectory: dirname(params.outputFilepath),
      })
      await upsertMapArchive(dirname(params.outputFilepath), archive)
      await unlink(mbtilesPath)

      await report(true)
      logger.info(`[RunRasterMapJob] ${params.title}: ${done} tiles, ${archive.installedBytes} bytes`)
      return { outputFilepath: params.outputFilepath }
    } catch (error) {
      if (dbOpen) db.close()
      if (cancelled) await deleteFileIfExists(mbtilesPath)
      throw error
    } finally {
      clearInterval(cancelPoll)
    }
  }

  static async dispatch(params: RunRasterMapJobParams) {
    const queue = QueueService.getInstance().getQueue(this.queue)
    const jobId = this.getJobId(params)
    const existing = await queue.getJob(jobId)
    if (existing) {
      const state = await existing.getState()
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        return { job: existing, created: false }
      }
      await existing.remove().catch(() => {})
    }
    const job = await queue.add(this.key, params, {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: true,
    })
    return { job, created: true }
  }

  /** Estimated download for a box, before anything starts. */
  static estimate(bbox: Bbox, minzoom: number, maxzoom: number) {
    const tiles = countTiles(bbox, minzoom, maxzoom)
    return { tiles, bytes: tiles * AVERAGE_TILE_BYTES }
  }
}
