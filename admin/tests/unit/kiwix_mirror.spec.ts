import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { kiwixMirrorUrl } from '../../app/utils/kiwix_mirror.js'
import { validateSettingValue } from '../../app/validators/settings.js'

const DOTSRC = 'https://mirrors.dotsrc.org/kiwix/zim/'
const ZIM = 'wikipedia/wikipedia_es_all_maxi_2026-10.zim'

test('kiwix mirror: official URLs map to the same path on the mirror', () => {
  for (const host of ['download.kiwix.org', 'lb.download.kiwix.org', 'mirror.download.kiwix.org']) {
    assert.equal(kiwixMirrorUrl(`https://${host}/zim/${ZIM}`, DOTSRC), DOTSRC + ZIM)
  }
})

test('kiwix mirror: a base without trailing slash still joins correctly', () => {
  assert.equal(
    kiwixMirrorUrl(`https://download.kiwix.org/zim/${ZIM}`, DOTSRC.slice(0, -1)),
    DOTSRC + ZIM
  )
})

test('kiwix mirror: no mirror set means no rewrite', () => {
  for (const base of [null, undefined, '', '   ']) {
    assert.equal(kiwixMirrorUrl(`https://download.kiwix.org/zim/${ZIM}`, base), null)
  }
})

test('kiwix mirror: non-Kiwix and non-zim URLs are left alone', () => {
  // Maps, GitHub releases and files already on a mirror must keep their own URL
  assert.equal(kiwixMirrorUrl('https://build.protomaps.com/20261001.pmtiles', DOTSRC), null)
  assert.equal(kiwixMirrorUrl(`${DOTSRC}${ZIM}`, DOTSRC), null)
  assert.equal(
    kiwixMirrorUrl('https://download.kiwix.org/release/kiwix-tools/x.tar.gz', DOTSRC),
    null
  )
  assert.equal(kiwixMirrorUrl('https://download.kiwix.org.evil.example/zim/x.zim', DOTSRC), null)
  assert.equal(kiwixMirrorUrl('not a url', DOTSRC), null)
})

test('downloads.kiwixMirror accepts an https folder URL or empty, and rejects the rest', () => {
  assert.equal(validateSettingValue('downloads.kiwixMirror', DOTSRC), null)
  assert.equal(validateSettingValue('downloads.kiwixMirror', ''), null)
  assert.notEqual(
    validateSettingValue('downloads.kiwixMirror', 'http://mirrors.dotsrc.org/kiwix/zim/'),
    null
  )
  assert.notEqual(validateSettingValue('downloads.kiwixMirror', `${DOTSRC}?x=1`), null)
  assert.notEqual(validateSettingValue('downloads.kiwixMirror', 'mirrors.dotsrc.org'), null)
  assert.notEqual(validateSettingValue('downloads.kiwixMirror', 42), null)
})
