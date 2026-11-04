import { seededRng } from '../../lib/rng'
import { BAR, type Board, OFF, type Player, aiPlay, initialBoard, legalPlays, move, nextMoves, pips, roll, winValue } from './logic'

const empty = (): Board => ({ pts: Array(24).fill(0), bar: [0, 0], off: [0, 0] })
const has = (all: { from: number; to: number }[][], from: number, to: number) => all.some((p) => p.some((m) => m.from === from && m.to === to))

test('the starting position has 167 pips each', () => {
  expect(pips(initialBoard(), 0)).toBe(167)
  expect(pips(initialBoard(), 1)).toBe(167)
})

test('3-1 can make the five point', () => {
  const all = legalPlays(initialBoard(), 0, [3, 1])
  expect(all.some((p) => p.map((m) => `${m.from}>${m.to}`).sort().join() === ['5>4', '7>4'].sort().join())).toBe(true)
})

test('a checker on the bar must enter first, and only on open points', () => {
  const b = empty()
  b.bar[0] = 1
  b.pts[10] = 3
  b.pts[23 - 2] = -2 // entering with a 3 lands on point 22 (index 21): blocked
  const all = legalPlays(b, 0, [3, 5])
  expect(all.every((p) => p[0].from === BAR)).toBe(true)
  expect(has(all, BAR, 21)).toBe(false)
  expect(has(all, BAR, 19)).toBe(true)
})

test('bearing off: exact die, or a higher die from the highest point', () => {
  const b = empty()
  b.pts[2] = 1 // the 3 point
  b.pts[0] = 14
  b.off[0] = 0
  // A 6 bears off from the 3 point because nothing is higher.
  expect(has(legalPlays(b, 0, [6, 6]), 2, OFF)).toBe(true)
  const c = empty()
  c.pts[5] = 1
  c.pts[1] = 14
  // Nothing bears off from the 2 point while the 6 point is occupied.
  const all = legalPlays(c, 0, [5, 4])
  expect(has(all, 5, 0)).toBe(true)
  expect(nextMoves(all, []).some((m) => m.from === 1)).toBe(false)
})

test('when only one die can be played, it must be the higher one', () => {
  const b = empty()
  b.pts[12] = 1
  // Black wall: the checker on 13 can move 6 (to 7) or 1 (to 12) but not both.
  for (const i of [5, 10, 11, 9]) b.pts[i] = -2
  b.pts[6] = 0
  const all = legalPlays(b, 0, [6, 1])
  expect(all.every((p) => p.length === 1 && p[0].die === 6)).toBe(true)
})

test('hitting a blot sends it to the bar', () => {
  const b = initialBoard()
  b.pts[3] = -1
  const after = move(b, 0, { from: 5, to: 3, die: 2 })
  expect(after.bar[1]).toBe(1)
  expect(after.pts[3]).toBe(1)
})

test('next moves follow any order of a legal play', () => {
  const all = legalPlays(initialBoard(), 0, [3, 1])
  const first = nextMoves(all, [])
  expect(first.length).toBeGreaterThan(2)
  const after = nextMoves(all, [{ from: 7, to: 4, die: 3 }])
  expect(after.some((m) => m.from === 5 && m.to === 4)).toBe(true)
})

test('gammon and backgammon', () => {
  const b = empty()
  b.off[0] = 15
  b.pts[20] = -15
  expect(winValue(b, 0)).toBe(2)
  b.pts[20] = -14
  b.pts[2] = -1 // in player 0's home board
  expect(winValue(b, 0)).toBe(3)
  b.off[1] = 1
  expect(winValue(b, 0)).toBe(1)
})

test('computer games always finish with a legal winner', () => {
  const rng = seededRng(11)
  for (const level of ['easy', 'medium', 'hard'] as const) {
    let b = initialBoard()
    let p: Player = 0
    let turns = 0
    while (!winValue(b, 0) && !winValue(b, 1) && turns < 400) {
      const dice = roll(rng)
      const plays = legalPlays(b, p, dice)
      const chosen = aiPlay(b, p, dice, level, rng)
      if (plays[0].length) expect(plays.some((x) => x.length === chosen.length)).toBe(true)
      for (const m of chosen) b = move(b, p, m)
      const total = b.pts.reduce((t, v) => t + Math.abs(v), 0) + b.bar[0] + b.bar[1] + b.off[0] + b.off[1]
      expect(total).toBe(30)
      p = (1 - p) as Player
      turns++
    }
    expect(winValue(b, 0) || winValue(b, 1)).toBeGreaterThan(0)
  }
}, 30_000)

test('the hard computer beats the easy one more often than not', () => {
  const rng = seededRng(5)
  let hardWins = 0
  for (let g = 0; g < 10; g++) {
    let b = initialBoard()
    let p: Player = (g % 2) as Player
    while (!winValue(b, 0) && !winValue(b, 1)) {
      const dice = roll(rng)
      for (const m of aiPlay(b, p, dice, p === 0 ? 'hard' : 'easy', rng)) b = move(b, p, m)
      p = (1 - p) as Player
    }
    if (winValue(b, 0)) hardWins++
  }
  expect(hardWins).toBeGreaterThanOrEqual(6)
}, 30_000)
