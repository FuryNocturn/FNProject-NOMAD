import { seededRng } from '../../lib/rng'
import { type Board, aiMove, emptyBoard, other, outcome, perfectMove, type Player } from './logic'

const b = (s: string): Board => [...s].map((c) => (c === '.' ? null : (c as Player)))

test('detects a win with its line, and a draw', () => {
  expect(outcome(b('XXX.OO...'))).toEqual({ winner: 'X', line: [0, 1, 2] })
  expect(outcome(b('XOXXOOOXX'))).toEqual({ winner: 'draw' })
  expect(outcome(b('XO.......'))).toBeNull()
})

test('perfect move takes a win and blocks a loss', () => {
  expect(perfectMove(b('OO.XX....'), 'O')).toBe(2)
  expect(perfectMove(b('XX.O.....'), 'O')).toBe(2)
})

test('hard AI never loses, whatever the opponent plays', () => {
  // Exhaustive: try every possible human line against the hard AI moving second.
  const rng = seededRng(1)
  const explore = (board: Board, human: Player): void => {
    const o = outcome(board)
    if (o) {
      expect(o.winner).not.toBe(human)
      return
    }
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue
      const next = [...board]
      next[i] = human
      if (!outcome(next)) next[aiMove(next, other(human), 'hard', rng)] = other(human)
      explore(next, human)
    }
  }
  explore(emptyBoard(), 'X')
})
