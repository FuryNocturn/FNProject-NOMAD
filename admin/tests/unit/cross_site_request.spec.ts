import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { isCrossSiteRequest } from '../../app/utils/cross_site_request.js'

const hosts = ['192.168.1.20:8080', undefined]

test('a form POST from another website is refused', () => {
  assert.equal(
    isCrossSiteRequest({ method: 'POST', secFetchSite: 'cross-site', origin: 'https://evil.example', hosts }),
    true
  )
})

test('a page served by another app on the same host (another port) is refused', () => {
  assert.equal(
    isCrossSiteRequest({ method: 'POST', secFetchSite: 'same-site', origin: 'http://192.168.1.20:8100', hosts }),
    true
  )
})

test('older browsers without Sec-Fetch-Site are judged by Origin', () => {
  assert.equal(isCrossSiteRequest({ method: 'DELETE', origin: 'https://evil.example', hosts }), true)
  assert.equal(isCrossSiteRequest({ method: 'DELETE', origin: 'http://192.168.1.20:8080', hosts }), false)
  assert.equal(isCrossSiteRequest({ method: 'POST', origin: 'null', hosts }), true)
})

test('the NOMAD UI itself is allowed', () => {
  assert.equal(
    isCrossSiteRequest({ method: 'PATCH', secFetchSite: 'same-origin', origin: 'http://192.168.1.20:8080', hosts }),
    false
  )
})

test('a reverse proxy host in X-Forwarded-Host is accepted', () => {
  assert.equal(
    isCrossSiteRequest({
      method: 'POST',
      secFetchSite: 'same-origin',
      origin: 'https://nomad.home',
      hosts: ['nomad_admin:8080', 'nomad.home, proxy.internal'],
    }),
    false
  )
})

test('reads and non-browser clients (curl, scripts) are not affected', () => {
  assert.equal(isCrossSiteRequest({ method: 'GET', secFetchSite: 'cross-site', origin: 'https://evil.example', hosts }), false)
  assert.equal(isCrossSiteRequest({ method: 'POST', hosts }), false)
})
