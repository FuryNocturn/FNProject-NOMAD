import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, utimes, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  findJobTargetingPath,
  isSweepableTmp,
  jobTargetPaths,
  shouldPruneOrphanPmtiles,
  sweepOrphanTmpFiles,
} from '../../app/utils/download_targets.js'
import { isSafeOldContentPath } from '../../app/utils/superseded_resource.js'

const ZIM = resolve('/app/storage/zim')
const HOUR = 60 * 60 * 1000

test('findJobTargetingPath finds another job writing the same file, not itself', () => {
  const jobs = [
    { id: 'a', data: { filepath: join(ZIM, 'x_2026-01.zim') } },
    { id: 'b', data: { outputFilepath: join(ZIM, 'y.pmtiles') } },
    null,
  ]
  assert.equal(findJobTargetingPath(jobs, join(ZIM, 'x_2026-01.zim'), 'z')?.id, 'a')
  assert.equal(findJobTargetingPath(jobs, join(ZIM, 'x_2026-01.zim'), 'a'), undefined)
  assert.equal(findJobTargetingPath(jobs, join(ZIM, 'other.zim'), 'z'), undefined)
  assert.equal(findJobTargetingPath(jobs, join(ZIM, 'y.pmtiles'))?.id, 'b')
})

test('isSweepableTmp keeps tmp files of tracked jobs and recently written ones', () => {
  const targets = jobTargetPaths([{ data: { filepath: join(ZIM, 'busy.zim') } }])
  const base = { nowMs: 10 * HOUR, minAgeMs: HOUR, activeTargets: targets }
  assert.equal(isSweepableTmp({ ...base, fullPath: join(ZIM, 'old.zim.tmp'), mtimeMs: 0 }), true)
  assert.equal(isSweepableTmp({ ...base, fullPath: join(ZIM, 'busy.zim.tmp'), mtimeMs: 0 }), false)
  assert.equal(
    isSweepableTmp({ ...base, fullPath: join(ZIM, 'fresh.zim.tmp'), mtimeMs: 9.5 * HOUR }),
    false
  )
  assert.equal(isSweepableTmp({ ...base, fullPath: join(ZIM, 'a.zim'), mtimeMs: 0 }), false)
})

test('shouldPruneOrphanPmtiles skips the new file, tmp, active targets and files newer than the job', () => {
  const dir = resolve('/app/storage/maps/pmtiles')
  const base = {
    keepName: 'r_20260101_z12.pmtiles',
    prefix: 'r_',
    oldFilePath: join(dir, 'r_old.pmtiles'),
    jobStartMs: 1000,
    activeTargets: new Set([join(dir, 'r_20260101_z14.pmtiles')]),
  }
  const at = (entry: string, mtimeMs = 0) =>
    shouldPruneOrphanPmtiles({ ...base, entry, fullPath: join(dir, entry), mtimeMs })
  assert.equal(at('r_20250101_z10.pmtiles'), true)
  assert.equal(at('r_20260101_z12.pmtiles'), false) // just produced
  assert.equal(at('r_20260101_z13.pmtiles.tmp'), false) // being extracted
  assert.equal(at('r_20260101_z14.pmtiles'), false) // another queued/running job's output
  assert.equal(at('r_20260101_z10.pmtiles', 2000), false) // finished by a concurrent job
  assert.equal(at('r_old.pmtiles'), false) // handled by the guarded old-file delete
  assert.equal(at('other_2025.pmtiles'), false)
})

test('sweepOrphanTmpFiles deletes only old untracked .tmp files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nomad-sweep-'))
  for (const f of ['old.zim.tmp', 'busy.zim.tmp', 'fresh.zim.tmp', 'keep.zim']) {
    await writeFile(join(dir, f), 'x')
  }
  const now = Date.now()
  const old = new Date(now - 2 * HOUR)
  for (const f of ['old.zim.tmp', 'busy.zim.tmp', 'keep.zim']) await utimes(join(dir, f), old, old)

  const deleted = await sweepOrphanTmpFiles(
    [dir, join(dir, 'missing')],
    new Set([resolve(join(dir, 'busy.zim'))]),
    now,
    HOUR
  )
  assert.deepEqual(deleted, [join(dir, 'old.zim.tmp')])
  assert.deepEqual((await readdir(dir)).sort(), ['busy.zim.tmp', 'fresh.zim.tmp', 'keep.zim'])
})

test('isSafeOldContentPath requires the storage root and the resource id prefix', () => {
  assert.equal(isSafeOldContentPath(join(ZIM, 'res_2026-01.zim'), 'res', ZIM), true)
  assert.equal(isSafeOldContentPath(join(ZIM, 'other_2026-01.zim'), 'res', ZIM), false)
  assert.equal(isSafeOldContentPath(resolve('/etc/res_2026-01.zim'), 'res', ZIM), false)
  assert.equal(isSafeOldContentPath(join(ZIM, '..', 'res_x.zim'), 'res', ZIM), false)
})
