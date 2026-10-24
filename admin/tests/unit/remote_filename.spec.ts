import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { join, resolve } from 'node:path'

import { filenameFromUrl, resolveInside } from '../../app/utils/remote_filename.js'
import { uploadByteBudget } from '../../app/utils/upload_budget.js'

test('filenameFromUrl uses the decoded pathname only', () => {
  assert.equal(filenameFromUrl('https://h/dir/wikipedia_en_all_2024-01.zim'), 'wikipedia_en_all_2024-01.zim')
  assert.equal(filenameFromUrl('https://h/a.zim?x=1#frag'), 'a.zim')
  assert.equal(filenameFromUrl('https://h/my%20file.zim'), 'my file.zim')
})

test('filenameFromUrl cannot be steered by query, fragment or encoded separators', () => {
  // The raw-string split('/') bug: this used to become `kiwix-library.xml`
  assert.equal(filenameFromUrl('https://evil/a.zim#/kiwix-library.xml', '.zim'), 'a.zim')
  assert.equal(filenameFromUrl('https://evil/a.zim?/../kiwix-library.xml', '.zim'), 'a.zim')
  assert.equal(filenameFromUrl('https://evil/x/..%2F..%2Fkiwix-library.xml'), 'kiwix-library.xml')
  assert.equal(filenameFromUrl('https://evil/x/..%2F..%2Fkiwix-library.xml', '.zim'), null)
  assert.equal(filenameFromUrl('https://evil/a%5C..%5Cb.zim'), null)
  assert.equal(filenameFromUrl('https://evil/a%00.zim'), null)
})

test('filenameFromUrl rejects empty, dot names, bad URLs and wrong extensions', () => {
  assert.equal(filenameFromUrl('https://h/'), null)
  assert.equal(filenameFromUrl('https://h/dir/..'), null)
  assert.equal(filenameFromUrl('not a url'), null)
  assert.equal(filenameFromUrl('https://h/%E0%A4%A.zim'), null)
  assert.equal(filenameFromUrl('https://h/a.pmtiles', '.zim'), null)
  assert.equal(filenameFromUrl('https://h/a.pmtiles', '.pmtiles'), 'a.pmtiles')
})

test('resolveInside keeps paths under the base', () => {
  const base = resolve('storage-test')
  assert.equal(resolveInside(base, 'a_1.zim'), join(base, 'a_1.zim'))
  assert.throws(() => resolveInside(base, 'x_1/../../../app/evil.zim'), /outside/)
  assert.throws(() => resolveInside(base, '..'), /outside/)
  assert.throws(() => resolveInside(base, ''), /outside/)
})

test('uploadByteBudget keeps the headroom free', () => {
  const GiB = 1024 ** 3
  assert.deepEqual(uploadByteBudget(10 * GiB, 0, 2 * GiB), { ok: true, maxBytes: 8 * GiB })
  assert.deepEqual(uploadByteBudget(10 * GiB, 8 * GiB, 2 * GiB), { ok: true, maxBytes: 8 * GiB })
  assert.deepEqual(uploadByteBudget(10 * GiB, 8 * GiB + 1, 2 * GiB), { ok: false })
  // Never a 0 limit (multipart treats 0 as unlimited)
  assert.deepEqual(uploadByteBudget(2 * GiB, 0, 2 * GiB), { ok: false })
  assert.deepEqual(uploadByteBudget(1 * GiB, 0, 2 * GiB), { ok: false })
})
