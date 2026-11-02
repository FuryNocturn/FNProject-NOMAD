import { type Rng, randomInt, shuffled } from '../../lib/rng'

/** Battleship on 10x10. Ships may not touch, not even diagonally; sinking one reveals the water around it. */
export const N = 10
export const FLEET = [5, 4, 3, 3, 2]
export type Ship = { cells: number[] }
export type Mark = 'miss' | 'hit' | 'sunk' | null
export type Board = { ships: Ship[]; marks: Mark[] }
export type Difficulty = 'easy' | 'medium' | 'hard'

const rc = (i: number) => [Math.floor(i / N), i % N]
const around = (i: number) => {
  const [r, c] = rc(i)
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr
      const cc = c + dc
      if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc)
    }
  return out
}

export function placeFleet(rng: Rng): Ship[] {
  for (;;) {
    const blocked = new Set<number>()
    const ships: Ship[] = []
    let ok = true
    for (const len of FLEET) {
      const options: number[][] = []
      for (let i = 0; i < N * N; i++) {
        const [r, c] = rc(i)
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          if (r + dr * (len - 1) >= N || c + dc * (len - 1) >= N) continue
          const cells = Array.from({ length: len }, (_, k) => (r + dr * k) * N + c + dc * k)
          if (cells.every((x) => !blocked.has(x))) options.push(cells)
        }
      }
      if (!options.length) {
        ok = false
        break
      }
      const cells = options[randomInt(rng, options.length)]
      ships.push({ cells })
      for (const x of cells) for (const y of [x, ...around(x)]) blocked.add(y)
    }
    if (ok) return ships
  }
}

export const newBoard = (rng: Rng): Board => ({ ships: placeFleet(rng), marks: Array(N * N).fill(null) })

export function fire(b: Board, i: number): { board: Board; result: Mark } {
  if (b.marks[i]) return { board: b, result: null }
  const marks = [...b.marks]
  const ship = b.ships.find((s) => s.cells.includes(i))
  if (!ship) {
    marks[i] = 'miss'
    return { board: { ...b, marks }, result: 'miss' }
  }
  marks[i] = 'hit'
  if (ship.cells.every((x) => marks[x] === 'hit')) {
    for (const x of ship.cells) marks[x] = 'sunk'
    // No ship can touch it, so its surroundings are water.
    for (const x of ship.cells) for (const y of around(x)) if (!marks[y]) marks[y] = 'miss'
    return { board: { ...b, marks }, result: 'sunk' }
  }
  return { board: { ...b, marks }, result: 'hit' }
}

export const allSunk = (b: Board) => b.ships.every((s) => s.cells.every((x) => b.marks[x] === 'sunk'))
export const shipsLeft = (b: Board) => b.ships.filter((s) => !s.cells.every((x) => b.marks[x] === 'sunk')).length

/**
 * Easy shoots at random. Medium hunts on a checkerboard and finishes ships off
 * once it has a hit. Hard picks the cell where the remaining ships fit in the most ways.
 */
export function aiShot(b: Board, difficulty: Difficulty, rng: Rng): number {
  const open = b.marks.flatMap((m, i) => (m ? [] : [i]))
  if (difficulty === 'easy') return open[randomInt(rng, open.length)]
  const hits = b.marks.flatMap((m, i) => (m === 'hit' ? [i] : []))
  if (hits.length) {
    // Extend along the line of two hits, or try the four neighbours of one.
    const [r0, c0] = rc(hits[0])
    const sameRow = hits.every((h) => rc(h)[0] === r0)
    const sameCol = hits.every((h) => rc(h)[1] === c0)
    const cand = hits
      .flatMap((h) => {
        const [r, c] = rc(h)
        const n: number[] = []
        if (hits.length === 1 || sameRow) n.push(c > 0 ? h - 1 : -1, c < N - 1 ? h + 1 : -1)
        if (hits.length === 1 || sameCol) n.push(r > 0 ? h - N : -1, r < N - 1 ? h + N : -1)
        return n
      })
      .filter((x) => x >= 0 && !b.marks[x])
    if (cand.length) return cand[randomInt(rng, cand.length)]
  }
  if (difficulty === 'medium') {
    const parity = open.filter((i) => (rc(i)[0] + rc(i)[1]) % 2 === 0)
    const pool = parity.length ? parity : open
    return pool[randomInt(rng, pool.length)]
  }
  // Hard: count the placements of every remaining ship over unknown cells.
  const remaining = b.ships.filter((s) => !s.cells.every((x) => b.marks[x] === 'sunk')).map((s) => s.cells.length)
  const density = Array(N * N).fill(0)
  for (const len of remaining)
    for (let i = 0; i < N * N; i++) {
      const [r, c] = rc(i)
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (r + dr * (len - 1) >= N || c + dc * (len - 1) >= N) continue
        const cells = Array.from({ length: len }, (_, k) => (r + dr * k) * N + c + dc * k)
        if (cells.every((x) => !b.marks[x])) for (const x of cells) density[x]++
      }
    }
  const best = Math.max(...open.map((i) => density[i]))
  const top = shuffled(open.filter((i) => density[i] === best), rng)
  return top[0]
}
