import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import vine from '@vinejs/vine'

import {
  UnsafeUrlError,
  applyContentUpdateValidator,
  assertNotPrivateUrl,
  isBlockedAddress,
  publicOnlyLookup,
  safeRedirectGuard,
} from '../../app/validators/common.js'
import { creatorPacksSpecSchema } from '../../app/validators/curated_collections.js'

test('isBlockedAddress: loopback, link-local, unspecified and metadata are blocked; LAN/public allowed', () => {
  for (const ip of ['127.0.0.1', '::1', '169.254.169.254', 'fe80::1', '0.0.0.0', '::ffff:127.0.0.1', 'fd00:ec2::254']) {
    assert.equal(isBlockedAddress(ip), true, ip)
  }
  for (const ip of ['192.168.1.10', '10.0.0.5', '8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isBlockedAddress(ip), false, ip)
  }
  assert.equal(isBlockedAddress('not-an-ip'), true)
})

test('guard errors carry status 400 so the controllers answer 400, not 500', () => {
  assert.throws(
    () => assertNotPrivateUrl('http://127.0.0.1/a.zim'),
    (e: any) => e instanceof UnsafeUrlError && e.status === 400
  )
})

test('publicOnlyLookup refuses names that resolve to loopback', async () => {
  const err = await new Promise<Error | null>((res) => publicOnlyLookup('localhost', {}, (e) => res(e)))
  assert.ok(err instanceof UnsafeUrlError)
})

test('safeRedirectGuard re-checks every redirect target', () => {
  assert.throws(() => safeRedirectGuard({ href: 'http://169.254.169.254/latest/meta-data/' }), UnsafeUrlError)
  assert.throws(() => safeRedirectGuard({ href: 'http://[::1]/' }), UnsafeUrlError)
  assert.throws(() => safeRedirectGuard({ href: 'file:///etc/passwd' }), /non-HTTP/)
  assert.throws(() => safeRedirectGuard({}))
  assert.doesNotThrow(() => safeRedirectGuard({ href: 'https://mirror.example.org/a.zim' }))
})

const update = {
  resource_id: 'wikipedia_en_all_nopic',
  resource_type: 'zim',
  installed_version: '2024-01',
  latest_version: '2024-06',
  download_url: 'https://download.kiwix.org/zim/wikipedia_en_all_nopic_2024-06.zim',
}

test('content-update validator rejects path separators in resource_id / latest_version', async () => {
  await applyContentUpdateValidator.validate(update)
  await assert.rejects(applyContentUpdateValidator.validate({ ...update, latest_version: '1/../../../../app/x' }))
  await assert.rejects(applyContentUpdateValidator.validate({ ...update, resource_id: '..\\..\\x' }))
  await assert.rejects(applyContentUpdateValidator.validate({ ...update, resource_id: '' }))
})

test('creator pack manifest rejects path separators in id / version / resource_id', async () => {
  const validate = vine.compile(creatorPacksSpecSchema)
  const pack = {
    id: 'pack-1', name: 'n', creator: 'c', description: 'd', version: '1.0.0',
    resource_id: 'creator_pack-1', video_count: 1, size_mb: 1, license_id: 'l',
  }
  await validate.validate({ spec_version: '1', packs: [pack] })
  for (const field of ['id', 'version', 'resource_id']) {
    await assert.rejects(validate.validate({ spec_version: '1', packs: [{ ...pack, [field]: '../../x' }] }), field)
  }
})
