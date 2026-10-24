import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { getSettingSchema, updateSettingSchema, validateSettingValue } from '../../app/validators/settings.js'
import { SETTINGS_KEYS } from '../../constants/kv_store.js'

test('ai.remoteOllamaUrl cannot be written through the generic settings endpoint', () => {
  for (const value of ['http://192.168.1.5:11434', '', null, undefined]) {
    const msg = validateSettingValue('ai.remoteOllamaUrl', value)
    assert.ok(msg && msg.includes('/api/ollama/configure-remote'), String(value))
  }
})

test('ai.remoteOllamaUrl stays readable through the generic settings endpoint', async () => {
  assert.ok(SETTINGS_KEYS.includes('ai.remoteOllamaUrl'))
  assert.deepEqual(await getSettingSchema.validate({ key: 'ai.remoteOllamaUrl' }), { key: 'ai.remoteOllamaUrl' })
})

test('the homebox API key pepper is neither readable nor writable', async () => {
  assert.ok(!SETTINGS_KEYS.includes('apps.homebox.apiKeyPepper'))
  await assert.rejects(getSettingSchema.validate({ key: 'apps.homebox.apiKeyPepper' }))
  await assert.rejects(updateSettingSchema.validate({ key: 'apps.homebox.apiKeyPepper', value: 'x' }))
})

test('other keys keep their existing validation', () => {
  assert.equal(validateSettingValue('ui.language', 'es'), null)
  assert.notEqual(validateSettingValue('ui.language', 'spanish'), null)
  assert.equal(validateSettingValue('chat.suggestionsEnabled', true), null)
})
