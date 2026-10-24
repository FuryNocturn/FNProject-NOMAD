/**
 * Runs async tasks one at a time, in call order. A failing task does not block the next one.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task)
    tail = result.catch(() => {})
    return result
  }
}

/**
 * Coalesces requests for the same task on a serial queue: a request made while a run is
 * waiting to start joins that run; a request made while one is running queues exactly one
 * more run afterwards (so changes made during the current run are always picked up).
 */
export function createCoalescedTask<T>(run: ReturnType<typeof createSerialQueue>) {
  let pending: Promise<T> | null = null
  return function request(task: () => Promise<T>): Promise<T> {
    if (pending) return pending
    const current = run(() => {
      pending = null
      return task()
    })
    pending = current
    return current
  }
}
