import { type Rng, randomInt } from '../../lib/rng'

/** Freestyle gomoku on a 15×15 board: five or more in a row wins. */
export const SIZE = 15
export type Player = 1 | 2
export type Board = (Player | 0)[] // SIZE * SIZE, row-major
export type Difficulty = 'easy' | 'medium' | 'hard'

export const emptyBoard = (): Board => Array(SIZE * SIZE).fill(0)
export const other = (p: Player): Player => (p === 1 ? 2 : 1)

const DIRS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
]

const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

/** The winning line through `i` (five or more), or null. */
export function lineAt(board: Board, i: number): number[] | null {
  const p = board[i]
  if (!p) return null
  const r0 = Math.floor(i / SIZE)
  const c0 = i % SIZE
  for (const [dr, dc] of DIRS) {
    const line = [i]
    for (const s of [1, -1]) {
      let r = r0 + s * dr
      let c = c0 + s * dc
      while (inside(r, c) && board[r * SIZE + c] === p) {
        line.push(r * SIZE + c)
        r += s * dr
        c += s * dc
      }
    }
    if (line.length >= 5) return line
  }
  return null
}

export type Outcome = { winner: Player; line: number[] } | { winner: 'draw' } | null

export function outcome(board: Board, last: number | null): Outcome {
  if (last !== null) {
    const line = lineAt(board, last)
    if (line) return { winner: board[last] as Player, line }
  }
  return board.includes(0) ? null : { winner: 'draw' }
}

/**
 * Threat level of the 9-cell line around a stone of `me` just placed in the
 * middle (index 4). Cells: 1 mine, 0 empty, -1 blocked (opponent or edge).
 * 5 five, 4 open four (two ways to make five), 3 four, 2 open three, 1 three or two.
 */
function completions(line: number[]): number {
  let ways = 0
  for (let e = 0; e < 9; e++) {
    if (line[e] !== 0) continue
    line[e] = 1
    if (hasFive(line)) ways++
    line[e] = 0
  }
  return ways
}

function hasFive(line: number[]): boolean {
  let run = 0
  for (const v of line) {
    run = v === 1 ? run + 1 : 0
    if (run >= 5) return true
  }
  return false
}

const FIVE = 6
const OPEN_FOUR = 5
const FOUR = 4
const OPEN_THREE = 3
const THREE = 2
const TWO = 1

function level(line: number[]): number {
  if (hasFive(line)) return FIVE
  const ways = completions(line)
  if (ways >= 2) return OPEN_FOUR
  if (ways === 1) return FOUR
  // One more stone: does it make an open four (open three) or a four (three)?
  let best = 0
  for (let e = 0; e < 9; e++) {
    if (line[e] !== 0) continue
    line[e] = 1
    const w = hasFive(line) ? 0 : completions(line)
    line[e] = 0
    if (w >= 2) return OPEN_THREE
    if (w === 1) best = THREE
  }
  if (best) return best
  // Two stones that can still grow into five.
  let mine = 0
  for (let k = 0; k <= 4; k++) {
    const win = line.slice(k, k + 5)
    if (win.every((v) => v !== -1)) mine = Math.max(mine, win.filter((v) => v === 1).length)
  }
  return mine >= 2 ? TWO : 0
}

const VALUE = [1, 60, 600, 3000, 8000, 100000, 1000000]

/** How good it is for `p` to have a stone at `i` (board[i] must be empty). */
function cellValue(board: Board, i: number, p: Player, combos: boolean): number {
  const r0 = Math.floor(i / SIZE)
  const c0 = i % SIZE
  const counts = Array(7).fill(0)
  let score = 0
  for (const [dr, dc] of DIRS) {
    const line: number[] = []
    for (let k = -4; k <= 4; k++) {
      const r = r0 + k * dr
      const c = c0 + k * dc
      line.push(k === 0 ? 1 : !inside(r, c) ? -1 : board[r * SIZE + c] === p ? 1 : board[r * SIZE + c] === 0 ? 0 : -1)
    }
    const lv = level(line)
    counts[lv]++
    score += VALUE[lv]
  }
  if (combos) {
    // Two fours, or a four and an open three, cannot both be stopped.
    if (counts[FOUR] >= 2 || (counts[FOUR] && counts[OPEN_THREE])) score += VALUE[OPEN_FOUR]
    else if (counts[OPEN_THREE] >= 2) score += VALUE[OPEN_FOUR] / 2
  }
  return score
}

/** Empty cells within two of a stone (the centre on an empty board). */
function candidates(board: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue
    const r0 = Math.floor(i / SIZE)
    const c0 = i % SIZE
    let near = false
    for (let dr = -2; dr <= 2 && !near; dr++)
      for (let dc = -2; dc <= 2 && !near; dc++) {
        const r = r0 + dr
        const c = c0 + dc
        if (inside(r, c) && board[r * SIZE + c]) near = true
      }
    if (near) out.push(i)
  }
  return out.length ? out : [Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2)]
}

function ranked(board: Board, me: Player, defence: number, combos: boolean) {
  return candidates(board)
    .map((i) => ({ i, v: cellValue(board, i, me, combos) * 1.1 + cellValue(board, i, other(me), combos) * defence }))
    .sort((a, b) => b.v - a.v)
}

/** Move for `me`. Easy picks among the better cells, hard looks one reply ahead. */
export function aiMove(board: Board, me: Player, difficulty: Difficulty, rng: Rng): number {
  if (difficulty === 'easy') {
    const list = ranked(board, me, 0.6, false)
    // Always take a win or stop a five; otherwise any of the top few.
    if (list[0].v >= VALUE[FIVE] * 0.6) return list[0].i
    return list[randomInt(rng, Math.min(5, list.length))].i
  }
  const list = ranked(board, me, 1, difficulty === 'hard')
  if (difficulty === 'medium' || list[0].v >= VALUE[OPEN_FOUR]) return list[0].i
  // Hard: of the best few, prefer the one that leaves the opponent the weakest reply.
  let best = list[0].i
  let bestScore = -Infinity
  for (const { i, v } of list.slice(0, 8)) {
    const next = [...board]
    next[i] = me
    const reply = ranked(next, other(me), 1, true)[0]?.v ?? 0
    const s = v - reply * 0.7
    if (s > bestScore) [bestScore, best] = [s, i]
  }
  return best
}
