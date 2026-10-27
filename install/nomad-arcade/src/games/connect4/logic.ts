import { type Rng, randomInt } from '../../lib/rng'

export const COLS = 7
export const ROWS = 6
export type Player = 1 | 2
export type Cell = Player | 0
export type Board = Cell[] // ROWS * COLS, row 0 is the top
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Outcome = { winner: Player; line: number[] } | { winner: 'draw' } | null

export const emptyBoard = (): Board => Array(ROWS * COLS).fill(0)
export const other = (p: Player): Player => (p === 1 ? 2 : 1)
const at = (r: number, c: number) => r * COLS + c

/** Row the piece lands on in `col`, or -1 when the column is full. */
export function landingRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (board[at(r, col)] === 0) return r
  return -1
}

export function drop(board: Board, col: number, p: Player): Board | null {
  const r = landingRow(board, col)
  if (r < 0) return null
  const next = [...board]
  next[at(r, col)] = p
  return next
}

export const validCols = (board: Board) =>
  Array.from({ length: COLS }, (_, c) => c).filter((c) => board[at(0, c)] === 0)

const DIRS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
]

/** Every horizontal, vertical and diagonal run of four cells. */
const WINDOWS: number[][] = (() => {
  const out: number[][] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of DIRS) {
        const er = r + 3 * dr
        const ec = c + 3 * dc
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue
        out.push([0, 1, 2, 3].map((k) => at(r + k * dr, c + k * dc)))
      }
  return out
})()

export function outcome(board: Board): Outcome {
  for (const w of WINDOWS) {
    const v = board[w[0]]
    if (v && w.every((i) => board[i] === v)) return { winner: v, line: w }
  }
  return validCols(board).length === 0 ? { winner: 'draw' } : null
}

/** Positional score for `me`: open threes and twos, plus a bonus for the centre column. */
function heuristic(board: Board, me: Player): number {
  const them = other(me)
  let score = 0
  for (let r = 0; r < ROWS; r++) if (board[at(r, 3)] === me) score += 3
  for (const w of WINDOWS) {
    let mine = 0
    let theirs = 0
    for (const i of w) {
      if (board[i] === me) mine++
      else if (board[i] === them) theirs++
    }
    if (theirs === 0) score += mine === 3 ? 5 : mine === 2 ? 2 : 0
    else if (mine === 0 && theirs === 3) score -= 4
  }
  return score
}

const CENTRE_FIRST = [3, 2, 4, 1, 5, 0, 6]

function negamax(board: Board, toMove: Player, depth: number, alpha: number, beta: number): number {
  const o = outcome(board)
  // The previous mover made any win on the board, so it is a loss for `toMove`.
  if (o) return o.winner === 'draw' ? 0 : -(1000 + depth)
  if (depth === 0) return heuristic(board, toMove)
  let best = -Infinity
  for (const c of CENTRE_FIRST) {
    const next = drop(board, c, toMove)
    if (!next) continue
    best = Math.max(best, -negamax(next, other(toMove), depth - 1, -beta, -alpha))
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

const SEARCH_DEPTH: Record<Difficulty, number> = { easy: 1, medium: 4, hard: 7 }

/** Best column for `me`. Easy also plays a random column a third of the time. */
export function aiMove(board: Board, me: Player, difficulty: Difficulty, rng: Rng): number {
  const cols = validCols(board)
  if (difficulty === 'easy' && rng() < 1 / 3) return cols[randomInt(rng, cols.length)]
  const depth = SEARCH_DEPTH[difficulty]
  let bestCols: number[] = []
  let bestScore = -Infinity
  for (const c of CENTRE_FIRST) {
    const next = drop(board, c, me)
    if (!next) continue
    const s = -negamax(next, other(me), depth - 1, -Infinity, Infinity)
    if (s > bestScore) [bestScore, bestCols] = [s, [c]]
    else if (s === bestScore) bestCols.push(c)
  }
  return bestCols[randomInt(rng, bestCols.length)]
}
