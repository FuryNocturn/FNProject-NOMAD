import { seededRng } from '../../lib/rng'
import { type State, aiChoose, aiSing, deal, hasTute, legal, play, result, sing, singTute, singable, stockSize } from './logic'

function playOut(seed: number, d0: 'easy' | 'medium' | 'hard', d1: 'easy' | 'medium' | 'hard') {
  const rng = seededRng(seed)
  let st = deal(rng, seed % 2)
  for (let i = 0; i < 200 && !st.over; i++) {
    st = aiSing(st) ?? st
    if (st.over) break
    st = play(st, aiChoose(st, st.turn === 0 ? d0 : d1, rng))!
  }
  return st
}

test('deal: eight each, 24 left to draw', () => {
  const st = deal(seededRng(1))
  expect(st.hands.map((h) => h.length)).toEqual([8, 8])
  expect(stockSize(st)).toBe(24)
})

test('a full hand without cantes is worth 130 (120 + 10 de últimas)', () => {
  const rng = seededRng(7)
  let st = deal(rng)
  while (!st.over) st = play(st, aiChoose(st, 'medium', rng))!
  expect(st.points[0] + st.points[1]).toBe(130)
})

test('games always finish, with cantes adding 20 or 40', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = playOut(seed, 'medium', 'hard')
    expect(st.over).toBe(true)
    if (st.tute === null) {
      const extra = st.points[0] + st.points[1] - 130
      expect(extra % 20).toBe(0)
    }
    expect([1, 0, -1]).toContain(result(st))
  }
})

test('arrastre: must follow and beat, else trump', () => {
  const st: State = {
    ...deal(seededRng(2)),
    deck: [], muestra: null, trump: 0, leader: 1, turn: 0,
    table: [{ r: 7, s: 2 }],
    hands: [[{ r: 4, s: 2 }, { r: 1, s: 2 }, { r: 5, s: 0 }, { r: 3, s: 1 }], [{ r: 2, s: 3 }]],
  }
  expect(legal(st)).toEqual([{ r: 1, s: 2 }]) // the ace beats the 7; the 4 does not
  const noSuit: State = { ...st, table: [{ r: 7, s: 3 }] }
  expect(legal(noSuit)).toEqual([{ r: 5, s: 0 }]) // must trump
  const free: State = { ...st, deck: [{ r: 6, s: 1 }] }
  expect(legal(free)).toHaveLength(4) // free play while cards remain
})

test('cantes: 20 in a plain suit, 40 in trumps, only after winning a trick, once per suit', () => {
  const base: State = {
    ...deal(seededRng(3)), trump: 1, turn: 0, table: [], canSing: true,
    hands: [[{ r: 12, s: 1 }, { r: 11, s: 1 }, { r: 12, s: 3 }, { r: 11, s: 3 }], [{ r: 4, s: 0 }]],
    points: [0, 0],
  }
  expect(singable(base, 0)).toEqual([1, 3])
  const st = sing(base, 0, 1)!
  expect(st.points[0]).toBe(40)
  expect(singable(st, 0)).toEqual([]) // one cante per trick won
  expect(sing({ ...base, canSing: false }, 0, 3)).toBeNull()
  expect(sing({ ...st, canSing: true }, 0, 1)).toBeNull() // already sung
  expect(sing({ ...st, canSing: true }, 0, 3)!.points[0]).toBe(60)
})

test('tute: four kings win the hand outright', () => {
  const kings = [0, 1, 2, 3].map((s) => ({ r: 12, s }))
  expect(hasTute(kings)).toBe(true)
  const st: State = { ...deal(seededRng(4)), turn: 1, canSing: true, hands: [[{ r: 4, s: 0 }], kings] }
  const done = singTute(st, 1)!
  expect(done.over).toBe(true)
  expect(result(done)).toBe(-1)
})

test('medium beats a random player most of the time', () => {
  let won = 0
  for (let seed = 1; seed <= 50; seed++) if (result(playOut(seed, 'easy', 'medium')) === -1) won++
  expect(won).toBeGreaterThan(30)
})
