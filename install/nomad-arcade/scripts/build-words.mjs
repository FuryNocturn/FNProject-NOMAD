// Builds the Word Tiles dictionaries (public/words/<lang>.txt) from the MIT
// word-list packages: upper case, accents dropped (Ñ kept), letters only, 2-15 long.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const SOURCES = { es: 'an-array-of-spanish-words/index.json', en: 'an-array-of-english-words/index.json' }
const LETTERS = { es: /^[A-ZÑ]{2,15}$/, en: /^[A-Z]{2,15}$/ }

const normalize = (w) =>
  w.toUpperCase().replace(/Ñ/g, '\u0000').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0000/g, 'Ñ')

mkdirSync('public/words', { recursive: true })
for (const [lang, src] of Object.entries(SOURCES)) {
  const words = JSON.parse(readFileSync(require.resolve(src), 'utf8'))
  const out = [...new Set(words.map(normalize).filter((w) => LETTERS[lang].test(w)))].sort()
  writeFileSync(`public/words/${lang}.txt`, out.join('\n'))
  console.log(`words/${lang}.txt: ${out.length} words`)
}
