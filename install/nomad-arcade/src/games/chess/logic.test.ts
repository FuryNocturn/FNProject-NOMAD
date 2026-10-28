import { seededRng } from '../../lib/rng'
import { type Move, type Position, aiMove, initial, legalMoves, makeMove, result } from './logic'

/** Index from algebraic name, e.g. sq('e4') = 36. */
const sq = (n: string) => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0])
const mv = (pos: Position, from: string, to: string, promo?: Move['promo']) => {
  const m = legalMoves(pos).find((x) => x.from === sq(from) && x.to === sq(to) && x.promo === promo)
  if (!m) throw new Error(`illegal ${from}${to}`)
  return makeMove(pos, m)
}
const play = (moves: string) =>
  moves.split(' ').reduce((p, m) => mv(p, m.slice(0, 2), m.slice(2, 4), (m[4] as Move['promo']) || undefined), initial())

/** Perft: number of leaf positions at a depth. Known values for the start position: 20, 400, 8902. */
function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1
  return legalMoves(pos).reduce((n, m) => n + perft(makeMove(pos, m), depth - 1), 0)
}

test('move generation matches the known perft counts', () => {
  expect(perft(initial(), 1)).toBe(20)
  expect(perft(initial(), 2)).toBe(400)
  expect(perft(initial(), 3)).toBe(8902)
})

test("fool's mate is checkmate", () => {
  expect(result(play('f2f3 e7e5 g2g4 d8h4'))).toBe('checkmate')
})

test('castling both sides moves the rook and loses the rights', () => {
  const p = play('e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1')
  expect(p.board[sq('g1')]?.k).toBe('K')
  expect(p.board[sq('f1')]?.k).toBe('R')
  expect(p.castling.wK || p.castling.wQ).toBe(false)
  const q = play('d2d4 d7d5 b1c3 b8c6 c1f4 c8f5 d1d2 d8d7 e1c1')
  expect(q.board[sq('c1')]?.k).toBe('K')
  expect(q.board[sq('d1')]?.k).toBe('R')
})

test('en passant captures the pawn beside', () => {
  const p = play('e2e4 a7a6 e4e5 d7d5 e5d6')
  expect(p.board[sq('d5')]).toBeNull()
  expect(p.board[sq('d6')]).toEqual({ c: 'w', k: 'P' })
})

test('promotion offers four pieces', () => {
  const p = play('a2a4 b7b5 a4b5 a7a6 b5a6 c8b7 a6b7 h7h6')
  const promos = legalMoves(p).filter((m) => m.from === sq('b7') && m.to === sq('a8'))
  expect(promos.map((m) => m.promo).sort()).toEqual(['B', 'N', 'Q', 'R'])
  expect(mv(p, 'b7', 'a8', 'Q').board[sq('a8')]).toEqual({ c: 'w', k: 'Q' })
})

test('the AI finds mate in one and takes a free queen', () => {
  // White to move: Qh5xf7# after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6??
  const scholar = play('e2e4 e7e5 f1c4 b8c6 d1h5 g8f6')
  for (const d of ['medium', 'hard'] as const) {
    const m = aiMove(scholar, d, seededRng(1))
    expect(result(makeMove(scholar, m))).toBe('checkmate')
  }
  // Black queen left en prise on h4, white knight on f3 takes it.
  const free = play('e2e4 e7e5 g1f3 d8h4')
  expect(aiMove(free, 'medium', seededRng(2))).toMatchObject({ from: sq('f3'), to: sq('h4') })
})
