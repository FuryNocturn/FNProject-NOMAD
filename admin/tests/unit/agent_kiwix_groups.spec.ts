import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { booksByLanguage } from '../../app/agent/kiwix.js'

test('books are grouped by their exact language list', () => {
  const groups = booksByLanguage([
    { name: 'wikipedia_en', language: 'eng' },
    { name: 'wikipedia_es', language: 'spa' },
    { name: 'wikem', language: 'eng,spa,fra' },
    { name: 'medicine_en', language: 'eng' },
  ])
  assert.deepEqual(groups, [['wikipedia_en', 'medicine_en'], ['wikipedia_es'], ['wikem']])
})

test('books without a name are skipped', () => {
  assert.deepEqual(booksByLanguage([{ name: '', language: 'eng' }]), [])
})
