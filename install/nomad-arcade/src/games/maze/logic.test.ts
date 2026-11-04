import { seededRng } from '../../lib/rng'
import { type State, carve, newLevel, open, step, towards } from './logic'

test('every open tile of a carved maze is reachable', () => {
  const rng = seededRng(3)
  for (const cells of [7, 10, 12]) {
    const walls = carve(cells, rng)
    const size = 2 * cells + 1
    const st = { size, walls }
    const seen = new Set([size + 1])
    const queue = [size + 1]
    for (let k = 0; k < queue.length; k++)
      for (const d of [-size, size, -1, 1]) {
        const j = queue[k] + d
        if (!walls[j] && !seen.has(j)) {
          seen.add(j)
          queue.push(j)
        }
      }
    expect(seen.size).toBe(walls.filter((w) => !w).length)
    expect(open(st, 0, 0)).toBe(false)
  }
})

test('the path finder steps towards the target', () => {
  const st = newLevel(1, seededRng(1))
  const d = towards(st, 1, 1, st.size - 2, st.size - 2)
  expect(['down', 'right']).toContain(d)
})

test('walking onto a gem collects it', () => {
  let st: State = { ...newLevel(1, seededRng(2)), guards: [] }
  const first = st.walls[st.size + 2] ? 'down' : 'right'
  const gem = first === 'down' ? 2 * st.size + 1 : st.size + 2
  st = { ...st, gems: [gem, 999] }
  for (let k = 0; k < 30; k++) st = step(st, first, 1 / 60, seededRng(2))
  expect(st.gems).toEqual([999])
  expect(st.score).toBe(10)
})

test('a guard on the player costs a life and the last gem clears the level', () => {
  const base = newLevel(1, seededRng(4))
  const caught = step({ ...base, guards: [{ r: 1, c: 1, dir: null, progress: 0 }] }, null, 1 / 60, seededRng(4))
  expect(caught.lives).toBe(2)
  expect(caught.player).toMatchObject({ r: 1, c: 1 })
  const cleared = step({ ...base, guards: [], gems: [base.size + 1] }, null, 1 / 60, seededRng(4))
  expect(cleared.cleared).toBe(true)
})
