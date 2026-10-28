import { seededRng } from '../../lib/rng'
import { SIZES, closeUnmatched, flip, isWon, newGame } from './logic'

test('each size deals every face exactly twice', () => {
  for (const size of ['small', 'medium', 'large'] as const) {
    const st = newGame(size, seededRng(1))
    expect(st.cards).toHaveLength(SIZES[size].pairs * 2)
    const counts = new Map<string, number>()
    for (const c of st.cards) counts.set(c.face, (counts.get(c.face) ?? 0) + 1)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
  }
})

test('a pair stays matched, a miss stays open until closed, a third flip waits', () => {
  let st = newGame('small', seededRng(2))
  const a = 0
  const b = st.cards.findIndex((c, i) => i !== a && c.face === st.cards[a].face)
  const miss = st.cards.findIndex((c) => c.face !== st.cards[a].face)
  st = flip(flip(st, a), miss)
  expect(st.open).toEqual([a, miss])
  expect(flip(st, b)).toBe(st)
  st = closeUnmatched(st)
  st = flip(flip(st, a), b)
  expect(st.cards[a].matched && st.cards[b].matched).toBe(true)
  expect(st.moves).toBe(2)
})

test('matching every pair wins', () => {
  let st = newGame('small', seededRng(3))
  const done = new Set<number>()
  st.cards.forEach((c, i) => {
    if (done.has(i)) return
    const j = st.cards.findIndex((d, k) => k !== i && d.face === c.face)
    done.add(i).add(j)
    st = flip(flip(st, i), j)
  })
  expect(isWon(st)).toBe(true)
  expect(st.moves).toBe(8)
})
