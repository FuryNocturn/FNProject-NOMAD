import type { Card } from '../../lib/cards'
import { seededRng } from '../../lib/rng'
import { type State, canSplit, deal, double, hit, newState, split, stand, total } from './logic'

const c = (r: number, s = 0): Card => ({ r, s })
/** A state whose next cards come out in the given order (the shoe is dealt from the end). */
function rigged(order: number[], chips = 1000): State {
  const st = newState(seededRng(1), chips)
  return { ...st, shoe: [...st.shoe.slice(0, 200), ...order.map((r) => c(r)).reverse()] }
}

test('totals count aces as 1 or 11', () => {
  expect(total([c(14), c(6)])).toEqual({ value: 17, soft: true })
  expect(total([c(14), c(6), c(10)])).toEqual({ value: 17, soft: false })
  expect(total([c(14), c(14), c(9)])).toEqual({ value: 21, soft: true })
  expect(total([c(13), c(12), c(5)]).value).toBe(25)
})

test('a natural pays 3:2 straight away', () => {
  // Deal order: player, player, dealer, dealer.
  const st = deal(rigged([14, 13, 9, 7]), 100, seededRng(2))
  expect(st.phase).toBe('done')
  expect(st.results).toEqual([{ outcome: 'blackjack', delta: 150 }])
  expect(st.chips).toBe(1150)
  // An odd bet is paid in whole chips: 25 pays 37.
  expect(deal(rigged([14, 13, 9, 7]), 25, seededRng(2)).results).toEqual([{ outcome: 'blackjack', delta: 37 }])
})

test('dealer draws to 17 and busts; standing on 18 wins', () => {
  let st = deal(rigged([10, 8, 10, 6, 9]), 100, seededRng(3))
  st = stand(st)
  expect(total(st.dealer).value).toBe(25)
  expect(st.results[0]).toEqual({ outcome: 'win', delta: 100 })
  expect(st.chips).toBe(1100)
})

test('busting loses even if the dealer busts later', () => {
  let st = deal(rigged([10, 6, 10, 6, 9]), 50, seededRng(4))
  st = hit(st)
  expect(st.phase).toBe('done')
  expect(st.results[0].outcome).toBe('lose')
  expect(st.chips).toBe(950)
})

test('double takes one card for twice the bet', () => {
  let st = deal(rigged([6, 5, 10, 7, 10]), 100, seededRng(5))
  st = double(st)
  expect(st.hands[0].cards).toHaveLength(3)
  expect(st.results[0]).toEqual({ outcome: 'win', delta: 200 })
  expect(st.chips).toBe(1200)
})

test('splitting plays two hands; a 21 after a split is not a blackjack', () => {
  // Player 8,8; dealer 10,7; split cards: first hand gets 3 then stands... then second gets K.
  let st = deal(rigged([8, 8, 10, 7, 3, 13]), 100, seededRng(6))
  expect(canSplit(st)).toBe(true)
  st = split(st)
  expect(st.hands.map((h) => total(h.cards).value)).toEqual([11, 18])
  st = stand(st) // 11 vs 17: loses
  st = stand(st) // 18 vs 17: wins
  expect(st.results.map((r) => r.outcome)).toEqual(['lose', 'win'])
  expect(st.chips).toBe(1000)
  let aces = deal(rigged([14, 14, 10, 7, 13, 5]), 100, seededRng(7))
  aces = split(aces)
  expect(aces.phase).toBe('done')
  expect(aces.results[0]).toEqual({ outcome: 'win', delta: 100 })
})
