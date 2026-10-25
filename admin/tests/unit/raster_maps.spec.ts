import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { withArchive } from '../../app/utils/map_archive_manifest.js'
import { parseMapArchiveManifest } from '../../app/utils/map_styles.js'
import type { RasterMapArchiveMetadata } from '../../types/maps.js'

const archive: RasterMapArchiveMetadata = {
  filename: 'ign-pnoa_spain_z14.pmtiles',
  resourceId: 'ign-pnoa_spain_z14',
  kind: 'raster',
  role: 'aerial',
  regionId: 'spain',
  tileFormat: 'jpeg',
  tileSize: 256,
  minzoom: 5,
  maxzoom: 14,
  bounds: [-9.5, 36, 3.3, 43.8],
  attribution: 'PNOA © IGN',
  sourceUrl: 'https://www.ign.es/',
  sourceVersion: '2026-10-25',
  sha256: 'a'.repeat(64),
  installedBytes: 123,
  verifiedAt: '2026-10-25T10:00:00.000Z',
}

test('raster manifest: a new archive is added and parses as raster', () => {
  const manifest = withArchive(null, archive)
  const parsed = parseMapArchiveManifest(manifest)
  assert.equal(parsed.archives.length, 1)
  assert.equal(parsed.archives[0].kind, 'raster')
  assert.deepEqual(parsed.rejectedFilenames, [])
})

test('raster manifest: re-adding replaces the entry and keeps the others', () => {
  const other = { ...archive, filename: 'ign-mtn_spain_z14.pmtiles', resourceId: 'ign-mtn_spain_z14', role: 'topographic' as const }
  const manifest = withArchive(withArchive(withArchive(null, archive), other), { ...archive, maxzoom: 15 })
  assert.equal(Object.keys(manifest.archives).length, 2)
  assert.equal(manifest.archives[archive.filename].maxzoom, 15)
})

test('raster manifest: a corrupt existing manifest is replaced, not merged', () => {
  const manifest = withArchive({ schemaVersion: 7, archives: 'x' }, archive)
  assert.deepEqual(Object.keys(manifest.archives), [archive.filename])
})
