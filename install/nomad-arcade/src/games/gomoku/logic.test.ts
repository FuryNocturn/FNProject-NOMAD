import { seededRng } from '../../lib/rng'
import { type Board, SIZE, aiMove, emptyBoard, outcome } from './logic'

const at = (r: number, c: number) => r * SIZE + c

function board(stones: [number, number, 1 | 2][]): Board {
  const b = emptyBoard()
  for (const [r, c, p] of stones) b[at(r, c)] = p
  return b
}

test('five or more in a row wins, in any direction', () => {
  const row = board([0, 1, 2, 3, 4].map((c) => [7, c, 1]))
  expect(outcome(row, at(7, 2))).toMatchObject({ winner: 1 })
  const diag = board([0, 1, 2, 3, 4].map((k) => [k, 10 - k, 2]))
  expect(outcome(diag, at(2, 8))).toMatchObject({ winner: 2 })
  const four = board([0, 1, 2, 3].map((c) => [7, c, 1]))
  expect(outcome(four, at(7, 3))).toBeNull()
})

test('the first move goes to the centre', () => {
  expect(aiMove(emptyBoard(), 1, 'hard', seededRng(1))).toBe(at(7, 7))
})

test('every level takes a five and stops the opponent’s five', () => {
  const rng = seededRng(4)
  // Machine (2) has four on row 3 with the right end open.
  const win = board([...[3, 4, 5, 6].map((c) => [3, c, 2] as [number, number, 2]), [3, 2, 1], [9, 9, 1], [9, 10, 1]])
  for (const d of ['easy', 'medium', 'hard'] as const) expect(aiMove(win, 2, d, rng)).toBe(at(3, 7))
  // Human (1) has four in a column; the machine has nothing.
  const stop = board([...[5, 6, 7, 8].map((r) => [r, 4, 1] as [number, number, 1]), [4, 4, 2], [0, 14, 2]])
  for (const d of ['easy', 'medium', 'hard'] as const) expect(aiMove(stop, 2, d, rng)).toBe(at(9, 4))
})

test('medium and hard block an open three', () => {
  const rng = seededRng(2)
  const b = board([[7, 6, 1], [7, 7, 1], [7, 8, 1], [6, 6, 2], [8, 9, 2]])
  for (const d of ['medium', 'hard'] as const) expect([at(7, 5), at(7, 9), at(7, 4), at(7, 10)]).toContain(aiMove(b, 2, d, rng))
})

test('a broken four (X X _ X X) is completed', () => {
  const b = board([[2, 2, 2], [2, 3, 2], [2, 5, 2], [2, 6, 2], [10, 10, 1], [11, 11, 1]])
  expect(aiMove(b, 2, 'medium', seededRng(5))).toBe(at(2, 4))
})
