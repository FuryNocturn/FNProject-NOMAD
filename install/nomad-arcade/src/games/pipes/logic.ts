import { type Rng, randomInt } from '../../lib/rng'

/**
 * Pipes: rotate the tiles until every pipe joins the water source in the
 * middle and no pipe end is left open. Each tile is a mask of its openings:
 * 1 up, 2 right, 4 down, 8 left. The layout is a random spanning tree.
 */
export const UP = 1
export const RIGHT = 2
export const DOWN = 4
export const LEFT = 8

export type Board = { n: number; tiles: number[]; source: number }

export const rotate = (m: number, turns = 1): number => {
  let r = m
  for (let k = 0; k < ((turns % 4) + 4) % 4; k++) r = ((r << 1) | (r >> 3)) & 15
  return r
}

const DIRS = [
  { bit: UP, back: DOWN, dr: -1, dc: 0 },
  { bit: RIGHT, back: LEFT, dr: 0, dc: 1 },
  { bit: DOWN, back: UP, dr: 1, dc: 0 },
  { bit: LEFT, back: RIGHT, dr: 0, dc: -1 },
]

function neighbour(n: number, i: number, d: (typeof DIRS)[number]): number {
  const r = Math.floor(i / n) + d.dr
  const c = (i % n) + d.dc
  return r < 0 || c < 0 || r >= n || c >= n ? -1 : r * n + c
}

/** The solved layout: a random spanning tree grown from the centre. */
export function tree(n: number, rng: Rng): number[] {
  // Skipping crossings can, rarely, strand a cell: then grow another tree.
  for (;;) {
    const tiles = grow(n, rng)
    if (tiles.every(Boolean)) return tiles
  }
}

function grow(n: number, rng: Rng): number[] {
  const tiles = Array(n * n).fill(0)
  const source = Math.floor(n / 2) * n + Math.floor(n / 2)
  const inTree = new Set([source])
  const edges: [number, (typeof DIRS)[number]][] = DIRS.map((d) => [source, d])
  while (inTree.size < n * n && edges.length) {
    const k = randomInt(rng, edges.length)
    const [from, d] = edges[k]
    edges[k] = edges[edges.length - 1]
    edges.pop()
    const to = neighbour(n, from, d)
    // No four-way crossings, so the puzzle stays readable.
    if (to < 0 || inTree.has(to) || (tiles[from] | d.bit) === 15) continue
    tiles[from] |= d.bit
    tiles[to] |= d.back
    inTree.add(to)
    for (const e of DIRS) edges.push([to, e])
  }
  return tiles
}

export function newBoard(n: number, rng: Rng): Board {
  const source = Math.floor(n / 2) * n + Math.floor(n / 2)
  const solution = tree(n, rng)
  while (true) {
    const tiles = solution.map((m) => rotate(m, randomInt(rng, 4)))
    const b = { n, tiles, source }
    if (!isSolved(b)) return b
  }
}

/** Cells joined to the source through matching openings. */
export function watered(b: Board): Set<number> {
  const seen = new Set([b.source])
  const queue = [b.source]
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]
    for (const d of DIRS) {
      if (!(b.tiles[i] & d.bit)) continue
      const j = neighbour(b.n, i, d)
      if (j >= 0 && b.tiles[j] & d.back && !seen.has(j)) {
        seen.add(j)
        queue.push(j)
      }
    }
  }
  return seen
}

/** Every tile watered and no opening pointing at nothing. */
export function isSolved(b: Board): boolean {
  if (watered(b).size !== b.tiles.length) return false
  return b.tiles.every((m, i) =>
    DIRS.every((d) => {
      if (!(m & d.bit)) return true
      const j = neighbour(b.n, i, d)
      return j >= 0 && (b.tiles[j] & d.back) !== 0
    }),
  )
}
