import { Job, UnrecoverableError } from 'bullmq'
import { RunDownloadJobParams, DownloadProgressData } from '../../types/downloads.js'
import { QueueService } from '#services/queue_service'
import {
  doResumableDownload,
  GatedContentAuthError,
  InsufficientDiskSpaceError,
} from '../utils/downloads.js'
import { isDiskFullError } from '../utils/disk_errors.js'
import { createHash } from 'crypto'
import { DockerService } from '#services/docker_service'
import { ZimService } from '#services/zim_service'
import { MapService } from '#services/map_service'
import { RagService } from '#services/rag_service'
import { OllamaService } from '#services/ollama_service'
import { EmbedFileJob } from './embed_file_job.js'
import { basename, join, resolve } from 'node:path'
import { ZIM_STORAGE_PATH } from '../utils/fs.js'
import { decideSupersededDeletion, isSafeOldContentPath } from '../utils/superseded_resource.js'
import { findJobTargetingPath } from '../utils/download_targets.js'

/** Maps live under `<cwd>/storage/maps/pmtiles`; no shared constant exists. */
const MAP_STORAGE_PATH = '/storage/maps'

/** Content storage root a resource of this type must live under. */
function contentStorageRoot(filetype: string): string {
  return filetype === 'zim'
    ? join(process.cwd(), ZIM_STORAGE_PATH)
    : join(process.cwd(), MAP_STORAGE_PATH)
}

export class RunDownloadJob {
  static get queue() {
    return 'downloads'
  }

  static get key() {
    return 'run-download'
  }

  /** In-memory registry of abort controllers for active download jobs */
  static abortControllers: Map<string, AbortController> = new Map()

  /** Final paths being written by jobs running in this worker (all download jobs run here). */
  static activeFilepaths: Set<string> = new Set()

  static getJobId(url: string): string {
    return createHash('sha256').update(url).digest('hex').slice(0, 16)
  }

  /** Redis key used to signal cancellation across processes */
  static cancelKey(jobId: string): string {
    return `nomad:download:cancel:${jobId}`
  }

  /** Signal cancellation via Redis so the worker process can pick it up */
  static async signalCancel(jobId: string): Promise<void> {
    const queueService = QueueService.getInstance()
    const queue = queueService.getQueue(this.queue)
    const client = await queue.client
    await client.set(this.cancelKey(jobId), '1', { EX: 300 }) // 5 min TTL
  }

