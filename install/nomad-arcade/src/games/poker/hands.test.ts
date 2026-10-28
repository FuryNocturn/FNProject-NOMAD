import type { Card } from '../../lib/cards'
import { bestHoldem, bestOmaha, score5 } from './hands'

/** Parses "As Kd 10h 2c": rank then suit letter s/h/d/c. */
export const parse = (txt: string): Card[] =>
  txt.split(' ').map((t) => ({
    r: { J: 11, Q: 12, K: 13, A: 14 }[t.slice(0, -1)] ?? Number(t.slice(0, -1)),
    s: 'shdc'.indexOf(t.slice(-1)),
  }))

test('each category is recognised and ranks above the one below', () => {
  const hands = [
    ['highCard', 'As Kd 9h 7c 2s'],
    ['pair', '9s 9d Ah 7c 2s'],
    ['twoPair', '9s 9d 7h 7c 2s'],
    ['trips', '9s 9d 9h 7c 2s'],
    ['straight', '5s 4d 3h 2c As'],
    ['flush', 'Ks 9s 7s 4s 2s'],
    ['fullHouse', '9s 9d 9h 2c 2s'],
    ['quads', '9s 9d 9h 9c 2s'],
    ['straightFlush', '9h 8h 7h 6h 5h'],
  ] as const
  let prev = -1
  for (const [cat, txt] of hands) {
    const v = score5(parse(txt))
    expect(v.category).toBe(cat)
    expect(v.score).toBeGreaterThan(prev)
    prev = v.score
  }
})

test('kickers break ties; the wheel is the lowest straight', () => {
  expect(score5(parse('As Ad Kh 7c 2s')).score).toBeGreaterThan(score5(parse('Ah Ac Qh 7d 2d')).score)
  expect(score5(parse('5s 4d 3h 2c As')).score).toBeLessThan(score5(parse('6s 5d 4h 3c 2s')).score)
  expect(score5(parse('Ks Qd Jh 10c 9s')).score).toBe(score5(parse('Kh Qc Jd 10s 9h')).score)
})

test("hold'em uses the best five of seven", () => {
  expect(bestHoldem(parse('Ah Kh'), parse('Qh Jh 10h 2c 3d')).category).toBe('straightFlush')
  expect(bestHoldem(parse('2c 7d'), parse('As Ad Ah Ac Ks')).category).toBe('quads')
})

test('omaha must use exactly two hole cards and three from the board', () => {
  // Four hearts on the board but only one in hand: no flush in Omaha (Hold'em would have one).
  const hole = parse('Ah Ks Qd Jc')
  const board = parse('2h 5h 8h 9h Kd')
  expect(bestHoldem(hole.slice(0, 2), board).category).toBe('flush')
  expect(bestOmaha(hole, board).category).toBe('pair')
})
