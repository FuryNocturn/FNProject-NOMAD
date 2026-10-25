import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import logger from '@adonisjs/core/services/logger'
import { PMTILES_BINARY_PATH } from '../../constants/map_regions.js'
import { RunRasterMapJob } from '#jobs/run_raster_map_job'
import { MAP_ARCHIVE_MANIFEST_FILENAME, parseMapArchiveManifestJson } from '../utils/map_styles.js'
import { getFile } from '../utils/fs.js'
import {
  RASTER_MIN_ZOOM,
  RASTER_PROVIDERS,
  type Bbox,
  getRasterProvider,
  intersectBbox,
  isValidBbox,
} from '../utils/raster_tiles.js'

const execFileAsync = promisify(execFile)
const PMTILES_DIR = join(process.cwd(), 'storage/maps/pmtiles')

export type RasterRegion = { id: string; name: string; bbox: Bbox }

/** Safe id for file names and the manifest's regionId. */
export function toRegionId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.pmtiles$/, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'region'
  )
}

/** Offline aerial / topographic maps (#1175): providers, regions, estimates, downloads. */
export class RasterMapService {
  providers() {
    return RASTER_PROVIDERS.map(({ id, role, coverage, maxzoom, attribution }) => ({
      id,
      role,
      coverage,
      maxzoom,
      attribution,
    }))
  }

  /**
   * Street-map regions already downloaded, with their bounds, as candidate
   * areas for imagery. Raster archives themselves are left out.
   */
  async regions(): Promise<RasterRegion[]> {
    let names: string[]
    try {
      names = (await readdir(PMTILES_DIR)).filter((n) => n.endsWith('.pmtiles'))
    } catch {
      return []
    }
    const manifestRaw = await getFile(join(PMTILES_DIR, MAP_ARCHIVE_MANIFEST_FILENAME), 'string')
    const raster = new Set(
      manifestRaw
        ? parseMapArchiveManifestJson(manifestRaw.toString())
            .archives.filter((a) => a.kind === 'raster')
            .map((a) => a.filename)
        : []
    )

    const regions: RasterRegion[] = []
    for (const name of names.filter((n) => !raster.has(n))) {
      try {
        const { stdout } = await execFileAsync(
          PMTILES_BINARY_PATH,
          ['show', join(PMTILES_DIR, name), '--header-json'],
          { maxBuffer: 1024 * 1024 }
        )
        const bounds = JSON.parse(stdout.toString()).bounds
        if (isValidBbox(bounds)) {
          regions.push({ id: toRegionId(name), name: name.replace(/\.pmtiles$/, ''), bbox: bounds })
        }
      } catch (error) {
        logger.warn(`[RasterMapService] could not read bounds of ${name}: ${error}`)
      }
    }
    return regions
  }

  /** Box clipped to the provider's coverage, tile count and size; null when they don't overlap. */
  estimate(providerId: string, bbox: Bbox, maxzoom: number) {
    const provider = getRasterProvider(providerId)
    if (!provider) return null
    const clipped = intersectBbox(bbox, provider.coverage)
    if (!clipped) return null
    const zoom = Math.min(maxzoom, provider.maxzoom)
    return { bbox: clipped, maxzoom: zoom, ...RunRasterMapJob.estimate(clipped, RASTER_MIN_ZOOM, zoom) }
  }

  async start(params: { providerId: string; regionId: string; regionName: string; bbox: Bbox; maxzoom: number }) {
    const provider = getRasterProvider(params.providerId)
    const estimate = this.estimate(params.providerId, params.bbox, params.maxzoom)
    if (!provider || !estimate) return null
    const regionId = toRegionId(params.regionId)
    return RunRasterMapJob.dispatch({
      sourceUrl: provider.url,
      outputFilepath: join(PMTILES_DIR, `${provider.id}_${regionId}_z${estimate.maxzoom}.pmtiles`),
      filetype: 'map',
      title: `${params.regionName} · ${provider.id} (z${estimate.maxzoom})`,
      providerId: provider.id,
      regionId,
      bbox: estimate.bbox,
      minzoom: RASTER_MIN_ZOOM,
      maxzoom: estimate.maxzoom,
      estimatedBytes: estimate.bytes,
    })
  }
}
