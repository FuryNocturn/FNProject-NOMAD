import { type Rng, randomInt, shuffled } from '../../lib/rng'

/**
 * Calcudoku (the KenKen idea, generic name): an n×n Latin square split into
 * cages, each with a target and an operation. Generated with a single solution.
 */
export type Op = '+' | '−' | '×' | '÷' | ''
export type Cage = { cells: number[]; op: Op; target: number }
export type Puzzle = { n: number; cages: Cage[]; solution: number[] }

export function latin(n: number, rng: Rng): number[] {
  const rows = shuffled(Array.from({ length: n }, (_, i) => i), rng)
  const cols = shuffled(Array.from({ length: n }, (_, i) => i), rng)
  const sym = shuffled(Array.from({ length: n }, (_, i) => i + 1), rng)
  const out: number[] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out.push(sym[(rows[r] + cols[c]) % n])
  return out
}

function neighbours(n: number, i: number): number[] {
  const r = Math.floor(i / n)
  const c = i % n
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((x) => x >= 0)
}

function cagesFor(n: number, sol: number[], rng: Rng): Cage[] {
  const owner = Array(n * n).fill(-1)
  const groups: number[][] = []
  for (const start of shuffled(Array.from({ length: n * n }, (_, i) => i), rng)) {
    if (owner[start] >= 0) continue
    const roll = rng()
    const size = roll < 0.1 ? 1 : roll < 0.55 ? 2 : roll < 0.85 ? 3 : 4
    const cells = [start]
    owner[start] = groups.length
    while (cells.length < size) {
      const free = cells.flatMap((c) => neighbours(n, c)).filter((x) => owner[x] < 0)
      if (!free.length) break
      const pick = free[randomInt(rng, free.length)]
      owner[pick] = groups.length
      cells.push(pick)
    }
    groups.push(cells.sort((a, b) => a - b))
  }
  return groups.map((cells) => {
    const vals = cells.map((i) => sol[i])
    if (cells.length === 1) return { cells, op: '' as Op, target: vals[0] }
    if (cells.length === 2) {
      const [a, b] = [Math.max(...vals), Math.min(...vals)]
      const r = rng()
      if (a % b === 0 && r < 0.35) return { cells, op: '÷' as Op, target: a / b }
      if (r < 0.65) return { cells, op: '−' as Op, target: a - b }
    }
    const product = vals.reduce((p, v) => p * v, 1)
    return rng() < 0.5 && product <= 400
      ? { cells, op: '×' as Op, target: product }
      : { cells, op: '+' as Op, target: vals.reduce((s, v) => s + v, 0) }
  })
}

export function cageHolds(cage: Cage, vals: number[]): boolean {
  if (cage.op === '') return vals[0] === cage.target
  if (cage.op === '+') return vals.reduce((s, v) => s + v, 0) === cage.target
  if (cage.op === '×') return vals.reduce((p, v) => p * v, 1) === cage.target
  const [a, b] = [Math.max(...vals), Math.min(...vals)]
  return cage.op === '−' ? a - b === cage.target : a === b * cage.target
}

/** Number of solutions, stopping at `stop`. */
export function countSolutions(n: number, cages: Cage[], stop = 2): number {
  // Every way to fill each cage that respects the cage and its own rows and columns.
  const options = cages.map((cage) => {
    const out: number[][] = []
    const vals: number[] = []
    const rec = (k: number) => {
      if (k === cage.cells.length) {
        if (cageHolds(cage, vals)) out.push([...vals])
        return
      }
      const i = cage.cells[k]
      for (let v = 1; v <= n; v++) {
        if (cage.cells.slice(0, k).some((j, m) => vals[m] === v && (Math.floor(j / n) === Math.floor(i / n) || j % n === i % n))) continue
        vals[k] = v
        rec(k + 1)
      }
    }
    rec(0)
    return out
  })
  const order = cages.map((_, k) => k).sort((a, b) => options[a].length - options[b].length)
  const rows = new Array(n).fill(0)
  const cols = new Array(n).fill(0)
  let found = 0
  const search = (k: number) => {
    if (found >= stop) return
    if (k === order.length) {
      found++
      return
    }
    const cage = cages[order[k]]
    for (const vals of options[order[k]]) {
      let ok = true
      for (let m = 0; m < vals.length && ok; m++) {
        const i = cage.cells[m]
        const bit = 1 << vals[m]
        if (rows[Math.floor(i / n)] & bit || cols[i % n] & bit) ok = false
      }
      if (!ok) continue
      cage.cells.forEach((i, m) => {
        rows[Math.floor(i / n)] |= 1 << vals[m]
        cols[i % n] |= 1 << vals[m]
      })
      search(k + 1)
      cage.cells.forEach((i, m) => {
        rows[Math.floor(i / n)] &= ~(1 << vals[m])
        cols[i % n] &= ~(1 << vals[m])
      })
    }
  }
  search(0)
  return found
}

export function generate(n: number, rng: Rng): Puzzle {
  while (true) {
    const solution = latin(n, rng)
    for (let attempt = 0; attempt < 40; attempt++) {
      const cages = cagesFor(n, solution, rng)
      if (countSolutions(n, cages) === 1) return { n, cages, solution }
    }
  }
}

/** Cells that break a rule: repeated in a row or column, or in a full cage that misses its target. */
export function mistakes(p: Puzzle, grid: number[]): Set<number> {
  const bad = new Set<number>()
  const { n } = p
  grid.forEach((v, i) => {
    if (!v) return
    for (let j = 0; j < n * n; j++)
      if (j !== i && grid[j] === v && (Math.floor(j / n) === Math.floor(i / n) || j % n === i % n)) bad.add(i)
  })
  for (const cage of p.cages) {
    const vals = cage.cells.map((i) => grid[i])
    if (vals.every(Boolean) && !cageHolds(cage, vals)) for (const i of cage.cells) bad.add(i)
  }
  return bad
}

export const isSolved = (p: Puzzle, grid: number[]) => grid.every((v, i) => v === p.solution[i])