  async handle(job: Job) {
    const { url, filepath, timeout, allowedMimeTypes, forceNew, filetype, resourceMetadata, requestHeaders } =
      job.data as RunDownloadJobParams

    // Two jobs writing the same file would append to the same `<file>.tmp` and corrupt it.
    // dispatch() refuses a second job for a path already queued; this catches the rest (racing
    // dispatches, a stalled job picked up again). Plain Error: retried once the other finishes.
    const target = resolve(filepath)
    if (RunDownloadJob.activeFilepaths.has(target)) {
      throw new Error(`Another download is already writing ${basename(filepath)}; will retry`)
    }
    RunDownloadJob.activeFilepaths.add(target)

    // Register abort controller for this job
    const abortController = new AbortController()
    RunDownloadJob.abortControllers.set(job.id!, abortController)

    // Get Redis client for checking cancel signals from the API process
    const queueService = QueueService.getInstance()
    const cancelRedis = await queueService
      .getQueue(RunDownloadJob.queue)
      .client.catch((error) => {
        RunDownloadJob.abortControllers.delete(job.id!)
        RunDownloadJob.activeFilepaths.delete(target)
        throw error
      })

    let lastKnownProgress: Pick<DownloadProgressData, 'downloadedBytes' | 'totalBytes'> = {
      downloadedBytes: 0,
      totalBytes: 0,
    }

    // Track whether cancellation was explicitly requested by the user (via Redis signal
    // or in-process AbortController). BullMQ lock mismatches can also abort the download
    // stream, but those should be retried — only user-initiated cancels are unrecoverable.
    let userCancelled = false

    // Poll Redis for cancel signal every 2s — independent of progress events so cancellation
    // works even when the stream is stalled and no onProgress ticks are firing.
    let cancelPollInterval: ReturnType<typeof setInterval> | null = setInterval(async () => {
      try {
        const val = await cancelRedis.get(RunDownloadJob.cancelKey(job.id!))
        if (val) {
          await cancelRedis.del(RunDownloadJob.cancelKey(job.id!))
          userCancelled = true
          abortController.abort('user-cancel')
        }
      } catch {
        // Redis errors are non-fatal; in-process AbortController covers same-process cancels
      }
    }, 2000)

    try {
      await doResumableDownload({
        url,
        filepath,
        timeout,
        allowedMimeTypes,
        forceNew,
        requestHeaders,
        signal: abortController.signal,
        onProgress(progress) {
          const progressPercent = (progress.downloadedBytes / (progress.totalBytes || 1)) * 100
          const progressData: DownloadProgressData = {
            percent: Math.floor(progressPercent),
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            lastProgressTime: Date.now(),
          }
          job.updateProgress(progressData).catch((err) => {
            // Job was removed from Redis (e.g. cancelled) between the callback firing
            // and the Redis write completing — this is expected and safe to ignore.
            if (err?.code !== -1) throw err
          })
          lastKnownProgress = { downloadedBytes: progress.downloadedBytes, totalBytes: progress.totalBytes }
        },
        async onComplete(url) {
          // The previous file recorded for this resource (if any). Hoisted out of
          // the metadata block below so the ZIM branch can decide whether this
          // download is a content UPDATE (replacing a prior file) vs a fresh
          // install, which changes how we reconcile the knowledge base.
          let oldFilePath: string | null = null
          try {
            // Create InstalledResource entry if metadata was provided
            if (resourceMetadata) {
              const { default: InstalledResource } = await import('#models/installed_resource')
              const { DateTime } = await import('luxon')
              const { getFileStatsIfExists, deleteFileIfExists } = await import('../utils/fs.js')
              const stats = await getFileStatsIfExists(filepath)

              // Look up the old entry so we can clean up the previous file after updating
              const oldEntry = await InstalledResource.query()
                .where('resource_id', resourceMetadata.resource_id)
                .where('resource_type', filetype as 'zim' | 'map')
                .first()
              oldFilePath = oldEntry?.file_path ?? null

              const installed = await InstalledResource.updateOrCreate(
                { resource_id: resourceMetadata.resource_id, resource_type: filetype as 'zim' | 'map' },
                {
                  version: resourceMetadata.version,
                  collection_ref: resourceMetadata.collection_ref,
                  url: url,
                  file_path: filepath,
                  file_size_bytes: stats ? Number(stats.size) : null,
                  installed_at: DateTime.now(),
                }
              )

              // A completed auto-update is the authoritative success signal for the
              // per-resource backoff — clear it here (NOT at dispatch time, which
              // would reset the counter every window and defeat self-disable). The
              // matching terminal-failure increment lives in the worker `failed`
              // handler (commands/queue/work.ts). Manual downloads (auto !== true)
              // never touch the counter.
              if (resourceMetadata.auto === true) {
                try {
                  const { recordResourceUpdateSuccess } = await import(
                    '../utils/content_auto_update_backoff.js'
                  )
                  await recordResourceUpdateSuccess(installed)
                } catch (error) {
                  console.error(
                    `[RunDownloadJob] Error clearing auto-update backoff for ${resourceMetadata.resource_id}:`,
                    error
                  )
                }
              }

              // Step 1: delete the OUTDATED file, only for a genuine upgrade (strictly newer
              // version, new file on disk, old path inside the storage root) — a downgrade or
              // re-install must not wipe the newer file — and only if it is this resource's own
              // file (isSafeOldContentPath), even if the InstalledResource row is stale/malformed.
              const storageRoot = contentStorageRoot(filetype)
              const decision = decideSupersededDeletion({
                existing: oldEntry
                  ? { file_path: oldEntry.file_path, version: oldEntry.version }
                  : null,
                newFilePath: filepath,
                newVersion: resourceMetadata.version,
                newFileExists: !!stats,
                storageBaseDir: storageRoot,
              })
              if (decision.delete && decision.path) {
                if (isSafeOldContentPath(decision.path, resourceMetadata.resource_id, storageRoot)) {
                  try {
                    await deleteFileIfExists(decision.path)
                    console.log(`[RunDownloadJob] Deleted old file: ${decision.path}`)
                  } catch (deleteError) {
                    console.warn(
                      `[RunDownloadJob] Failed to delete old file ${decision.path}:`,
                      deleteError
                    )
                  }
                } else {
                  console.warn(
                    `[RunDownloadJob] Refusing to delete unexpected old file path for ` +
                      `${resourceMetadata.resource_id} (${filetype}): ${decision.path}`
                  )
                }
              } else if (decision.reason !== 'first_install' && decision.reason !== 'same_file') {
                console.log(
                  `[RunDownloadJob] Kept old file ${oldFilePath} for ` +
                    `${resourceMetadata.resource_id} (reason: ${decision.reason})`
                )
              }
            }

            if (filetype === 'zim') {
              const dockerService = new DockerService()
              const zimService = new ZimService(dockerService)
              await zimService.downloadRemoteSuccessCallback([url], true)

              // Only touch the knowledge base if AI Assistant (Ollama) is installed.
              // skip_embedding opts a ZIM out entirely — Creator Pack video ZIMs are
              // media galleries, not text, so they must never be embedded or KB-reconciled.
              const ollamaUrl = await dockerService.getServiceURL('nomad_ollama')
              if (ollamaUrl && !resourceMetadata?.skip_embedding) {
                // A content UPDATE replaces a prior file at a DIFFERENT path
                // (version is in the filename). A fresh install has no prior row;
                // a same-version re-download keeps the same path. The two cases
                // reconcile the KB differently.
                const isReplacement = !!oldFilePath && oldFilePath !== filepath

                if (isReplacement) {
                  // CONTENT UPDATE: mirror the REPLACED file's prior indexed state
                  // rather than the global Always/Manual policy. reconcileReplaced-
                  // ContentFile removes the old file's points and re-queues the new
                  // file IFF the old one was indexed and Qdrant is running; it is a
                  // no-op otherwise (not installed / old not indexed / Qdrant down).
                  // The user already chose whether this content is in the KB, so we
                  // honor that choice in both directions. See the method for the
                  // full 5-step contract.
                  try {
                    const ragService = new RagService(dockerService, new OllamaService())
                    const outcome = await ragService.reconcileReplacedContentFile({
                      oldFilePath: oldFilePath!,
                      newFilePath: filepath,
                      fileName: url.split('/').pop() || '',
                    })
                    console.log(
                      `[RunDownloadJob] KB reconciliation for replaced ${filepath}: ${outcome}`
                    )
                  } catch (error) {
                    console.error(
                      `[RunDownloadJob] Error reconciling knowledge base for replaced file ${filepath}:`,
                      error
                    )
                  }
                } else {
                  // FRESH INSTALL (or same-version re-download): respect the global
                  // ingest policy. Under Manual, record the file as pending_decision
                  // so the KB panel surfaces the per-file Index affordance (PR #909)
                  // instead of silently auto-embedding behind the user's back. Unset
                  // is treated as Always to preserve legacy behavior — mirrors
                  // rag_service.ts:1587-1588.
                  const { default: KVStore } = await import('#models/kv_store')
                  const { default: KbIngestState } = await import('#models/kb_ingest_state')
                  const policyRaw = await KVStore.getValue('rag.defaultIngestPolicy')
                  const policy: 'Always' | 'Manual' = policyRaw === 'Manual' ? 'Manual' : 'Always'

                  if (policy === 'Manual') {
                    try {
                      // firstOrCreate so a re-download doesn't demote an existing
                      // indexed/failed row — user keeps prior state and can re-index
                      // explicitly from the KB panel if they want fresh content.
                      await KbIngestState.firstOrCreate(
                        { file_path: filepath },
                        { file_path: filepath, state: 'pending_decision', chunks_embedded: 0 }
                      )
                    } catch (error) {
                      console.error(
                        `[RunDownloadJob] Error recording pending_decision state for ${filepath}:`,
                        error
                      )
                    }
                  } else {
                    try {
                      await EmbedFileJob.dispatch({
                        fileName: url.split('/').pop() || '',
                        filePath: filepath,
                      })
                    } catch (error) {
                      console.error(`[RunDownloadJob] Error dispatching EmbedFileJob for URL ${url}:`, error)
                    }
                  }
                }
              }
            } else if (filetype === 'map') {
              const mapsService = new MapService()
              await mapsService.downloadRemoteSuccessCallback([url], false)
            }
          } catch (error) {
            console.error(
              `[RunDownloadJob] Error in download success callback for URL ${url}:`,
              error
            )
          }
          job.updateProgress({
            percent: 100,
            downloadedBytes: lastKnownProgress.downloadedBytes,
            totalBytes: lastKnownProgress.totalBytes,
            lastProgressTime: Date.now(),
          } as DownloadProgressData).catch((err) => {
            if (err?.code !== -1) throw err
          })
        },
      })

      return {
        url,
        filepath,
      }
    } catch (error: any) {
      // Only prevent retries for user-initiated cancellations. BullMQ lock mismatches
      // can also abort the stream, and those should be retried with backoff.
      // Check both the flag (Redis poll) and abort reason (in-process cancel).
      if (userCancelled || abortController.signal.reason === 'user-cancel') {
        throw new UnrecoverableError(`Download cancelled: ${error.message}`)
      }
      // A rejected entitlement is permanent - this build either has the key or it
      // doesn't. Left as a plain Error it consumes all 10 attempts with exponential
      // backoff from 30s, so the job reads `delayed` for ~4h15m and the user sees a
      // stuck download instead of the message above.
      if (error instanceof GatedContentAuthError) {
        throw new UnrecoverableError(error.message)
      }
      // Retrying won't free space; fail now with the reason shown on the downloads page
      if (error instanceof InsufficientDiskSpaceError || isDiskFullError(error)) {
        throw new UnrecoverableError(error.message)
      }
      throw error
    } finally {
      if (cancelPollInterval !== null) {
        clearInterval(cancelPollInterval)
        cancelPollInterval = null
      }
      RunDownloadJob.abortControllers.delete(job.id!)
      RunDownloadJob.activeFilepaths.delete(target)
    }
  }

