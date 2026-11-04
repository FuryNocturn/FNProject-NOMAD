import { seededRng } from '../../lib/rng'
import type { SCard } from '../../lib/spanish'
import { type State, aiDiscard, aiDraw, arrange, canClose, close, drawDiscard, isChinchon, newMatch, nextRound } from './logic'

const c = (r: number, s: number): SCard => ({ r, s })
const J = (s = 0): SCard => ({ r: 0, s })

test('arrange finds groups and runs, leaving the fewest points', () => {
  const a = arrange([c(5, 0), c(5, 1), c(5, 2), c(1, 3), c(2, 3), c(3, 3), c(12, 0)])
  expect(a.points).toBe(10)
  expect(a.loose).toEqual([c(12, 0)])
  // A run through 7 and sota is consecutive in the 40-card deck.
  expect(arrange([c(6, 1), c(7, 1), c(10, 1)]).points).toBe(0)
  // A card that fits a group and a run goes where it saves most.
  expect(arrange([c(4, 0), c(4, 1), c(4, 2), c(5, 0), c(6, 0)]).points).toBe(8) // 4-5-6 run, two 4s loose
})

test('jokers fill groups and runs, and count 25 when left over', () => {
  expect(arrange([c(3, 0), c(3, 1), J()]).points).toBe(0)
  expect(arrange([c(3, 2), c(5, 2), J()]).points).toBe(0)
  expect(arrange([c(1, 0), J()]).points).toBe(26)
  expect(arrange([c(1, 0), c(2, 0), c(3, 0), J()]).points).toBe(0) // spare joker joins the run
})

test('chinchón: seven in sequence in one suit, no joker', () => {
  expect(isChinchon([4, 5, 6, 7, 10, 11, 12].map((r) => c(r, 2)))).toBe(true)
  expect(isChinchon([1, 2, 3, 4, 5, 6, 7].map((r) => c(r, 2)))).toBe(true)
  expect(isChinchon([1, 2, 3, 4, 5, 6, 10].map((r) => c(r, 2)))).toBe(false)
  expect(isChinchon([...[1, 2, 3, 4, 5, 6].map((r) => c(r, 2)), J()])).toBe(false)
})

test('closing: allowed with 5 or less unmatched, -10 with nothing, others add theirs', () => {
  const st0 = newMatch(seededRng(1), 2, 'classic')
  const st: State = {
    ...st0, turn: 0, phase: 'discard',
    hands: [
      [c(1, 0), c(1, 1), c(1, 2), c(5, 3), c(6, 3), c(7, 3), c(2, 0), c(12, 2)],
      [c(12, 0), c(11, 1), c(4, 0), c(4, 1), c(4, 2), c(3, 3), c(5, 1)],
    ],
  }
  expect(canClose(st, c(12, 2))).toBe(true) // leaves the 2 unmatched
  expect(canClose(st, c(2, 0))).toBe(false) // leaves the rey: 10
  const done = close(st, c(12, 2))!
  expect(done.round!.added).toEqual([2, 28])
  const perfect: State = { ...st, hands: [[...st.hands[0].slice(0, 6), c(12, 2), c(10, 0)], st.hands[1]] }
  expect(canClose(perfect, c(12, 2))).toBe(false)
  const zero: State = { ...st, hands: [[c(1, 0), c(1, 1), c(1, 2), c(5, 3), c(6, 3), c(7, 3), c(10, 3), c(12, 2)], st.hands[1]] }
  expect(close(zero, c(12, 2))!.round!.added[0]).toBe(-10)
})

test('a card taken from the discard pile cannot be thrown straight back', () => {
  let st = newMatch(seededRng(2), 2, 'classic')
  const top = st.discard.at(-1)!
  st = drawDiscard(st)!
  expect(canClose(st, top)).toBe(false)
})

test('over 100 is out; the last player in wins', () => {
  const st0 = newMatch(seededRng(3), 3, 'classic')
  const st: State = {
    ...st0, turn: 0, phase: 'discard', scores: [0, 95, 99],
    hands: [[c(1, 0), c(1, 1), c(1, 2), c(5, 3), c(6, 3), c(7, 3), c(2, 0), c(12, 2)], [c(12, 0), c(11, 1)], [c(1, 3)]],
  }
  const done = close(st, c(12, 2))!
  expect(done.out).toEqual([false, true, false])
  expect(done.winner).toBeNull()
  const last = close({ ...st, scores: [0, 95, 100] }, c(12, 2))!
  expect(last.winner).toBe(0)
})

test('bots play whole matches to the end in both variants', () => {
  for (const variant of ['classic', 'jokers'] as const) {
    for (let seed = 1; seed <= 4; seed++) {
      const rng = seededRng(seed)
      let st = newMatch(rng, 4, variant)
      let guard = 0
      while (st.winner === null && guard++ < 20000) {
        if (st.round) {
          st = nextRound(st, rng)
          continue
        }
        const d = (['easy', 'medium', 'hard', 'medium'] as const)[st.turn]
        st = st.phase === 'draw' ? aiDraw(st, d, rng) : aiDiscard(st, d, rng)
        const total = st.hands.flat().length + st.deck.length + st.discard.length
        expect(total).toBe(variant === 'jokers' ? 42 : 40)
      }
      expect(st.winner).not.toBeNull()
    }
  }
})
