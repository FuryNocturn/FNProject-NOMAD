import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MapArchiveMetadata } from '../../types/maps.js'
import { MAP_ARCHIVE_MANIFEST_FILENAME } from './map_styles.js'

type ManifestFile = { schemaVersion: 1; archives: Record<string, MapArchiveMetadata> }

/** Manifest with `archive` added or replaced (keyed by filename); other entries untouched. */
export function withArchive(manifest: unknown, archive: MapArchiveMetadata): ManifestFile {
  const current = manifest as Partial<ManifestFile> | null
  const archives =
    current?.schemaVersion === 1 && current.archives && !Array.isArray(current.archives)
      ? { ...current.archives }
      : {}
  archives[archive.filename] = archive
  return { schemaVersion: 1, archives }
}

/**
 * Manifest without the entry for `filename`, or null when there is nothing to
 * remove (no entry, or a manifest this code does not understand; leave it be).
 */
export function withoutArchive(manifest: unknown, filename: string): ManifestFile | null {
  const current = manifest as Partial<ManifestFile> | null
  if (current?.schemaVersion !== 1 || !current.archives || Array.isArray(current.archives))
    return null
  if (!Object.hasOwn(current.archives, filename)) return null
  const archives = { ...current.archives }
  delete archives[filename]
  return { schemaVersion: 1, archives }
}

async function readManifest(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
    return null
  }
}

/**
 * Temp file + rename, so a crash never leaves a half-written manifest (which
 * would block every unlisted archive).
 */
async function writeManifest(path: string, manifest: ManifestFile) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(manifest, null, 2))
  await rename(tmp, path)
}

/**
 * Record a converted archive in `<pmtilesDir>/map-archive-manifest.json` so the
 * style builder treats it as raster instead of a legacy vector region.
 */
export async function upsertMapArchive(pmtilesDir: string, archive: MapArchiveMetadata) {
  const path = join(pmtilesDir, MAP_ARCHIVE_MANIFEST_FILENAME)
  await writeManifest(path, withArchive(await readManifest(path), archive))
}

/** Drop a deleted archive's manifest entry; no-op when it has none. */
export async function removeMapArchive(pmtilesDir: string, filename: string) {
  const path = join(pmtilesDir, MAP_ARCHIVE_MANIFEST_FILENAME)
  const next = withoutArchive(await readManifest(path), filename)
  if (next) await writeManifest(path, next)
}
