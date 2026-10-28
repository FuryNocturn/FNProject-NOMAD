import { seededRng } from '../../lib/rng'
import { type Board, type State, aiMove, apply, initial, legalMoves, winner } from './logic'

const at = (r: number, c: number) => r * 8 + c
const empty = (): Board => Array(64).fill(null)
const st = (board: Board, turn: 'w' | 'b' = 'w'): State => ({ board, turn, quiet: 0 })

test('opening: 12 men each, white has 7 moves, all forward', () => {
  const s = initial()
  expect(s.board.filter((p) => p?.c === 'w')).toHaveLength(12)
  const moves = legalMoves(s)
  expect(moves).toHaveLength(7)
  expect(moves.every((m) => Math.floor(m.path[1] / 8) === 4)).toBe(true)
})

test('capture is compulsory and men cannot capture backwards', () => {
  const b = empty()
  b[at(5, 2)] = { c: 'w', king: false }
  b[at(4, 3)] = { c: 'b', king: false } // forward-right victim
  b[at(6, 1)] = { c: 'b', king: false } // behind: not capturable by a man
  const moves = legalMoves(st(b))
  expect(moves).toEqual([{ path: [at(5, 2), at(3, 4)], captured: [at(4, 3)] }])
})

test('the sequence taking the most pieces is the only legal choice', () => {
  const b = empty()
  b[at(7, 0)] = { c: 'w', king: false }
  b[at(6, 1)] = { c: 'b', king: false }
  b[at(4, 3)] = { c: 'b', king: false } // second jump available after the first
  b[at(3, 0)] = { c: 'w', king: false }
  b[at(2, 1)] = { c: 'b', king: false } // a single capture elsewhere
  const moves = legalMoves(st(b))
  expect(moves).toHaveLength(1)
  expect(moves[0].captured).toEqual([at(6, 1), at(4, 3)])
})

test('kings fly: long moves and captures from a distance, landing anywhere beyond', () => {
  const b = empty()
  b[at(7, 0)] = { c: 'w', king: true }
  b[at(3, 4)] = { c: 'b', king: false }
  const moves = legalMoves(st(b))
  // Jumps the man on e5 from a1 and may land on f6, g7 or h8.
  expect(moves.map((m) => m.path[1]).sort((x, y) => x - y)).toEqual([at(0, 7), at(1, 6), at(2, 5)])
  expect(moves.every((m) => m.captured[0] === at(3, 4))).toBe(true)
})

test('a man reaching the last row is crowned; no pieces left loses', () => {
  const b = empty()
  b[at(1, 2)] = { c: 'w', king: false }
  b[at(7, 7)] = { c: 'b', king: false }
  const after = apply(st(b), { path: [at(1, 2), at(0, 1)], captured: [] })
  expect(after.board[at(0, 1)]).toEqual({ c: 'w', king: true })
  // Black's only man is on its last row and cannot move: black loses.
  expect(winner(after)).toBe('w')
})

test('the AI plays a legal move and makes the compulsory capture', () => {
  const s = initial()
  const m = aiMove(s, 'hard', seededRng(1))
  expect(legalMoves(s)).toContainEqual(m)
  const b = empty()
  b[at(3, 2)] = { c: 'b', king: false }
  b[at(4, 1)] = { c: 'w', king: false } // in front of black (black moves down)
  b[at(7, 6)] = { c: 'w', king: false }
  b[at(0, 1)] = { c: 'b', king: false }
  const black = st(b, 'b')
  expect(aiMove(black, 'medium', seededRng(1)).captured).toEqual([at(4, 1)])
})
