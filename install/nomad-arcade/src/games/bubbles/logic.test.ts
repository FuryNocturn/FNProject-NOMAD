import { seededRng } from '../../lib/rng'
import { COLS, type State, centre, land, neighbours, newLevel, rowLen, shoot, step } from './logic'

const empty = (rows: (number | null)[][]): State => ({ ...newLevel(1, seededRng(1)), rows, shots: 0 })
const row = (vals: (number | null)[]) => Array.from({ length: COLS }, (_, c) => vals[c] ?? null)

test('hex neighbours depend on the row offset', () => {
  const st = { parity: 0 as const }
  expect(neighbours(st, 1, 0).sort()).toEqual([[0, 0], [0, 1], [1, 1], [2, 0], [2, 1]].sort())
  expect(rowLen(st, 1)).toBe(COLS - 1)
  expect(neighbours(st, 2, 0).sort()).toEqual([[1, 0], [2, 1], [3, 0]].sort())
})

test('three of a colour pop', () => {
  const st = empty([row([0, 0, 1, 1])])
  // A colour-0 bubble lands just below the pair.
  const after = land(st, centre(st, 1, 0).x, centre(st, 1, 0).y, 0, seededRng(1))
  expect(after.rows[0].slice(0, 2)).toEqual([null, null])
  expect(after.score).toBe(30)
})

test('bubbles cut off from the top fall', () => {
  // Row 0: two 1s; row 1 (shifted) has a 2 that only touches the second 1 and an empty cell.
  const st = empty([row([1, 1, null, 3, 3]), row([null, 2])])
  const after = land(st, centre(st, 1, 0).x, centre(st, 1, 0).y, 1, seededRng(1))
  // The two 1s and the new 1 pop; the 2 below them has nothing holding it.
  expect(after.rows.flat().includes(2)).toBe(false)
  expect(after.rows.flat().filter((v) => v === 3)).toHaveLength(2)
  expect(after.score).toBe(3 * 10 + 20)
})

test('shots bounce off the walls and stick to the ceiling', () => {
  let st = shoot({ ...empty([]), rows: [] }, 0.4, seededRng(2))
  for (let k = 0; k < 200 && st.shot; k++) st = step(st, 1 / 60, seededRng(2))
  expect(st.shot).toBeNull()
  expect(st.rows[0]?.some((v) => v !== null) || st.cleared).toBe(true)
})

test('misses bring the ceiling down', () => {
  let st = empty([row([0, 1, 2, 0, 1, 2, 0, 1, 2, 0])])
  const rows = st.rows.length
  for (let k = 0; k < 6; k++) st = land(st, centre(st, 3, 4).x, centre(st, 3, 4).y + k, k % 3, seededRng(k))
  expect(st.rows.length).toBeGreaterThan(rows)
})
