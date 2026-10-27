import { seededRng } from '../../lib/rng'
import { type Board, COLS, aiMove, drop, emptyBoard, landingRow, outcome, type Player } from './logic'

/** Plays the given columns alternately starting with player 1. */
function play(cols: number[]): Board {
  let board = emptyBoard()
  cols.forEach((c, i) => {
    board = drop(board, c, ((i % 2) + 1) as Player)!
  })
  return board
}

test('pieces stack from the bottom and a full column refuses more', () => {
  let board = emptyBoard()
  expect(landingRow(board, 0)).toBe(5)
  for (let i = 0; i < 6; i++) board = drop(board, 0, 1)!
  expect(drop(board, 0, 2)).toBeNull()
})

test('detects horizontal, vertical and diagonal wins', () => {
  expect(outcome(play([0, 0, 1, 1, 2, 2, 3]))).toMatchObject({ winner: 1 })
  expect(outcome(play([0, 1, 0, 1, 0, 1, 0]))).toMatchObject({ winner: 1 })
  // Diagonal for player 1 going up to the right.
  expect(outcome(play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]))).toMatchObject({ winner: 1 })
  expect(outcome(play([0, 1]))).toBeNull()
})

test('the AI takes an immediate win and blocks an immediate loss', () => {
  const rng = seededRng(7)
  // Player 2 has three in column 6; player 1 to move must block.
  const threat = play([0, 6, 1, 6, 0, 6])
  for (const d of ['medium', 'hard'] as const) expect(aiMove(threat, 1, d, rng)).toBe(6)
  // Player 1 has three on the bottom row (0,1,2) and wins in column 3.
  const win = play([0, 6, 1, 6, 2, 5])
  for (const d of ['medium', 'hard'] as const) expect(aiMove(win, 1, d, rng)).toBe(3)
})

test('the AI always returns a playable column', () => {
  const rng = seededRng(3)
  const board = play([0, 0, 0, 0, 0, 0])
  for (let i = 0; i < 20; i++) {
    const c = aiMove(board, 1, 'easy', rng)
    expect(c).toBeGreaterThanOrEqual(1)
    expect(c).toBeLessThan(COLS)
  }
})
