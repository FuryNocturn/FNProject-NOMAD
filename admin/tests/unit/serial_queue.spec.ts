import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { createCoalescedTask, createSerialQueue } from '../../app/utils/serial_queue.js'

const tick = () => new Promise((r) => setTimeout(r, 5))

test('serial queue runs tasks one at a time and survives a failure', async () => {
  const run = createSerialQueue()
  const log: string[] = []
  let running = 0
  const task = (name: string, fail = false) => async () => {
    running++
    assert.equal(running, 1)
    log.push(`start ${name}`)
    await tick()
    log.push(`end ${name}`)
    running--
    if (fail) throw new Error(name)
    return name
  }
  const results = await Promise.allSettled([run(task('a')), run(task('b', true)), run(task('c'))])
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c'])
  assert.equal(results[1].status, 'rejected')
  assert.deepEqual(results[2], { status: 'fulfilled', value: 'c' })
})

test('coalesced task: requests during a run trigger exactly one more run', async () => {
  const run = createSerialQueue()
  const rebuild = createCoalescedTask<number>(run)
  let runs = 0
  const task = async () => {
    await tick()
    return ++runs
  }
  const first = rebuild(task)
  await new Promise((r) => setTimeout(r, 1)) // first run is now in progress
  const second = rebuild(task)
  const third = rebuild(task)
  assert.deepEqual(await Promise.all([first, second, third]), [1, 2, 2])
  assert.equal(runs, 2)
  assert.equal(await rebuild(task), 3)
})
