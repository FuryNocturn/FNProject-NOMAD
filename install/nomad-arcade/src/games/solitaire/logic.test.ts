import { seededRng } from '../../lib/rng'
import { type Card, type State, autoStep, canAutoFinish, deal, drawCards, isWon, move, toFoundation } from './logic'

const c = (s: number, r: number, up = true): Card => ({ s, r, up })
const empty = (): State => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  draw: 1,
  moves: 0,
})

test('deal lays out 28 tableau cards, top ones face up, and 24 in the stock', () => {
  const st = deal(seededRng(1), 1)
  expect(st.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
  expect(st.tableau.every((p) => p[p.length - 1].up && p.slice(0, -1).every((x) => !x.up))).toBe(true)
  expect(st.stock).toHaveLength(24)
  const all = [...st.stock, ...st.tableau.flat()].map((x) => `${x.s}-${x.r}`)
  expect(new Set(all).size).toBe(52)
})

test('drawing moves 1 or 3 cards and recycles the waste when the stock runs out', () => {
  let st = deal(seededRng(2), 3)
  st = drawCards(st)
  expect(st.waste).toHaveLength(3)
  expect(st.stock).toHaveLength(21)
  for (let i = 0; i < 7; i++) st = drawCards(st)
  expect(st.stock).toHaveLength(0)
  st = drawCards(st)
  expect(st.stock).toHaveLength(24)
  expect(st.waste).toHaveLength(0)
  expect(st.stock.every((x) => !x.up)).toBe(true)
})

test('tableau accepts alternating colours one rank lower, and only kings on empty piles', () => {
  const st = empty()
  st.tableau[0] = [c(0, 8)] // 8♠
  st.tableau[1] = [c(1, 7)] // 7♥ -> onto 8♠
  st.tableau[2] = [c(3, 7)] // 7♣ (same colour) is refused
  st.tableau[3] = [c(2, 12)] // Q♦ cannot go to an empty pile
  expect(move(st, { k: 'tab', i: 1 }, { k: 'tab', i: 0 })?.tableau[0]).toHaveLength(2)
  expect(move(st, { k: 'tab', i: 2 }, { k: 'tab', i: 0 })).toBeNull()
  expect(move(st, { k: 'tab', i: 3 }, { k: 'tab', i: 4 })).toBeNull()
})

test('moving a run uncovers and turns the card below', () => {
  const st = empty()
  st.tableau[0] = [c(0, 3, false), c(1, 9), c(0, 8)]
  st.tableau[1] = [c(3, 10)]
  const next = move(st, { k: 'tab', i: 0, index: 1 }, { k: 'tab', i: 1 })!
  expect(next.tableau[1].map((x) => x.r)).toEqual([10, 9, 8])
  expect(next.tableau[0]).toEqual([c(0, 3, true)])
})

test('foundations build up by suit from the ace', () => {
  const st = empty()
  st.waste = [c(1, 1)]
  st.tableau[0] = [c(1, 2)]
  const a = toFoundation(st, { k: 'waste' })!
  const b = toFoundation(a, { k: 'tab', i: 0 })!
  expect(b.foundations.find((p) => p.length)?.map((x) => x.r)).toEqual([1, 2])
  expect(toFoundation(empty(), { k: 'tab', i: 0 })).toBeNull()
})

test('a fully uncovered game finishes automatically', () => {
  const st = empty()
  // Each suit's cards stacked so the ace is on top of its pile.
  for (let s = 0; s < 4; s++) for (let r = 13; r >= 1; r--) st.tableau[s].push(c(s, r))
  expect(canAutoFinish(st)).toBe(true)
  let cur: State | null = st
  let last = st
  while (cur) {
    last = cur
    cur = autoStep(cur)
  }
  expect(isWon(last)).toBe(true)
})
