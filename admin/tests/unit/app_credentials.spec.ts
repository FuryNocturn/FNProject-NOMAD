import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  APP_CREDENTIALS,
  APP_PASSWORD_LENGTH,
  generateAppPassword,
  hasAppCredentials,
  isUsableAppPassword,
  kismetHttpdConf,
  withAppPasswordEnv,
} from '../../app/utils/app_credentials.js'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import { SETTINGS_KEYS } from '../../constants/kv_store.js'

test('generated passwords are 24 typeable characters, without look-alikes', () => {
  for (let i = 0; i < 200; i++) {
    const password = generateAppPassword()
    assert.equal(password.length, APP_PASSWORD_LENGTH)
    assert.match(password, /^[A-Za-z0-9]+$/)
    assert.doesNotMatch(password, /[0O1Il]/)
  }
})

test('generated passwords differ every time', () => {
  const seen = new Set(Array.from({ length: 200 }, () => generateAppPassword()))
  assert.equal(seen.size, 200)
})

test('a generated password is reused; junk in the KV store is not', () => {
  assert.equal(isUsableAppPassword(generateAppPassword()), true)
  for (const bad of [null, undefined, '', 'short', 42, 'with space and more', 'x'.repeat(73)]) {
    assert.equal(isUsableAppPassword(bad), false, String(bad))
  }
})

test('only PhotoPrism, OpenWebRX and Kismet get a generated login', () => {
  assert.equal(hasAppCredentials(SERVICE_NAMES.PHOTOPRISM), true)
  assert.equal(hasAppCredentials(SERVICE_NAMES.OPENWEBRX), true)
  assert.equal(hasAppCredentials(SERVICE_NAMES.KISMET), true)
  assert.equal(hasAppCredentials(SERVICE_NAMES.HOMEBOX), false)
  assert.equal(hasAppCredentials('toString'), false)
})

test('the passwords are secrets: not readable or writable through the generic settings endpoint', () => {
  for (const { kvKey } of Object.values(APP_CREDENTIALS)) {
    assert.equal((SETTINGS_KEYS as string[]).includes(kvKey), false, kvKey)
  }
})

test('the env gets the password, replacing a fixed default from an older catalog', () => {
  const env = withAppPasswordEnv(
    SERVICE_NAMES.PHOTOPRISM,
    ['PHOTOPRISM_ADMIN_USER=admin', 'PHOTOPRISM_ADMIN_PASSWORD=nomadphotos'],
    'Secret123'
  )
  assert.deepEqual(env, ['PHOTOPRISM_ADMIN_USER=admin', 'PHOTOPRISM_ADMIN_PASSWORD=Secret123'])
  assert.deepEqual(withAppPasswordEnv(SERVICE_NAMES.OPENWEBRX, [], 'Secret123'), [
    'OPENWEBRX_ADMIN_PASSWORD=Secret123',
  ])
})

test('apps without an env variable, or without a login, keep their env untouched', () => {
  assert.deepEqual(withAppPasswordEnv(SERVICE_NAMES.KISMET, ['A=1'], 'Secret123'), ['A=1'])
  assert.deepEqual(withAppPasswordEnv(SERVICE_NAMES.HOMEBOX, ['A=1'], 'Secret123'), ['A=1'])
})

test('Kismet login file uses its httpd_username / httpd_password keys', () => {
  assert.equal(
    kismetHttpdConf('admin', 'Secret123'),
    'httpd_username=admin\nhttpd_password=Secret123\n'
  )
})
