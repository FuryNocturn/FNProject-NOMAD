import { seededRng } from '../../lib/rng'
import { type Board, type Player, aiMove, count, isOver, legalMoves, newBoard, other, play } from './logic'

test('the opening has four legal moves for black', () => {
  expect(legalMoves(newBoard(), 1).sort((a, b) => a - b)).toEqual([19, 26, 37, 44])
})

test('playing flips the sandwiched discs', () => {
  const b = play(newBoard(), 19, 1)!
  expect(b[19]).toBe(1)
  expect(b[27]).toBe(1)
  expect(count(b, 1)).toBe(4)
  expect(count(b, 2)).toBe(1)
  expect(play(newBoard(), 0, 1)).toBeNull()
})

test('medium takes a corner; hard prefers a move that wins the game outright', () => {
  // White can take corner 0 (flipping 9), or play 8 and flip 9 and 10, which leaves black no discs.
  const b: Board = Array(64).fill(0)
  b[9] = 1
  b[18] = 2
  b[10] = 1
  b[11] = 2
  expect(aiMove(b, 2, 'medium', seededRng(1))).toBe(0)
  expect(aiMove(b, 2, 'hard', seededRng(1))).toBe(8)
  expect(count(play(b, 8, 2)!, 1)).toBe(0)
})

test('AI against AI always plays legal moves until the game ends', () => {
  const rng = seededRng(5)
  let b = newBoard()
  let p: Player = 1
  for (let turn = 0; turn < 130 && !isOver(b); turn++) {
    const m = aiMove(b, p, p === 1 ? 'hard' : 'easy', rng)
    if (m >= 0) {
      expect(legalMoves(b, p)).toContain(m)
      b = play(b, m, p)!
    }
    p = other(p)
  }
  expect(isOver(b)).toBe(true)
  expect(count(b, 1) + count(b, 2)).toBeGreaterThan(4)
})
