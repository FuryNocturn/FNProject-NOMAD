import { type Rng, randomInt } from '../../lib/rng'

export const SIZE = 4
export type Grid = number[] // SIZE * SIZE, 0 is empty
export type Dir = 'left' | 'right' | 'up' | 'down'

/** Slides one line towards index 0, merging each pair once (2,2,2 -> 4,2). */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter(Boolean)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gained += tiles[i] * 2
      i++
    } else out.push(tiles[i])
  }
  while (out.length < line.length) out.push(0)
  return { line: out, gained }
}

/** Grid indexes of each line, ordered in the direction tiles slide towards. */
function lines(dir: Dir): number[][] {
  const out: number[][] = []
  for (let a = 0; a < SIZE; a++) {
    const line: number[] = []
    for (let b = 0; b < SIZE; b++) {
      const [r, c] =
        dir === 'left' ? [a, b] : dir === 'right' ? [a, SIZE - 1 - b] : dir === 'up' ? [b, a] : [SIZE - 1 - b, a]
      line.push(r * SIZE + c)
    }
    out.push(line)
  }
  return out
}

export function slide(grid: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean } {
  const next = [...grid]
  let gained = 0
  for (const idx of lines(dir)) {
    const res = slideLine(idx.map((i) => grid[i]))
    gained += res.gained
    idx.forEach((i, k) => (next[i] = res.line[k]))
  }
  return { grid: next, gained, moved: next.some((v, i) => v !== grid[i]) }
}

/** Puts a 2 (90%) or a 4 on a random empty cell. */
export function spawn(grid: Grid, rng: Rng): Grid {
  const empty = grid.flatMap((v, i) => (v ? [] : [i]))
  if (!empty.length) return grid
  const next = [...grid]
  next[empty[randomInt(rng, empty.length)]] = rng() < 0.9 ? 2 : 4
  return next
}

export const newGrid = (rng: Rng): Grid => spawn(spawn(Array(SIZE * SIZE).fill(0), rng), rng)

export const canMove = (grid: Grid) =>
  (['left', 'right', 'up', 'down'] as Dir[]).some((d) => slide(grid, d).moved)
