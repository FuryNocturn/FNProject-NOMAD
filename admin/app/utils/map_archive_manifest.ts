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
 * Record a converted archive in `<pmtilesDir>/map-archive-manifest.json` so the
 * style builder treats it as raster instead of a legacy vector region. Written
 * to a temp file and renamed, so a crash never leaves a half-written manifest
 * (which would block every unlisted archive).
 */
export async function upsertMapArchive(pmtilesDir: string, archive: MapArchiveMetadata) {
  const path = join(pmtilesDir, MAP_ARCHIVE_MANIFEST_FILENAME)
  let current: unknown = null
  try {
    current = JSON.parse(await readFile(path, 'utf8'))
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
  }
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(withArchive(current, archive), null, 2))
  await rename(tmp, path)
}
