import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { deleteFileIfExists } from './fs.js'

/**
 * Helpers that keep content download/extract jobs from stepping on each other's files:
 * which file a queued job writes, whether another job already targets a path, and which
 * leftover `<file>.tmp` partials or orphaned map files are safe to delete.
 */

/** Minimal job shape (BullMQ Job) these helpers read. */
export interface TargetJob {
  id?: string | null
  data?: { filepath?: string; outputFilepath?: string } | null
}

/** Final path a download (`filepath`) or pmtiles extract (`outputFilepath`) job writes. */
export function jobTargetPath(job: TargetJob | null | undefined): string | null {
  const target = job?.data?.filepath ?? job?.data?.outputFilepath
  return target ? resolve(target) : null
}

/** Resolved final paths targeted by the given jobs. */
export function jobTargetPaths(jobs: (TargetJob | null | undefined)[]): Set<string> {
  const targets = new Set<string>()
  for (const job of jobs) {
    const target = jobTargetPath(job)
    if (target) targets.add(target)
  }
  return targets
}

/** Another job (not `ownJobId`) that writes the same final path, if any. */
export function findJobTargetingPath<T extends TargetJob>(
  jobs: (T | null | undefined)[],
  filepath: string,
  ownJobId?: string | null
): T | undefined {
  const wanted = resolve(filepath)
  return (jobs.filter(Boolean) as T[]).find(
    (job) => job.id !== ownJobId && jobTargetPath(job) === wanted
  )
}

/**
 * A `<file>.tmp` partial may be swept when no tracked job targets `<file>` and it has not been
 * written to for `minAgeMs` (a running download keeps touching its .tmp).
 */
export function isSweepableTmp(opts: {
  fullPath: string
  mtimeMs: number
  nowMs: number
  minAgeMs: number
  activeTargets: Set<string>
}): boolean {
  if (!opts.fullPath.endsWith('.tmp')) return false
  if (opts.activeTargets.has(resolve(opts.fullPath.slice(0, -'.tmp'.length)))) return false
  return opts.nowMs - opts.mtimeMs >= opts.minAgeMs
}

/**
 * Orphan prune after an extract: only another `<resourceId>_*.pmtiles` of the same resource,
 * never the file just produced or the recorded old file, never a file a queued/running job
 * writes, and never one written since this job started (a concurrent extract for another zoom
 * of the same region may have just finished it).
 */
export function shouldPruneOrphanPmtiles(opts: {
  entry: string
  fullPath: string
  keepName: string
  prefix: string
  oldFilePath: string | null
  mtimeMs: number
  jobStartMs: number
  activeTargets: Set<string>
}): boolean {
  const { entry, fullPath } = opts
  if (entry === opts.keepName || !entry.endsWith('.pmtiles')) return false
  if (!entry.startsWith(opts.prefix)) return false
  if (fullPath === opts.oldFilePath) return false
  if (opts.activeTargets.has(resolve(fullPath))) return false
  return opts.mtimeMs < opts.jobStartMs
}

/** Deletes sweepable `*.tmp` files in `dirs` (see {@link isSweepableTmp}). Returns deleted paths. */
export async function sweepOrphanTmpFiles(
  dirs: string[],
  activeTargets: Set<string>,
  nowMs: number,
  minAgeMs: number
): Promise<string[]> {
  const deleted: string[] = []
  for (const dir of dirs) {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue // folder not created yet
    }
    for (const entry of entries) {
      if (!entry.endsWith('.tmp')) continue
      const fullPath = join(dir, entry)
      try {
        const info = await stat(fullPath)
        if (!info.isFile()) continue
        if (!isSweepableTmp({ fullPath, mtimeMs: info.mtimeMs, nowMs, minAgeMs, activeTargets })) {
          continue
        }
        await deleteFileIfExists(fullPath)
        deleted.push(fullPath)
      } catch {
        // vanished or not deletable; try again next sweep
      }
    }
  }
  return deleted
}
