import type { Rng } from '../../lib/rng'

/**
 * Go on a 9×9 board, area (Chinese) scoring with komi, simple ko.
 * Stones: 1 black, 2 white. The computer is a Monte Carlo tree search with
 * RAVE over light random playouts.
 */
export const N = 9
const NN = N * N
export const KOMI = 6.5
export const PASS = -1
export type Color = 1 | 2
export type Difficulty = 'easy' | 'medium' | 'hard'

export const STARS = [2 * N + 2, 2 * N + 6, 4 * N + 4, 6 * N + 2, 6 * N + 6]

const NB: number[][] = Array.from({ length: NN }, (_, p) => {
  const r = Math.floor(p / N)
  const c = p % N
  const out: number[] = []
  if (r > 0) out.push(p - N)
  if (r < N - 1) out.push(p + N)
  if (c > 0) out.push(p - 1)
  if (c < N - 1) out.push(p + 1)
  return out
})

const DIAG: number[][] = Array.from({ length: NN }, (_, p) => {
  const r = Math.floor(p / N)
  const c = p % N
  const out: number[] = []
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const rr = r + dr
    const cc = c + dc
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc)
  }
  return out
})

export const opp = (c: Color): Color => (c === 1 ? 2 : 1)

// Flood-fill scratch space shared by every board operation (single-threaded).
const mark = new Int32Array(NN)
let stamp = 0
const stack = new Int32Array(NN)

function hasLiberty(b: ArrayLike<number>, p: number): boolean {
  const color = b[p]
  stamp++
  let top = 0
  stack[top++] = p
  mark[p] = stamp
  while (top) {
    const q = stack[--top]
    for (const n of NB[q]) {
      if (b[n] === 0) return true
      if (b[n] === color && mark[n] !== stamp) {
        mark[n] = stamp
        stack[top++] = n
      }
    }
  }
  return false
}

