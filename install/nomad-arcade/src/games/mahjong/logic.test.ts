import { seededRng } from '../../lib/rng'
import { LAYOUT, type State, freeTiles, hint, isWon, newGame, removePair, reshuffle } from './logic'

/** Plays greedily with hints; reshuffles when stuck. */
function solve(st: State, seed: number): State {
  let cur = st
  const rng = seededRng(seed)
  for (let guard = 0; guard < 200 && !isWon(cur); guard++) {
    const h = hint(cur)
    cur = h ? removePair(cur, h[0], h[1])! : reshuffle(cur, rng)
  }
  return cur
}

test('the pyramid has 82 tiles and every face comes in pairs', () => {
  const st = newGame(seededRng(1))
  expect(LAYOUT).toHaveLength(82)
  const counts = new Map<number, number>()
  for (const t of st.tiles) counts.set(t.face, (counts.get(t.face) ?? 0) + 1)
  expect([...counts.values()].every((n) => n % 2 === 0)).toBe(true)
})

test('covered tiles and tiles blocked on both sides are not free', () => {
  const st = newGame(seededRng(2))
  const free = freeTiles(st)
  // Only the two top tiles and the open ends of each row of the base can be free at the start.
  expect(free.some((t) => t.z === 3)).toBe(true)
  expect(free.every((t) => t.z === 3 || t.x === 0 || t.x === 7 || (t.z === 1 && (t.x === 1 || t.x === 6)) || (t.z === 2 && (t.x === 2 || t.x === 5)))).toBe(true)
})

test('pairs must match and be free', () => {
  const st = newGame(seededRng(3))
  const covered = st.tiles.find((t) => t.z === 0 && t.x === 3 && t.y === 3)!
  const twin = st.tiles.find((t) => t.id !== covered.id && t.face === covered.face)!
  expect(removePair(st, covered.id, twin.id)).toBeNull()
})

test('every deal can be cleared, reshuffling when greedy play gets stuck', () => {
  for (let s = 0; s < 5; s++) expect(isWon(solve(newGame(seededRng(s)), s))).toBe(true)
})
