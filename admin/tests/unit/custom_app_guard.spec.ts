import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluateBindMounts, evaluateImageReference } from '../../app/services/custom_app_guard.js'

// ── Bind mounts ──────────────────────────────────────────────────────────────
// These assume the default storage root (/opt/project-nomad/storage), i.e. NOMAD_STORAGE_PATH unset.

test('evaluateBindMounts hard-blocks the Docker socket', () => {
  const { blocked } = evaluateBindMounts([
    { host_path: '/var/run/docker.sock', container_path: '/var/run/docker.sock' },
  ])
  assert.equal(blocked.length, 1)
})

test('evaluateBindMounts hard-blocks core system directories', () => {
  for (const dir of ['/etc', '/proc/foo', '/sys', '/boot', '/dev/sda']) {
    const { blocked } = evaluateBindMounts([{ host_path: dir, container_path: '/data' }])
    assert.equal(blocked.length, 1, `${dir} should be blocked`)
  }
})

test('evaluateBindMounts hard-blocks mounting at or above the install tree', () => {
  for (const dir of ['/', '/opt', '/opt/project-nomad']) {
    const { blocked } = evaluateBindMounts([{ host_path: dir, container_path: '/data' }])
    assert.equal(blocked.length, 1, `${dir} should be blocked`)
  }
})

test('evaluateBindMounts allows paths under the storage root without warning', () => {
  const { blocked, warnings } = evaluateBindMounts([
    { host_path: '/opt/project-nomad/storage/myapp', container_path: '/data' },
  ])
  assert.equal(blocked.length, 0)
  assert.equal(warnings.length, 0)
})

test('evaluateBindMounts warns (but allows) paths outside the storage root', () => {
  const { blocked, warnings } = evaluateBindMounts([
    { host_path: '/home/user/data', container_path: '/data' },
  ])
  assert.equal(blocked.length, 0)
  assert.equal(warnings.length, 1)
})

test('evaluateBindMounts resolves .. before matching (no traversal escape)', () => {
  // Normalizes to /etc, which must still be blocked despite the dressing-up.
  const { blocked } = evaluateBindMounts([
    { host_path: '/srv/../etc/shadow', container_path: '/data' },
  ])
  assert.equal(blocked.length, 1)
})

test('evaluateBindMounts requires absolute container paths', () => {
  const { blocked } = evaluateBindMounts([
    { host_path: '/opt/project-nomad/storage/x', container_path: 'relative' },
  ])
  assert.equal(blocked.length, 1)
})

test('evaluateBindMounts hard-blocks a colon in the host path', () => {
  // Without this, Docker would re-split "/etc:foo" on the colon and mount /etc — bypassing the
  // system-directory block, which only matches the string as a whole path.
  const { blocked } = evaluateBindMounts([
    { host_path: '/etc:foo', container_path: '/data' },
  ])
  assert.equal(blocked.length, 1)
})

test('evaluateBindMounts hard-blocks a colon in the container path', () => {
  const { blocked } = evaluateBindMounts([
    { host_path: '/opt/project-nomad/storage/x', container_path: '/data:ro' },
  ])
  assert.equal(blocked.length, 1)
})

// ── Image references ─────────────────────────────────────────────────────────

test('evaluateImageReference warns on the latest tag', () => {
  const { blocked, warnings } = evaluateImageReference('nginx:latest')
  assert.equal(blocked.length, 0)
  assert.ok(warnings.some((w) => w.includes('moving tag')))
})

test('evaluateImageReference warns when no tag is given', () => {
  const { warnings } = evaluateImageReference('nginx')
  assert.ok(warnings.some((w) => w.includes('moving tag')))
})

test('evaluateImageReference is clean for a pinned image from a trusted registry', () => {
  const { blocked, warnings } = evaluateImageReference('ghcr.io/stirling-tools/s-pdf:0.30.1')
  assert.equal(blocked.length, 0)
  assert.equal(warnings.length, 0)
})

test('evaluateImageReference warns on an untrusted registry', () => {
  const { warnings } = evaluateImageReference('myregistry.example.com/app:1.0.0')
  assert.ok(warnings.some((w) => w.includes('trusted registries')))
})

test('evaluateImageReference blocks a malformed reference', () => {
  const { blocked } = evaluateImageReference('not a valid image!!')
  assert.equal(blocked.length, 1)
})

test('evaluateImageReference accepts a digest-pinned image without a moving-tag warning', () => {
  const { blocked, warnings } = evaluateImageReference(
    'ghcr.io/org/app@sha256:' + 'a'.repeat(64)
  )
  assert.equal(blocked.length, 0)
  assert.equal(warnings.length, 0)
})

// ── Hardening ────────────────────────────────────────────────────────────────

test('evaluateBindMounts hard-blocks host binaries, libraries, root home and Docker state', () => {
  for (const dir of ['/usr/lib/systemd/system', '/bin', '/lib64', '/root/.ssh', '/var/lib/docker/volumes']) {
    const { blocked } = evaluateBindMounts([{ host_path: dir, container_path: '/data' }])
    assert.equal(blocked.length, 1, `${dir} should be blocked`)
  }
})

test('evaluateBindMounts hard-blocks project-nomad files outside storage (database, compose)', () => {
  for (const dir of ['/opt/project-nomad/mysql', '/opt/project-nomad/compose.yml']) {
    const { blocked } = evaluateBindMounts([{ host_path: dir, container_path: '/data' }])
    assert.equal(blocked.length, 1, `${dir} should be blocked`)
  }
})

test('evaluateBindMounts still only warns for user data folders like /home', () => {
  const { blocked, warnings } = evaluateBindMounts([
    { host_path: '/home/user/Videos', container_path: '/media' },
  ])
  assert.equal(blocked.length, 0)
  assert.equal(warnings.length, 1)
})

test('evaluateBindMounts blocks a storage path that escapes through a symlink', () => {
  // storage/app-a/escape is a symlink to host "/" created by another container
  const realpath = (p: string) => {
    if (p === '/app/storage') return '/app/storage'
    if (p.startsWith('/app/storage/app-a/escape')) return '/' + p.slice('/app/storage/app-a/escape'.length).replace(/^\//, '')
    if (p === '/app/storage/app-a') return p
    throw new Error('ENOENT')
  }
  const escaping = evaluateBindMounts(
    [{ host_path: '/opt/project-nomad/storage/app-a/escape/etc', container_path: '/data' }],
    realpath
  )
  assert.equal(escaping.blocked.length, 1)

  const normal = evaluateBindMounts(
    [{ host_path: '/opt/project-nomad/storage/app-a/new-folder', container_path: '/data' }],
    realpath
  )
  assert.equal(normal.blocked.length, 0)
  assert.equal(normal.warnings.length, 0)
})