/** Stones of the group at `p`. */
export function group(b: ArrayLike<number>, p: number): number[] {
  const color = b[p]
  const out = [p]
  const seen = new Set([p])
  for (let k = 0; k < out.length; k++)
    for (const n of NB[out[k]])
      if (b[n] === color && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
  return out
}

function removeGroup(b: Int8Array | number[], p: number): number {
  const color = b[p]
  let top = 0
  let count = 0
  stack[top++] = p
  b[p] = 0
  while (top) {
    const q = stack[--top]
    count++
    for (const n of NB[q])
      if (b[n] === color) {
        b[n] = 0
        stack[top++] = n
      }
  }
  return count
}

/**
 * Plays `color` at `p` in place. Returns the new ko point (or -1), or -2 when
 * the move is illegal (occupied, ko, suicide); an illegal move leaves `b` unchanged.
 */
function playInPlace(b: Int8Array | number[], p: number, color: Color, ko: number): number {
  if (b[p] !== 0 || p === ko) return -2
  b[p] = color
  const enemy = opp(color)
  let captured = 0
  let capturedAt = -1
  for (const n of NB[p])
    if (b[n] === enemy && !hasLiberty(b, n)) {
      capturedAt = n
      captured += removeGroup(b, n)
    }
  if (captured === 0 && !hasLiberty(b, p)) {
    b[p] = 0
    return -2
  }
  // A single stone that took a single stone and is left with one liberty: ko.
  if (captured === 1 && NB[p].every((n) => b[n] !== color) && NB[p].filter((n) => b[n] === 0).length === 1) return capturedAt
  return -1
}

/** A point surrounded by `color` that it should never fill (a real eye, roughly). */
function isEye(b: ArrayLike<number>, p: number, color: Color): boolean {
  if (b[p] !== 0) return false
  for (const n of NB[p]) if (b[n] !== color) return false
  let bad = 0
  for (const d of DIAG[p]) if (b[d] === opp(color)) bad++
  return DIAG[p].length < 4 ? bad === 0 : bad < 2
}

export type Game = {
  board: number[]
  toMove: Color
  ko: number
  passes: number
  captures: [number, number] // stones taken by black, by white
  last: number | null
}

export const newGame = (): Game => ({ board: Array(NN).fill(0), toMove: 1, ko: -1, passes: 0, captures: [0, 0], last: null })

export function legal(g: Game, p: number): boolean {
  if (p === PASS) return true
  const b = g.board.slice()
  return playInPlace(b, p, g.toMove, g.ko) !== -2
}

/** The game after `p` (or PASS), or null when illegal. */
export function play(g: Game, p: number): Game | null {
  if (p === PASS) return { ...g, toMove: opp(g.toMove), ko: -1, passes: g.passes + 1, last: PASS }
  const b = g.board.slice()
  const before = b.filter((v) => v === opp(g.toMove)).length
  const ko = playInPlace(b, p, g.toMove, g.ko)
  if (ko === -2) return null
  const taken = before - b.filter((v) => v === opp(g.toMove)).length
  const captures: [number, number] = [...g.captures]
  captures[g.toMove - 1] += taken
  return { board: b, toMove: opp(g.toMove), ko, passes: 0, captures, last: p }
}

/**
 * Area score with the given stones removed as dead: stones plus empty regions
 * that touch only one colour. `owner[p]` is the colour that gets the point.
 */
export function areaScore(board: number[], dead: Set<number> = new Set()) {
  const b = board.map((v, p) => (dead.has(p) ? 0 : v))
  const owner: (0 | 1 | 2)[] = b.map((v) => v as 0 | 1 | 2)
  const seen = new Set<number>()
  for (let p = 0; p < NN; p++) {
    if (b[p] !== 0 || seen.has(p)) continue
    const region = [p]
    const touches = new Set<number>()
    seen.add(p)
    for (let k = 0; k < region.length; k++)
      for (const n of NB[region[k]]) {
        if (b[n] === 0 && !seen.has(n)) {
          seen.add(n)
          region.push(n)
        } else if (b[n]) touches.add(b[n])
      }
    if (touches.size === 1) {
      const c = [...touches][0] as 1 | 2
      for (const q of region) owner[q] = c
    }
  }
  const black = owner.filter((v) => v === 1).length
  const white = owner.filter((v) => v === 2).length
  return { black, white: white + KOMI, owner }
}

// ── Playouts ────────────────────────────────────────

const work = new Int8Array(NN)
const empties = new Int32Array(NN)
const firstBy = new Int8Array(NN)

/**
 * Plays random moves (never filling own eyes) to the end from `work`.
 * Records in `firstBy` which colour played each point first. Returns the winner.
 */
function playout(start: Color, ko: number, rng: Rng): Color {
  firstBy.fill(0)
  let color = start
  let passes = 0
  for (let move = 0; move < NN * 3 && passes < 2; move++) {
    let n = 0
    for (let p = 0; p < NN; p++) if (work[p] === 0) empties[n++] = p
    let played = -1
    while (n > 0) {
      const k = Math.floor(rng() * n)
      const p = empties[k]
      if (!isEye(work, p, color)) {
        const r = playInPlace(work, p, color, ko)
        if (r !== -2) {
          ko = r
          played = p
          break
        }
      }
      empties[k] = empties[--n]
    }
    if (played < 0) {
      passes++
      ko = -1
    } else {
      passes = 0
      if (!firstBy[played]) firstBy[played] = color
    }
    color = opp(color)
  }
  let score = -KOMI
  for (let p = 0; p < NN; p++) {
    const v = work[p] || (NB[p].every((q) => work[q] === 1) ? 1 : NB[p].every((q) => work[q] === 2) ? 2 : 0)
    if (v === 1) score++
    else if (v === 2) score--
  }
  return score > 0 ? 1 : 2
}

// ── Tree search ─────────────────────────────────────

type Node = {
  move: number
  color: Color // who played `move`
  visits: number
  wins: number // for `color`
  amafVisits: number
  amafWins: number
  children: Node[] | null
}

const node = (move: number, color: Color): Node => ({ move, color, visits: 0, wins: 0, amafVisits: 0, amafWins: 0, children: null })

function candidateMoves(b: Int8Array, color: Color, ko: number): number[] {
  const out: number[] = []
  const tmp = new Int8Array(NN)
  for (let p = 0; p < NN; p++) {
    if (b[p] !== 0 || isEye(b, p, color)) continue
    tmp.set(b)
    if (playInPlace(tmp, p, color, ko) !== -2) out.push(p)
  }
  return out
}

const RAVE_K = 600

function select(children: Node[], parentVisits: number): Node {
  let best = children[0]
  let bestV = -Infinity
  const logN = Math.log(parentVisits + 1)
  for (const c of children) {
    const q = c.visits ? c.wins / c.visits : 0.5
    const a = c.amafVisits ? c.amafWins / c.amafVisits : 0.5
    const beta = Math.sqrt(RAVE_K / (3 * c.visits + RAVE_K))
    const v = (1 - beta) * q + beta * a + 0.25 * Math.sqrt(logN / (c.visits + 1))
    if (v > bestV) [bestV, best] = [v, c]
  }
  return best
}

export const PLAYOUTS: Record<Difficulty, number> = { easy: 800, medium: 6000, hard: 25000 }

/**
 * Best move for the side to move, with its estimated chance of winning.
 * Returns PASS when no sensible move is left.
 */
export function think(g: Game, playouts: number, rng: Rng): { move: number; winRate: number } {
  const root = node(PASS, opp(g.toMove))
  const rootBoard = Int8Array.from(g.board)
  const path: Node[] = []
  const tree = new Int8Array(NN)
  for (let i = 0; i < playouts; i++) {
    tree.set(rootBoard)
    let ko = g.ko
    let n = root
    let color = g.toMove
    path.length = 0
    path.push(n)
    // Selection and expansion.
    while (true) {
      if (!n.children) {
        if (n.visits > 0 || n === root) {
          const moves = candidateMoves(tree, color, ko)
          n.children = moves.length ? moves.map((m) => node(m, color)) : [node(PASS, color)]
        } else break
      }
      n = select(n.children, n.visits)
      if (n.move !== PASS) ko = playInPlace(tree, n.move, color, ko)
      else ko = -1
      path.push(n)
      color = opp(color)
      if (n.move === PASS && path.length > 2 && path[path.length - 2].move === PASS) break
    }
    work.set(tree)
    const winner = playout(color, ko, rng)
    // Points played along the tree path count for AMAF too.
    for (const p of path) if (p.move !== PASS && !firstBy[p.move]) firstBy[p.move] = p.color
    for (const p of path) {
      p.visits++
      if (winner === p.color) p.wins++
      if (p.children)
        for (const c of p.children)
          if (c.move !== PASS && firstBy[c.move] === c.color) {
            c.amafVisits++
            if (winner === c.color) c.amafWins++
          }
    }
  }
  let best = root.children![0]
  for (const c of root.children!) if (c.visits > best.visits) best = c
  return { move: best.move, winRate: best.visits ? best.wins / best.visits : 0 }
}

/** Computer move: passes back when the opponent passed and it is ahead, or nothing useful is left. */
export function aiMove(g: Game, difficulty: Difficulty, rng: Rng): number {
  if (g.passes > 0) {
    const s = areaScore(g.board, deadStones(g, rng, 120))
    const lead = g.toMove === 1 ? s.black - s.white : s.white - s.black
    if (lead > 0) return PASS
  }
  const { move, winRate } = think(g, PLAYOUTS[difficulty], rng)
  // A hopeless position still plays on; a won one with only dame left may pass.
  if (move === PASS || (winRate > 0.97 && g.passes > 0)) return PASS
  return move
}

/**
 * Stones that random playouts from here usually lose: the computer's guess at
 * which stones are dead when the game ends. The players can still change it.
 */
export function deadStones(g: Game, rng: Rng, playouts = 300): Set<number> {
  const owned = new Float32Array(NN)
  const start = Int8Array.from(g.board)
  for (let i = 0; i < playouts; i++) {
    work.set(start)
    playout(g.toMove, g.ko, rng)
    for (let p = 0; p < NN; p++) {
      const v = work[p] || (NB[p].every((q) => work[q] === 1) ? 1 : NB[p].every((q) => work[q] === 2) ? 2 : 0)
      if (v === g.board[p]) owned[p]++
    }
  }
  const dead = new Set<number>()
  for (let p = 0; p < NN; p++) {
    if (!g.board[p] || dead.has(p)) continue
    const stones = group(g.board, p)
    const alive = stones.reduce((s, q) => s + owned[q], 0) / stones.length / playouts
    if (alive < 0.35) for (const q of stones) dead.add(q)
  }
  return dead
}