  static async getByUrl(url: string): Promise<Job | undefined> {
    const queueService = QueueService.getInstance()
    const queue = queueService.getQueue(this.queue)
    const jobId = this.getJobId(url)
    return await queue.getJob(jobId)
  }

  /**
   * Check if a download is actively in progress for the given URL.
   * Returns the job only if it's in an active state (active, waiting, delayed).
   * If the job exists in a terminal state (failed, completed), removes it and returns undefined.
   */
  static async getActiveByUrl(url: string): Promise<Job | undefined> {
    const job = await this.getByUrl(url)
    if (!job) return undefined

    const state = await job.getState()
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      return job
    }

    // Terminal state -- clean up stale job so it doesn't block re-download
    try {
      await job.remove()
    } catch {
      // May already be gone
    }
    return undefined
  }

  static async dispatch(params: RunDownloadJobParams) {
    const queueService = QueueService.getInstance()
    const queue = queueService.getQueue(this.queue)
    const jobId = this.getJobId(params.url)

    // The .tmp path comes from the file, not the URL: a different URL for the same file
    // (another mirror or version string) must not get a second writer on that .tmp.
    const inFlight = await queue.getJobs(['active', 'waiting', 'delayed'])
    const sameFile = findJobTargetingPath(inFlight, params.filepath, jobId)
    if (sameFile) {
      return {
        job: sameFile,
        created: false,
        message: `A download for ${basename(params.filepath)} is already in progress`,
      }
    }

    try {
      const job = await queue.add(this.key, params, {
        jobId,
        attempts: 10,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: true,
      })

      return {
        job,
        created: true,
        message: `Dispatched download job for URL ${params.url}`,
      }
    } catch (error) {
      if (error.message.includes('job already exists')) {
        const existing = await queue.getJob(jobId)
        return {
          job: existing,
          created: false,
          message: `Job already exists for URL ${params.url}`,
        }
      }
      throw error
    }
  }
}
