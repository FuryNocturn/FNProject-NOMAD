import { type Rng, randomInt, shuffled } from '../../lib/rng'

/**
 * Match-three. Swapping two neighbours must line up three or more of a kind.
 * Four in a line leaves a striped gem that clears its whole row or column when
 * matched; five or more leaves a bomb that clears the 3x3 around it.
 */
export const SIZE = 8
export const KINDS = 6
export type Special = 'row' | 'col' | 'bomb' | null
export type Gem = { k: number; sp: Special } | null
export type Grid = Gem[]
export type State = { grid: Grid; score: number; moves: number; level: number; target: number; combo: number }

const at = (r: number, c: number) => r * SIZE + c

export const levelGoal = (level: number) => ({ target: 800 + level * 600, moves: 22 })

/** A random grid with no ready-made matches and at least one possible move. */
export function newGrid(rng: Rng): Grid {
  for (;;) {
    const g: Grid = []
    for (let i = 0; i < SIZE * SIZE; i++) {
      const r = Math.floor(i / SIZE)
      const c = i % SIZE
      let k: number
      do k = randomInt(rng, KINDS)
      while (
        (c >= 2 && g[i - 1]?.k === k && g[i - 2]?.k === k) ||
        (r >= 2 && g[i - SIZE]?.k === k && g[i - 2 * SIZE]?.k === k)
      )
      g.push({ k, sp: null })
    }
    if (hasMove(g)) return g
  }
}

export function newGame(rng: Rng, level = 1, score = 0): State {
  const { target, moves } = levelGoal(level)
  return { grid: newGrid(rng), score, moves, level, target: score + target, combo: 0 }
}

type Run = { cells: number[]; dir: 'h' | 'v' }

/** Every horizontal and vertical run of three or more. */
export function findRuns(g: Grid): Run[] {
  const runs: Run[] = []
  for (let r = 0; r < SIZE; r++) {
    let c = 0
    while (c < SIZE) {
      const k = g[at(r, c)]?.k
      let e = c + 1
      while (k !== undefined && e < SIZE && g[at(r, e)]?.k === k) e++
      if (k !== undefined && e - c >= 3) runs.push({ cells: Array.from({ length: e - c }, (_, j) => at(r, c + j)), dir: 'h' })
      c = e
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let r = 0
    while (r < SIZE) {
      const k = g[at(r, c)]?.k
      let e = r + 1
      while (k !== undefined && e < SIZE && g[at(e, c)]?.k === k) e++
      if (k !== undefined && e - r >= 3) runs.push({ cells: Array.from({ length: e - r }, (_, j) => at(r + j, c)), dir: 'v' })
      r = e
    }
  }
  return runs
}

export const adjacent = (a: number, b: number) =>
  (Math.abs(a - b) === 1 && Math.floor(a / SIZE) === Math.floor(b / SIZE)) || Math.abs(a - b) === SIZE

function swapped(g: Grid, a: number, b: number): Grid {
  const n = [...g]
  ;[n[a], n[b]] = [n[b], n[a]]
  return n
}

export function hasMove(g: Grid): boolean {
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (const j of [i + 1, i + SIZE]) {
      if (j < SIZE * SIZE && adjacent(i, j) && findRuns(swapped(g, i, j)).length) return true
    }
  }
  return false
}

/** Adds the cells a special gem blows up when it is cleared. */
function expand(g: Grid, cells: Set<number>) {
  const queue = [...cells]
  while (queue.length) {
    const i = queue.pop()!
    const sp = g[i]?.sp
    if (!sp) continue
    const r = Math.floor(i / SIZE)
    const c = i % SIZE
    const hit: number[] = []
    if (sp === 'row') for (let x = 0; x < SIZE; x++) hit.push(at(r, x))
    if (sp === 'col') for (let y = 0; y < SIZE; y++) hit.push(at(y, c))
    if (sp === 'bomb')
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) if (r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE) hit.push(at(r + dr, c + dc))
    for (const h of hit) if (!cells.has(h)) (cells.add(h), queue.push(h))
  }
}

/** Clears matches, drops gems and refills until the board is still. `focus` is where a new special appears. */
function resolve(st: State, rng: Rng, focus: number[]): State {
  let g = [...st.grid]
  let score = st.score
  let combo = 0
  let created = focus
  for (;;) {
    const runs = findRuns(g)
    if (!runs.length) break
    combo++
    const clear = new Set(runs.flatMap((r) => r.cells))
    // A run of 4 or 5+ leaves a special gem behind, on the swapped cell if it is part of the run.
    const keep = new Map<number, Gem>()
    for (const run of runs) {
      if (run.cells.length < 4) continue
      const spot = run.cells.find((c) => created.includes(c)) ?? run.cells[Math.floor(run.cells.length / 2)]
      const sp: Special = run.cells.length >= 5 ? 'bomb' : run.dir === 'h' ? 'row' : 'col'
      keep.set(spot, { k: g[spot]!.k, sp })
    }
    expand(g, clear)
    score += clear.size * 10 * combo
    for (const i of clear) g[i] = null
    for (const [i, gem] of keep) g[i] = gem
    // Gravity, then new gems from the top.
    for (let c = 0; c < SIZE; c++) {
      const col = Array.from({ length: SIZE }, (_, r) => g[at(r, c)]).filter(Boolean)
      while (col.length < SIZE) col.unshift({ k: randomInt(rng, KINDS), sp: null })
      col.forEach((gem, r) => (g[at(r, c)] = gem))
    }
    created = []
  }
  if (!hasMove(g)) g = reshuffle(g, rng)
  return { ...st, grid: g, score, combo }
}

/** Keeps the same gems but rearranges them until there is a move and no match. */
export function reshuffle(g: Grid, rng: Rng): Grid {
  for (let tries = 0; tries < 200; tries++) {
    const n = shuffled(g, rng)
    if (!findRuns(n).length && hasMove(n)) return n
  }
  return newGrid(rng)
}

/** Swaps two neighbours. Returns null if the swap makes no match (it is undone). */
export function swap(st: State, a: number, b: number, rng: Rng): State | null {
  if (!adjacent(a, b) || st.moves <= 0) return null
  const g = swapped(st.grid, a, b)
  if (!findRuns(g).length) return null
  return resolve({ ...st, grid: g, moves: st.moves - 1 }, rng, [a, b])
}

export const status = (st: State): 'playing' | 'won' | 'lost' =>
  st.score >= st.target ? 'won' : st.moves <= 0 ? 'lost' : 'playing'
