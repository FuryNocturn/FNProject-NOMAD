import type { Rng } from '../../lib/rng'

/**
 * Nonograms. Puzzles are random pictures kept only if plain line-by-line logic
 * solves them completely, so they have one solution and need no guessing.
 */
export type Puzzle = { size: number; solution: boolean[]; rows: number[][]; cols: number[][] }
export type Cell = 0 | 1 | 2 // empty, filled, crossed out

export const clueOf = (line: boolean[]) => {
  const out: number[] = []
  let run = 0
  for (const v of line) {
    if (v) run++
    else if (run) (out.push(run), (run = 0))
  }
  if (run) out.push(run)
  return out.length ? out : [0]
}

const lineAt = (g: (boolean | null)[], size: number, k: number, isRow: boolean) =>
  Array.from({ length: size }, (_, j) => g[isRow ? k * size + j : j * size + k])

/**
 * Every way to place the clue's blocks on a line consistent with known cells,
 * merged: a cell is decided when all placements agree. Returns null on a contradiction.
 */
export function solveLine(clue: number[], known: (boolean | null)[]): (boolean | null)[] | null {
  const n = known.length
  const blocks = clue[0] === 0 ? [] : clue
  let filled: boolean[] | null = null
  let empty: boolean[] | null = null
  const cur = Array(n).fill(false)
  const place = (b: number, from: number) => {
    if (b === blocks.length) {
      for (let j = from; j < n; j++) if (known[j] === true) return
      if (!filled) {
        filled = [...cur]
        empty = cur.map((v) => !v)
      } else for (let j = 0; j < n; j++) (filled![j] &&= cur[j], empty![j] &&= !cur[j])
      return
    }
    const len = blocks[b]
    const rest = blocks.slice(b + 1).reduce((s, x) => s + x + 1, 0)
    for (let start = from; start + len + rest <= n; start++) {
      // Cells skipped before the block must be allowed to be empty.
      if (start > from && known[start - 1] === true) break
      let fits = true
      for (let j = start; j < start + len; j++) if (known[j] === false) fits = false
      if (start + len < n && known[start + len] === true) fits = false
      if (!fits) continue
      for (let j = start; j < start + len; j++) cur[j] = true
      place(b + 1, start + len + 1)
      for (let j = start; j < start + len; j++) cur[j] = false
    }
  }
  place(0, 0)
  if (!filled) return null
  return known.map((v, j) => (filled![j] ? true : empty![j] ? false : v))
}

/** Line-by-line propagation. True when it determines every cell. */
export function solvable(size: number, rows: number[][], cols: number[][]): boolean {
  const g: (boolean | null)[] = Array(size * size).fill(null)
  for (let changed = true; changed; ) {
    changed = false
    for (const isRow of [true, false])
      for (let k = 0; k < size; k++) {
        const known = lineAt(g, size, k, isRow)
        const res = solveLine((isRow ? rows : cols)[k], known)
        if (!res) return false
        res.forEach((v, j) => {
          const idx = isRow ? k * size + j : j * size + k
          if (v !== null && g[idx] === null) (g[idx] = v, (changed = true))
        })
      }
  }
  return g.every((v) => v !== null)
}

export function generate(size: number, rng: Rng): Puzzle {
  for (;;) {
    const solution = Array.from({ length: size * size }, () => rng() < 0.58)
    const rows = Array.from({ length: size }, (_, r) => clueOf(solution.slice(r * size, r * size + size)))
    const cols = Array.from({ length: size }, (_, c) => clueOf(Array.from({ length: size }, (_, r) => solution[r * size + c])))
    if (solvable(size, rows, cols)) return { size, solution, rows, cols }
  }
}

/** Solved when the filled cells match the clues (the solution is unique, so this is the picture). */
export const isSolved = (p: Puzzle, cells: Cell[]) => cells.every((c, i) => (c === 1) === p.solution[i])
