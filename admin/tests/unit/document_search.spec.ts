import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildSnippet,
  canUseFulltext,
  isSearchableDocument,
  searchTerms,
} from '../../app/utils/document_search.js'

test('document search: terms are lower-cased, de-duplicated and keep accented letters', () => {
  assert.deepEqual(searchTerms('Purificar  AGUA, agua; ¿Cómo?'), ['purificar', 'agua', 'cómo'])
  assert.deepEqual(searchTerms('  ...  '), [])
})

test('document search: FULLTEXT needs at least one 3+ letter term', () => {
  assert.equal(canUseFulltext(['ph', 'co']), false)
  assert.equal(canUseFulltext(['ph', 'agua']), true)
})

test('document search: only text-bearing documents are indexed', () => {
  assert.equal(isSearchableDocument('/a/manual.pdf'), true)
  assert.equal(isSearchableDocument('/a/notas.MD'), true)
  assert.equal(isSearchableDocument('/a/libro.epub'), true)
  assert.equal(isSearchableDocument('/a/foto.jpg'), false)
  assert.equal(isSearchableDocument('/a/wikipedia.zim'), false)
})

test('document search: the snippet is centred on the first match', () => {
  const content = `${'x '.repeat(500)}hervir el agua durante un minuto ${'y '.repeat(500)}`
  const snippet = buildSnippet(content, ['agua'], 20)
  assert.match(snippet, /agua/)
  assert.ok(snippet.startsWith('… ') && snippet.endsWith(' …'))
  assert.ok(snippet.length < 80)
})

test('document search: without a literal match the snippet starts at the beginning', () => {
  assert.equal(buildSnippet('Hola   mundo', ['nada'], 50), 'Hola mundo')
})
