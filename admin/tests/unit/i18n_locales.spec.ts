import * as assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { validateSettingValue } from '../../app/validators/settings.js'

const LOCALES_DIR = new URL('../../inertia/i18n/locales/', import.meta.url)

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

// Same shape the app builds: { <section file name>: <its JSON> }
function loadLocale(lang: string): Record<string, unknown> {
  const dir = new URL(`${lang}/`, LOCALES_DIR)
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [f.slice(0, -'.json'.length), JSON.parse(readFileSync(new URL(f, dir), 'utf8'))])
  )
}

const english = flattenKeys(loadLocale('en'))

for (const lang of readdirSync(LOCALES_DIR).filter((d) => d !== 'en')) {
  test(`${lang} has no keys that are missing from en`, () => {
    // en is the reference: a key only in a translation is a typo or dead text.
    const extra = flattenKeys(loadLocale(lang)).filter((key) => !english.includes(key))
    assert.deepEqual(extra, [])
  })

  test(`${lang} keeps the same {{variables}} as en`, () => {
    const en = loadLocale('en')
    const other = loadLocale(lang)
    const get = (obj: any, key: string) => key.split('.').reduce((o, k) => o?.[k], obj)
    const vars = (text: unknown) => String(text ?? '').match(/{{\w+}}/g)?.sort() ?? []
    for (const key of flattenKeys(other)) {
      assert.deepEqual(vars(get(other, key)), vars(get(en, key)), `variables differ in ${key}`)
    }
  })
}

test('every literal t() / i18nKey used in the UI exists in en', () => {
  const en = loadLocale('en')
  const exists = (key: string) =>
    [key, `${key}_one`, `${key}_other`].some(
      (k) => k.split('.').reduce<any>((o, p) => (o && typeof o === 'object' ? o[p] : undefined), en) !== undefined
    )
  const walk = (dir: URL): URL[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : /\.tsx?$/.test(e.name) ? [new URL(e.name, dir)] : []
    )
  // Template-literal keys (t(`a.${b}`)) cannot be checked statically and are skipped
  const missing = walk(new URL('../../inertia/', import.meta.url)).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/(?:\bt\(|i18nKey=)\s*["']([\w.]+)["']/g)]
      .map((m) => m[1])
      .filter((key) => !exists(key))
      .map((key) => `${file.pathname.split('/inertia/')[1]}: ${key}`)
  )
  assert.deepEqual(missing, [])
})

test('ui.language accepts language codes and rejects anything else', () => {
  assert.equal(validateSettingValue('ui.language', 'es'), null)
  assert.equal(validateSettingValue('ui.language', 'pt-BR'), null)
  assert.notEqual(validateSettingValue('ui.language', 'spanish'), null)
  assert.notEqual(validateSettingValue('ui.language', '<script>'), null)
  assert.notEqual(validateSettingValue('ui.language', 42), null)
})
