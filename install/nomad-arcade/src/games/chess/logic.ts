import { type Rng, randomInt } from '../../lib/rng'

export type Color = 'w' | 'b'
export type Kind = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
export type Piece = { c: Color; k: Kind }
export type Square = Piece | null
/** Index 0 is a8 (top left from white's side), 63 is h1. */
export type Board = Square[]
export type Castling = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
export type Position = {
  board: Board
  turn: Color
  castling: Castling
  /** Square a pawn can capture en passant onto, or -1. */
  ep: number
  /** Moves since the last capture or pawn move (fifty-move rule). */
  halfmove: number
}
export type Move = { from: number; to: number; promo?: Kind }
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Result = 'checkmate' | 'stalemate' | 'fifty' | 'material' | null

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const row = (i: number) => Math.floor(i / 8)
const col = (i: number) => i % 8
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8

export function initial(): Position {
  const back: Kind[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  const board: Board = Array(64).fill(null)
  for (let c = 0; c < 8; c++) {
    board[c] = { c: 'b', k: back[c] }
    board[8 + c] = { c: 'b', k: 'P' }
    board[48 + c] = { c: 'w', k: 'P' }
    board[56 + c] = { c: 'w', k: back[c] }
  }
  return { board, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1, halfmove: 0 }
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

/** True when `by` attacks square `sq`. */
export function attacked(board: Board, sq: number, by: Color): boolean {
  const r = row(sq)
  const c = col(sq)
  const is = (rr: number, cc: number, kinds: Kind[]) => {
    if (!on(rr, cc)) return false
    const p = board[rr * 8 + cc]
    return !!p && p.c === by && kinds.includes(p.k)
  }
  // Pawns attack diagonally forward: a white pawn attacks from the row below.
  const pr = by === 'w' ? r + 1 : r - 1
  if (is(pr, c - 1, ['P']) || is(pr, c + 1, ['P'])) return true
  if (KNIGHT.some(([dr, dc]) => is(r + dr, c + dc, ['N']))) return true
  if (KING.some(([dr, dc]) => is(r + dr, c + dc, ['K']))) return true
  const slide = (dirs: number[][], kinds: Kind[]) =>
    dirs.some(([dr, dc]) => {
      let rr = r + dr
      let cc = c + dc
      while (on(rr, cc)) {
        const p = board[rr * 8 + cc]
        if (p) return p.c === by && kinds.includes(p.k)
        rr += dr
        cc += dc
      }
      return false
    })
  return slide(ROOK, ['R', 'Q']) || slide(BISHOP, ['B', 'Q'])
}

export const kingSquare = (board: Board, c: Color) => board.findIndex((p) => p?.c === c && p.k === 'K')
export const inCheck = (pos: Position, c: Color = pos.turn) => attacked(pos.board, kingSquare(pos.board, c), other(c))

/** Moves that follow piece movement rules, before checking whether they leave the king in check. */
function pseudoMoves(pos: Position): Move[] {
  const { board, turn } = pos
  const out: Move[] = []
  const add = (from: number, to: number) => {
    const p = board[from]!
    if (p.k === 'P' && (row(to) === 0 || row(to) === 7)) {
      for (const promo of ['Q', 'R', 'B', 'N'] as Kind[]) out.push({ from, to, promo })
    } else out.push({ from, to })
  }
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (!p || p.c !== turn) continue
    const r = row(i)
    const c = col(i)
    if (p.k === 'P') {
      const dir = turn === 'w' ? -1 : 1
      const start = turn === 'w' ? 6 : 1
      if (on(r + dir, c) && !board[(r + dir) * 8 + c]) {
        add(i, (r + dir) * 8 + c)
        if (r === start && !board[(r + 2 * dir) * 8 + c]) out.push({ from: i, to: (r + 2 * dir) * 8 + c })
      }
      for (const dc of [-1, 1]) {
        if (!on(r + dir, c + dc)) continue
        const t = (r + dir) * 8 + c + dc
        if ((board[t] && board[t]!.c !== turn) || t === pos.ep) add(i, t)
      }
    } else if (p.k === 'N' || p.k === 'K') {
      for (const [dr, dc] of p.k === 'N' ? KNIGHT : KING) {
        if (!on(r + dr, c + dc)) continue
        const t = (r + dr) * 8 + c + dc
        if (!board[t] || board[t]!.c !== turn) out.push({ from: i, to: t })
      }
    } else {
      const dirs = p.k === 'R' ? ROOK : p.k === 'B' ? BISHOP : [...ROOK, ...BISHOP]
      for (const [dr, dc] of dirs) {
        let rr = r + dr
        let cc = c + dc
        while (on(rr, cc)) {
          const t = rr * 8 + cc
          if (board[t]) {
            if (board[t]!.c !== turn) out.push({ from: i, to: t })
            break
          }
          out.push({ from: i, to: t })
          rr += dr
          cc += dc
        }
      }
    }
  }
  // Castling: king and rook unmoved, squares between empty, king not passing through check.
  const home = turn === 'w' ? 60 : 4
  const enemy = other(turn)
  if (board[home]?.k === 'K' && board[home]?.c === turn && !attacked(board, home, enemy)) {
    const rights = turn === 'w' ? [pos.castling.wK, pos.castling.wQ] : [pos.castling.bK, pos.castling.bQ]
    if (rights[0] && !board[home + 1] && !board[home + 2] && board[home + 3]?.k === 'R' &&
        !attacked(board, home + 1, enemy) && !attacked(board, home + 2, enemy))
      out.push({ from: home, to: home + 2 })
    if (rights[1] && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4]?.k === 'R' &&
        !attacked(board, home - 1, enemy) && !attacked(board, home - 2, enemy))
      out.push({ from: home, to: home - 2 })
  }
  return out
}

