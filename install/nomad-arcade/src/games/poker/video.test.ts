import { seededRng } from '../../lib/rng'
import { parse } from './hands.test'
import { dealRound, draw, payline, payout } from './video'

test('pay lines, including the jacks-or-better cut-off', () => {
  expect(payline(parse('10h Jh Qh Kh Ah'))).toBe('royalFlush')
  expect(payline(parse('9h 10h Jh Qh Kh'))).toBe('straightFlush')
  expect(payline(parse('Js Jd 4h 7c 2s'))).toBe('jacksOrBetter')
  expect(payline(parse('10s 10d 4h 7c 2s'))).toBeNull()
  expect(payline(parse('3s 3d 4h 4c 2s'))).toBe('twoPair')
})

test('payouts scale with the bet; a five-coin royal pays 4000', () => {
  expect(payout(parse('Qs Qd Qh 7c 7s'), 3)).toBe(27)
  expect(payout(parse('10h Jh Qh Kh Ah'), 4)).toBe(1000)
  expect(payout(parse('10h Jh Qh Kh Ah'), 5)).toBe(4000)
  expect(payout(parse('As Kd 9h 7c 2s'), 5)).toBe(0)
})

test('drawing keeps held cards and replaces the rest from the deck', () => {
  const r = dealRound(seededRng(1), 1)
  const held = [true, false, true, false, false]
  const done = draw({ ...r, held })
  expect(done.hand[0]).toEqual(r.hand[0])
  expect(done.hand[2]).toEqual(r.hand[2])
  expect(done.hand[1]).toEqual(r.deck[0])
  expect(new Set(done.hand.map((c) => `${c.r}${c.s}`)).size).toBe(5)
})
