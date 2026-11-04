import { DICTS } from './i18n'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

test('every language has the same keys as Spanish, all filled in', () => {
  const keys = Object.keys(DICTS.es).sort()
  for (const [lang, dict] of Object.entries(DICTS)) {
    expect(Object.keys(dict).sort(), lang).toEqual(keys)
    for (const k of keys) expect(dict[k as keyof typeof dict].trim(), `${lang} ${k}`).not.toBe('')
  }
})

test('every translation keeps the placeholders of the Spanish text', () => {
  for (const [lang, dict] of Object.entries(DICTS))
    for (const [k, es] of Object.entries(DICTS.es)) expect(placeholders(dict[k as keyof typeof dict]), `${lang} ${k}`).toEqual(placeholders(es))
})
