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

function loadLocale(file: string) {
  return JSON.parse(readFileSync(new URL(file, LOCALES_DIR), 'utf8'))
}

const english = flattenKeys(loadLocale('en.json'))

for (const file of readdirSync(LOCALES_DIR).filter((f) => f !== 'en.json')) {
  test(`${file} has no keys that are missing from en.json`, () => {
    // en.json is the reference: a key only in a translation is a typo or dead text.
    const extra = flattenKeys(loadLocale(file)).filter((key) => !english.includes(key))
    assert.deepEqual(extra, [])
  })

  test(`${file} keeps the same {{variables}} as en.json`, () => {
    const en = loadLocale('en.json')
    const other = loadLocale(file)
    const get = (obj: any, key: string) => key.split('.').reduce((o, k) => o?.[k], obj)
    const vars = (text: unknown) => String(text ?? '').match(/{{\w+}}/g)?.sort() ?? []
    for (const key of flattenKeys(other)) {
      assert.deepEqual(vars(get(other, key)), vars(get(en, key)), `variables differ in ${key}`)
    }
  })
}

test('ui.language accepts language codes and rejects anything else', () => {
  assert.equal(validateSettingValue('ui.language', 'es'), null)
  assert.equal(validateSettingValue('ui.language', 'pt-BR'), null)
  assert.notEqual(validateSettingValue('ui.language', 'spanish'), null)
  assert.notEqual(validateSettingValue('ui.language', '<script>'), null)
  assert.notEqual(validateSettingValue('ui.language', 42), null)
})
