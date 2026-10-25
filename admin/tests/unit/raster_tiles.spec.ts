import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  RASTER_PROVIDERS,
  countTiles,
  getRasterProvider,
  intersectBbox,
  isValidBbox,
  lonLatToTile,
  tileRange,
  tileUrl,
  xyzRowToTms,
  type Bbox,
} from '../../app/utils/raster_tiles.js'

test('raster tiles: known tile for Madrid at z14', () => {
  // Puerta del Sol (-3.7038, 40.4168)
  assert.deepEqual(lonLatToTile(-3.7038, 40.4168, 14), { x: 8023, y: 6177 })
  assert.deepEqual(lonLatToTile(0, 0, 0), { x: 0, y: 0 })
})

test('raster tiles: extreme coordinates are clamped to the tile grid', () => {
  assert.deepEqual(lonLatToTile(180, -90, 3), { x: 7, y: 7 })
  assert.deepEqual(lonLatToTile(-180, 90, 3), { x: 0, y: 0 })
})

test('raster tiles: ranges and counts grow 4x per zoom for a large box', () => {
  const box: Bbox = [-10, 35, 4, 44]
  const r = tileRange(box, 8)
  assert.ok(r.minX <= r.maxX && r.minY <= r.maxY)
  const z10 = countTiles(box, 10, 10)
  const z11 = countTiles(box, 11, 11)
  assert.ok(z11 > z10 * 3.5 && z11 < z10 * 4.5)
  assert.equal(countTiles(box, 5, 6), countTiles(box, 5, 5) + countTiles(box, 6, 6))
})

test('raster tiles: boxes are clipped to the provider coverage', () => {
  const spain = getRasterProvider('ign-pnoa')!.coverage
  assert.deepEqual(intersectBbox([-4, 40, -3, 41], spain), [-4, 40, -3, 41])
  assert.equal(intersectBbox([10, 50, 12, 52], spain), null)
})

test('raster tiles: bbox validation', () => {
  assert.equal(isValidBbox([-4, 40, -3, 41]), true)
  assert.equal(isValidBbox([-3, 40, -4, 41]), false)
  assert.equal(isValidBbox([-4, 40, -3]), false)
  assert.equal(isValidBbox('x'), false)
})

test('raster tiles: URL templates and TMS rows', () => {
  for (const p of RASTER_PROVIDERS) {
    const url = tileUrl(p, 3, 4, 5)
    assert.ok(url.startsWith('https://'), p.id)
    assert.ok(!/[{}]/.test(url), p.id)
    assert.ok(p.homepage.startsWith('https://'), p.id)
  }
  assert.equal(xyzRowToTms(0, 3), 7)
  assert.equal(xyzRowToTms(7, 3), 0)
})
