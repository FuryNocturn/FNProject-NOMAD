import { type Rng, randomInt } from '../../lib/rng'

export type Player = 'X' | 'O'
export type Cell = Player | null
export type Board = Cell[] // 9 cells, row by row
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Outcome = { winner: Player; line: number[] } | { winner: 'draw' } | null

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export const emptyBoard = (): Board => Array(9).fill(null)

export const other = (p: Player): Player => (p === 'X' ? 'O' : 'X')

export function outcome(board: Board): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line
    const v = board[a]
    if (v && v === board[b] && v === board[c]) return { winner: v, line }
  }
  return board.every(Boolean) ? { winner: 'draw' } : null
}

export const freeCells = (board: Board) =>
  board.flatMap((c, i) => (c === null ? [i] : []))

/** Minimax score from `me`'s point of view; faster wins and slower losses score better. */
function minimax(board: Board, me: Player, toMove: Player, depth: number): number {
  const o = outcome(board)
  if (o) return o.winner === 'draw' ? 0 : o.winner === me ? 10 - depth : depth - 10
  const scores = freeCells(board).map((i) => {
    board[i] = toMove
    const s = minimax(board, me, other(toMove), depth + 1)
    board[i] = null
    return s
  })
  return toMove === me ? Math.max(...scores) : Math.min(...scores)
}

export function perfectMove(board: Board, me: Player): number {
  const work = [...board]
  let best = -1
  let bestScore = -Infinity
  for (const i of freeCells(work)) {
    work[i] = me
    const s = minimax(work, me, other(me), 1)
    work[i] = null
    if (s > bestScore) [best, bestScore] = [i, s]
  }
  return best
}

/** Easy plays at random, medium plays perfectly half the time, hard never loses. */
export function aiMove(board: Board, me: Player, difficulty: Difficulty, rng: Rng): number {
  const free = freeCells(board)
  const random = () => free[randomInt(rng, free.length)]
  if (difficulty === 'easy') return random()
  if (difficulty === 'medium' && rng() < 0.5) return random()
  return perfectMove(board, me)
}
