import { seededRng } from '../../lib/rng'
import { trickPoints } from '../../lib/spanish'
import { type State, aiChoose, canSwap, deal, play, result, stockSize, swap } from './logic'

const playOut = (seed: number, difficulty: 'easy' | 'medium' | 'hard') => {
  const rng = seededRng(seed)
  let st = deal(rng)
  for (let i = 0; i < 100 && !st.over; i++) st = play(st, aiChoose(st, difficulty, rng))!
  return st
}

test('deal: three cards each, muestra sets trumps, 33 left to draw', () => {
  const st = deal(seededRng(1))
  expect(st.hands[0]).toHaveLength(3)
  expect(st.hands[1]).toHaveLength(3)
  expect(st.trump).toBe(st.muestra!.s)
  expect(stockSize(st)).toBe(34)
})

test('a whole game deals all 40 cards and the points add up to 120', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const st = playOut(seed, 'medium')
    expect(st.over).toBe(true)
    expect(st.points[0] + st.points[1]).toBe(120)
    expect([1, 0, -1]).toContain(result(st))
  }
})

test('trick: a trump beats the suit led; off-suit loses to the leader', () => {
  const base: State = { ...deal(seededRng(2)), trump: 0, leader: 0, turn: 0, table: [] }
  const withHands = (a: State['hands'][0], b: State['hands'][1]): State => ({ ...base, hands: [a, b] })
  let st = play(withHands([{ r: 1, s: 1 }], [{ r: 2, s: 0 }]), { r: 1, s: 1 })!
  st = play(st, { r: 2, s: 0 })!
  expect(st.last!.winner).toBe(1) // 2 of trumps beats the ace of copas
  expect(st.points[1]).toBe(11)
  st = play(withHands([{ r: 4, s: 2 }], [{ r: 1, s: 3 }]), { r: 4, s: 2 })!
  st = play(st, { r: 1, s: 3 })!
  expect(st.last!.winner).toBe(0) // an off-suit ace does not win
})

test('the winner draws first and the muestra goes to the last drawer', () => {
  const st0 = deal(seededRng(3))
  const st: State = { ...st0, deck: [{ r: 4, s: 1 }], muestra: { r: 12, s: st0.trump } }
  let s = play(st, st.hands[st.turn][0])!
  s = play(s, s.hands[s.turn][0])!
  const w = s.last!.winner
  expect(s.hands[w]).toContainEqual({ r: 4, s: 1 })
  expect(s.hands[1 - w]).toContainEqual({ r: 12, s: st0.trump })
  expect(s.muestra).toBeNull()
})

test('the 7 of trumps swaps for a high muestra, the 2 for a low one', () => {
  const st0 = deal(seededRng(4))
  const high: State = { ...st0, turn: 0, muestra: { r: 12, s: 2 }, trump: 2, hands: [[{ r: 7, s: 2 }, { r: 2, s: 2 }], st0.hands[1]] }
  expect(canSwap(high, 0)).toEqual({ r: 7, s: 2 })
  const swapped = swap(high, 0)!
  expect(swapped.hands[0]).toContainEqual({ r: 12, s: 2 })
  expect(swapped.muestra).toEqual({ r: 7, s: 2 })
  const low: State = { ...high, muestra: { r: 5, s: 2 } }
  expect(canSwap(low, 0)).toEqual({ r: 2, s: 2 })
  expect(canSwap({ ...high, turn: 1 }, 0)).toBeNull()
})

test('medium and hard beat a random player most of the time', () => {
  for (const d of ['medium', 'hard'] as const) {
    let won = 0
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seededRng(seed)
      let st = deal(rng, seed % 2)
      while (!st.over) st = play(st, aiChoose(st, st.turn === 1 ? d : 'easy', rng))!
      if (st.points[1] > 60) won++
    }
    expect(won).toBeGreaterThan(36)
  }
})

test('card points', () => {
  expect([1, 3, 12, 11, 10, 7].map((r) => trickPoints({ r, s: 0 }))).toEqual([11, 10, 4, 3, 2, 0])
})
