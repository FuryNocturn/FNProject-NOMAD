import { type Rng, randomInt } from '../../lib/rng'

/** Sliding puzzle: tiles 1..n²-1 and a gap (0); solved when they are in order with the gap last. */
export type Grid = number[]

export const solvedGrid = (n: number): Grid => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0]

export const isSolved = (g: Grid) => g.every((v, i) => v === (i === g.length - 1 ? 0 : i + 1))

/**
 * Slides the tiles between `i` and the gap one step towards the gap, when `i`
 * shares its row or column. Returns null when that is not possible.
 */
export function slide(g: Grid, n: number, i: number): Grid | null {
  const gap = g.indexOf(0)
  if (i === gap) return null
  const [r, c] = [Math.floor(i / n), i % n]
  const [gr, gc] = [Math.floor(gap / n), gap % n]
  if (r !== gr && c !== gc) return null
  const s = r === gr ? Math.sign(c - gc) : Math.sign(r - gr) * n
  const next = [...g]
  for (let k = gap; k !== i; k += s) next[k] = next[k + s]
  next[i] = 0
  return next
}

/** Shuffled by random moves from the solved grid, so it is always solvable. */
export function shuffle(n: number, rng: Rng): Grid {
  let g = solvedGrid(n)
  let prev = -1
  for (let k = 0; k < n * n * 40 || isSolved(g); k++) {
    const gap = g.indexOf(0)
    const options = [gap - n, gap + n, gap % n ? gap - 1 : -1, gap % n < n - 1 ? gap + 1 : -1].filter(
      (i) => i >= 0 && i < n * n && i !== prev,
    )
    const i = options[randomInt(rng, options.length)]
    prev = gap
    g = slide(g, n, i)!
  }
  return g
}

/** Tile that would move into the gap when sliding in a direction (as seen by the tiles). */
export function neighbourFor(g: Grid, n: number, dir: 'up' | 'down' | 'left' | 'right'): number {
  const gap = g.indexOf(0)
  const [r, c] = [Math.floor(gap / n), gap % n]
  if (dir === 'up') return r < n - 1 ? gap + n : -1
  if (dir === 'down') return r > 0 ? gap - n : -1
  if (dir === 'left') return c < n - 1 ? gap + 1 : -1
  return c > 0 ? gap - 1 : -1
}
