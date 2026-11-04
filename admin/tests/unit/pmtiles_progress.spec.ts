import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { parsePmtilesPercent } from '../../constants/map_regions.js'

test('reads the last percent of the pmtiles progress bar', () => {
  const chunk =
    'fetching chunks   8% |█     | (174 kB/1.9 MB, 376 kB/s) [0s:4s]\r' +
    'fetching chunks  48% |██████████ | (955 kB/1.9 MB, 792 kB/s) [0s:1s]\r'
  assert.equal(parsePmtilesPercent(chunk), 48)
})

test('lines without the progress bar give nothing', () => {
  assert.equal(parsePmtilesPercent('extract.go:413: Region tiles 14, result tile entries 14\n'), null)
  assert.equal(parsePmtilesPercent(''), null)
})

test('never above 100', () => {
  assert.equal(parsePmtilesPercent('fetching chunks 100% |'), 100)
})
