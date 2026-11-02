import { type Rng, randomInt } from '../../lib/rng'

export const N = 8
export type Player = 1 | 2 // 1 black (moves first), 2 white
export type Board = (Player | 0)[]
export type Difficulty = 'easy' | 'medium' | 'hard'

export const other = (p: Player): Player => (p === 1 ? 2 : 1)

export function newBoard(): Board {
  const b: Board = Array(N * N).fill(0)
  b[27] = 2
  b[28] = 1
  b[35] = 1
  b[36] = 2
  return b
}

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
]

/** Discs `p` would turn by playing at `i` (empty when the move is illegal). */
export function flipsFor(board: Board, i: number, p: Player): number[] {
  if (board[i]) return []
  const r0 = Math.floor(i / N)
  const c0 = i % N
  const out: number[] = []
  for (const [dr, dc] of DIRS) {
    const line: number[] = []
    let r = r0 + dr
    let c = c0 + dc
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === other(p)) {
      line.push(r * N + c)
      r += dr
      c += dc
    }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === p) out.push(...line)
  }
  return out
}

export const legalMoves = (board: Board, p: Player) =>
  board.flatMap((_, i) => (flipsFor(board, i, p).length ? [i] : []))

export function play(board: Board, i: number, p: Player): Board | null {
  const flips = flipsFor(board, i, p)
  if (!flips.length) return null
  const next = [...board]
  next[i] = p
  for (const j of flips) next[j] = p
  return next
}

export const count = (board: Board, p: Player) => board.filter((v) => v === p).length

/** The game ends when neither side can move. */
export const isOver = (board: Board) => !legalMoves(board, 1).length && !legalMoves(board, 2).length

/** Classic positional weights: corners are gold, the squares next to them are poison. */
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
]

function evaluate(board: Board, me: Player): number {
  if (isOver(board)) return Math.sign(count(board, me) - count(board, other(me))) * 10000
  let s = 0
  for (let i = 0; i < N * N; i++) s += board[i] === me ? WEIGHTS[i] : board[i] ? -WEIGHTS[i] : 0
  // Mobility: having more moves than the opponent is worth a lot in the middle game.
  return s + 5 * (legalMoves(board, me).length - legalMoves(board, other(me)).length)
}

function negamax(board: Board, p: Player, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || isOver(board)) return evaluate(board, p)
  const moves = legalMoves(board, p)
  // No move: pass the turn.
  if (!moves.length) return -negamax(board, other(p), depth - 1, -beta, -alpha)
  let best = -Infinity
  for (const m of moves) {
    best = Math.max(best, -negamax(play(board, m, p)!, other(p), depth - 1, -beta, -alpha))
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

/** Easy: random legal move. Medium: best square by weight. Hard: 4-ply search. -1 means pass. */
export function aiMove(board: Board, me: Player, difficulty: Difficulty, rng: Rng): number {
  const moves = legalMoves(board, me)
  if (!moves.length) return -1
  if (difficulty === 'easy') return moves[randomInt(rng, moves.length)]
  const score = (m: number) =>
    difficulty === 'medium'
      ? WEIGHTS[m] + flipsFor(board, m, me).length
      : -negamax(play(board, m, me)!, other(me), 3, -Infinity, Infinity)
  let best = moves[0]
  let bestScore = -Infinity
  for (const m of moves) {
    const s = score(m)
    if (s > bestScore) [best, bestScore] = [m, s]
  }
  return best
}