export function makeMove(pos: Position, m: Move): Position {
  const board = [...pos.board]
  const p = board[m.from]!
  const captured = board[m.to]
  board[m.to] = m.promo ? { c: p.c, k: m.promo } : p
  board[m.from] = null
  // En passant removes the pawn beside the destination.
  if (p.k === 'P' && m.to === pos.ep) board[m.to + (p.c === 'w' ? 8 : -8)] = null
  // Castling moves the rook too.
  if (p.k === 'K' && Math.abs(m.to - m.from) === 2) {
    const kingSide = m.to > m.from
    const rookFrom = kingSide ? m.from + 3 : m.from - 4
    const rookTo = kingSide ? m.from + 1 : m.from - 1
    board[rookTo] = board[rookFrom]
    board[rookFrom] = null
  }
  const castling = { ...pos.castling }
  const touch = (sq: number) => {
    if (sq === 60) castling.wK = castling.wQ = false
    if (sq === 4) castling.bK = castling.bQ = false
    if (sq === 63) castling.wK = false
    if (sq === 56) castling.wQ = false
    if (sq === 7) castling.bK = false
    if (sq === 0) castling.bQ = false
  }
  touch(m.from)
  touch(m.to)
  const ep = p.k === 'P' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1
  const halfmove = p.k === 'P' || captured ? 0 : pos.halfmove + 1
  return { board, turn: other(pos.turn), castling, ep, halfmove }
}

export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter((m) => !inCheck(makeMove(pos, m), pos.turn))
}

/** Only kings, or king and one minor piece each side: nobody can mate. */
function insufficientMaterial(board: Board): boolean {
  const rest = board.filter((p): p is Piece => !!p && p.k !== 'K')
  return rest.length === 0 || (rest.length === 1 && (rest[0].k === 'B' || rest[0].k === 'N'))
}

export function result(pos: Position): Result {
  if (legalMoves(pos).length === 0) return inCheck(pos) ? 'checkmate' : 'stalemate'
  if (pos.halfmove >= 100) return 'fifty'
  if (insufficientMaterial(pos.board)) return 'material'
  return null
}

// ── Engine ────────────────────────────────────────────

const VALUE: Record<Kind, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 }

/** Small positional bonuses from white's side (index 0 = a8); mirrored for black. */
const PST: Partial<Record<Kind, number[]>> = {
  P: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  N: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20,
    20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50,
    -40, -30, -30, -30, -30, -40, -50,
  ],
  B: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5,
    5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10,
    -10, -10, -10, -10, -20,
  ],
  K: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
}

/** Material plus position, from the side to move. */
function evaluate(pos: Position): number {
  let score = 0
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i]
    if (!p) continue
    const table = PST[p.k]
    const sq = p.c === 'w' ? i : (7 - row(i)) * 8 + col(i)
    const v = VALUE[p.k] + (table ? table[sq] : 0)
    score += p.c === pos.turn ? v : -v
  }
  return score
}

/** Captures first, most valuable victim first, so alpha-beta cuts more. */
function ordered(pos: Position, moves: Move[]): Move[] {
  const gain = (m: Move) => (pos.board[m.to] ? VALUE[pos.board[m.to]!.k] * 10 - VALUE[pos.board[m.from]!.k] : 0) + (m.promo === 'Q' ? 800 : 0)
  return [...moves].sort((a, b) => gain(b) - gain(a))
}

const MATE = 100000

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = legalMoves(pos)
  if (moves.length === 0) return inCheck(pos) ? -MATE + ply : 0
  if (pos.halfmove >= 100) return 0
  if (depth === 0) return evaluate(pos)
  let best = -Infinity
  for (const m of ordered(pos, moves)) {
    best = Math.max(best, -negamax(makeMove(pos, m), depth - 1, -beta, -alpha, ply + 1))
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

/** Best move for the side to move. Easy also blunders a random move a third of the time. */
export function aiMove(pos: Position, difficulty: Difficulty, rng: Rng): Move {
  const moves = legalMoves(pos)
  if (difficulty === 'easy' && rng() < 1 / 3) return moves[randomInt(rng, moves.length)]
  let best: Move[] = []
  let bestScore = -Infinity
  for (const m of ordered(pos, moves)) {
    const s = -negamax(makeMove(pos, m), DEPTH[difficulty] - 1, -Infinity, -bestScore + 1, 1)
    if (s > bestScore) [bestScore, best] = [s, [m]]
    else if (s === bestScore) best.push(m)
  }
  return best[randomInt(rng, best.length)]
}

export const squareName = (i: number) => 'abcdefgh'[col(i)] + (8 - row(i))
