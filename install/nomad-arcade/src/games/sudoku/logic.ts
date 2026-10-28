import { type Rng, shuffled } from '../../lib/rng'

/** 81 cells row by row; 0 is empty. */
export type Grid = number[]
export type Difficulty = 'easy' | 'medium' | 'hard'

const rowOf = (i: number) => Math.floor(i / 9)
const colOf = (i: number) => i % 9
const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)

/** Indexes sharing a row, column or box with each cell (excluding itself). */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter(
    (j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))
  )
)

export function candidates(grid: Grid, i: number): number[] {
  const used = new Set(PEERS[i].map((j) => grid[j]))
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !used.has(n))
}

/**
 * Counts solutions up to `limit`, filling the most constrained cell first.
 * With an rng it also tries digits in random order, which is how full grids are generated.
 */
function search(grid: Grid, limit: number, rng?: Rng, onSolution?: (g: Grid) => void): number {
  let best = -1
  let bestCands: number[] = []
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue
    const c = candidates(grid, i)
    if (c.length === 0) return 0
    if (best < 0 || c.length < bestCands.length) [best, bestCands] = [i, c]
    if (c.length === 1) break
  }
  if (best < 0) {
    onSolution?.([...grid])
    return 1
  }
  let count = 0
  for (const n of rng ? shuffled(bestCands, rng) : bestCands) {
    grid[best] = n
    count += search(grid, limit - count, rng, onSolution)
    grid[best] = 0
    if (count >= limit) break
  }
  return count
}

export const countSolutions = (grid: Grid, limit = 2) => search([...grid], limit)

export function solve(grid: Grid): Grid | null {
  let found: Grid | null = null
  search([...grid], 1, undefined, (g) => (found = g))
  return found
}

const TARGET_CLUES: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 26 }

/**
 * A puzzle with exactly one solution. Clues are removed in random order and
 * kept whenever removing one would allow a second solution, so the count can
 * end slightly above the difficulty's target.
 */
export function generate(difficulty: Difficulty, rng: Rng): { puzzle: Grid; solution: Grid } {
  let solution: Grid = []
  search(Array(81).fill(0), 1, rng, (g) => (solution = g))
  const puzzle = [...solution]
  let clues = 81
  for (const i of shuffled([...Array(81).keys()], rng)) {
    if (clues <= TARGET_CLUES[difficulty]) break
    const keep = puzzle[i]
    puzzle[i] = 0
    if (countSolutions(puzzle) !== 1) puzzle[i] = keep
    else clues--
  }
  return { puzzle, solution }
}

/** Cells whose value repeats in a row, column or box (for highlighting mistakes). */
export function conflicts(grid: Grid): Set<number> {
  const out = new Set<number>()
  for (let i = 0; i < 81; i++) {
    if (grid[i] && PEERS[i].some((j) => grid[j] === grid[i])) out.add(i)
  }
  return out
}

export const isSolved = (grid: Grid, solution: Grid) => grid.every((v, i) => v === solution[i])
