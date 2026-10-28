import { seededRng } from '../../lib/rng'
import { type Table, act, botAction, newTable, startHand } from './table'
import { parse } from './hands.test'

const chips = (t: Table) => t.seats.reduce((s, x) => s + x.stack + (t.awards ? 0 : x.total), 0)

test('blinds are posted and the player after the big blind acts first', () => {
  const t = startHand(newTable('holdem'), seededRng(1))
  // Dealer moves to seat 0, so seat 1 is SB, seat 2 BB and seat 3 acts.
  expect(t.dealer).toBe(0)
  expect(t.seats.map((s) => s.bet)).toEqual([0, 10, 20, 0])
  expect(t.toAct).toBe(3)
  expect(t.seats.every((s) => s.hole.length === 2)).toBe(true)
  expect(startHand(newTable('omaha'), seededRng(1)).seats[0].hole).toHaveLength(4)
})

test('everyone folding to a raise gives the pot to the raiser', () => {
  let t = startHand(newTable('holdem'), seededRng(2))
  t = act(t, { type: 'raise', to: 60 }) // seat 3
  t = act(t, { type: 'fold' }) // seat 0
  t = act(t, { type: 'fold' }) // seat 1 (SB)
  t = act(t, { type: 'fold' }) // seat 2 (BB)
  expect(t.awards).toEqual([{ seat: 3, amount: 90, hand: null }])
  expect(t.seats[3].stack).toBe(1030)
  expect(chips(t)).toBe(4000)
})

test('checking round to round reaches the river and a showdown', () => {
  let t = startHand(newTable('holdem'), seededRng(3))
  t = act(t, { type: 'call' })
  t = act(t, { type: 'call' })
  t = act(t, { type: 'call' })
  t = act(t, { type: 'check' })
  expect(t.street).toBe('flop')
  expect(t.board).toHaveLength(3)
  while (!t.awards) t = act(t, { type: 'check' })
  expect(t.board).toHaveLength(5)
  expect(t.street).toBe('showdown')
  expect(chips(t)).toBe(4000)
})

test('side pots: a short all-in only wins what it matched', () => {
  let t = newTable('holdem', 3, 1000)
  t.seats[0].stack = 100
  t = startHand(t, seededRng(4)) // dealer seat 0, SB seat 1, BB seat 2, seat 0 acts first
  // Rig the cards: seat 0 has aces, seat 1 kings, seat 2 nothing; the board helps nobody.
  t.seats[0].hole = parse('As Ah')
  t.seats[1].hole = parse('Ks Kh')
  t.seats[2].hole = parse('2c 7d')
  t.deck = parse('4c Jd 9s 8c 3d') // dealt from the end: 3d 8c 9s, then Jd, then 4c
  t = act(t, { type: 'raise', to: 100 }) // seat 0 all-in
  t = act(t, { type: 'raise', to: 400 }) // seat 1
  t = act(t, { type: 'call' }) // seat 2
  while (!t.awards) t = act(t, { type: 'check' })
  const won = Object.fromEntries(t.awards.map((a) => [a.seat, a.amount]))
  expect(won).toEqual({ 0: 300, 1: 600 }) // main pot 3 x 100, side pot 2 x 300
  expect(t.seats.map((s) => s.stack)).toEqual([300, 1200, 600])
})

test('computer players play many hands without losing or creating chips', () => {
  const rng = seededRng(5)
  let t = newTable('holdem')
  for (let hand = 0; hand < 12; hand++) {
    t = startHand(t, rng)
    if (t.seats.filter((s) => !s.out).length < 2) break
    for (let guard = 0; !t.awards && guard < 200; guard++) t = act(t, botAction(t, rng))
    expect(t.awards).not.toBeNull()
    expect(t.seats.reduce((s, x) => s + x.stack, 0)).toBe(4000)
  }
})
