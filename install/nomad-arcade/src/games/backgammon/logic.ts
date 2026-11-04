import { type Rng, randomInt } from '../../lib/rng'

/**
 * Backgammon without the doubling cube. Player 0 (human) moves from point 24
 * down to 1 and bears off below 1; player 1 the other way.
 *
 * `pts[i]` is point i+1 seen by player 0: positive counts are player 0's
 * checkers, negative player 1's. Rules and the computer work on a `Side`, the
 * board seen by the side to move, which always moves from 24 towards 0.
 */
export type Board = { pts: number[]; bar: [number, number]; off: [number, number] }
export type Player = 0 | 1
export type Difficulty = 'easy' | 'medium' | 'hard'

/** One checker move in the mover's own numbering: 24 is the bar, -1 is off. */
export type Move = { from: number; to: number; die: number }

export const BAR = 24
export const OFF = -1

export function initialBoard(): Board {
  const pts = Array(24).fill(0)
  pts[23] = 2
  pts[12] = 5
  pts[7] = 3
  pts[5] = 5
  pts[0] = -2
  pts[11] = -5
  pts[16] = -3
  pts[18] = -5
  return { pts, bar: [0, 0], off: [0, 0] }
}

type Side = { me: number[]; op: number[]; bar: [number, number]; off: [number, number] }

function side(b: Board, p: Player): Side {
  const me = Array(24).fill(0)
  const op = Array(24).fill(0)
  for (let i = 0; i < 24; i++) {
    const v = p === 0 ? b.pts[i] : -b.pts[23 - i]
    if (v > 0) me[i] = v
    else if (v < 0) op[i] = -v
  }
  return { me, op, bar: [b.bar[p], b.bar[1 - p]], off: [b.off[p], b.off[1 - p]] }
}

function board(s: Side, p: Player): Board {
  const pts = Array(24).fill(0)
  for (let i = 0; i < 24; i++) {
    const j = p === 0 ? i : 23 - i
    const sign = p === 0 ? 1 : -1
    pts[j] = s.me[i] ? sign * s.me[i] : s.op[i] ? -sign * s.op[i] : 0
  }
  const bar: [number, number] = p === 0 ? [s.bar[0], s.bar[1]] : [s.bar[1], s.bar[0]]
  const off: [number, number] = p === 0 ? [s.off[0], s.off[1]] : [s.off[1], s.off[0]]
  return { pts, bar, off }
}

/** Translates a point between a player's numbering and the board's (identity for player 0). */
export const toBoardPoint = (p: Player, i: number) => (i === BAR || i === OFF || p === 0 ? i : 23 - i)

const copy = (s: Side): Side => ({ me: [...s.me], op: [...s.op], bar: [...s.bar], off: [...s.off] })

function allHome(s: Side): boolean {
  if (s.bar[0]) return false
  for (let i = 6; i < 24; i++) if (s.me[i]) return false
  return true
}

/** The target of moving `from` by `die`, or null when it is not allowed. */
function target(s: Side, from: number, die: number): number | null {
  if (s.bar[0] && from !== BAR) return null
  if (from === BAR) {
    if (!s.bar[0]) return null
    const to = 24 - die
    return s.op[to] <= 1 ? to : null
  }
  if (!s.me[from]) return null
  const to = from - die
  if (to >= 0) return s.op[to] <= 1 ? to : null
  if (!allHome(s)) return null
  if (to === -1) return OFF
  // A higher die may bear off only from the highest occupied point.
  for (let i = from + 1; i < 6; i++) if (s.me[i]) return null
  return OFF
}

function apply(s: Side, m: Move): Side {
  const n = copy(s)
  if (m.from === BAR) n.bar[0]--
  else n.me[m.from]--
  if (m.to === OFF) n.off[0]++
  else {
    if (n.op[m.to] === 1) {
      n.op[m.to] = 0
      n.bar[1]++
    }
    n.me[m.to]++
  }
  return n
}

const key = (s: Side) => `${s.me.join(',')}|${s.op.join(',')}|${s.bar}|${s.off}`

type Play = { moves: Move[]; end: Side }

/**
 * Every legal way to play the roll: as distinct end positions (for the
 * computer) or as every distinct order of moves (`orders`, for the player).
 * The rules: use as many dice as possible, and the higher die when only one can be used.
 */
function plays(s: Side, dice: number[], orders = false): Play[] {
  const seq = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : null
  const dieOrders = seq ? [seq] : [dice, [dice[1], dice[0]]]
  let bestLen = 0
  const found = new Map<string, Play>()
  const walk = (cur: Side, rest: number[], moves: Move[]) => {
    let moved = false
    if (rest.length) {
      const die = rest[0]
      const froms = cur.bar[0] ? [BAR] : cur.me.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
      for (const from of froms) {
        const to = target(cur, from, die)
        if (to === null) continue
        moved = true
        const m = { from, to, die }
        walk(apply(cur, m), rest.slice(1), [...moves, m])
      }
    }
    if (!moved) {
      if (moves.length > bestLen) {
        bestLen = moves.length
        found.clear()
      }
      if (moves.length === bestLen) {
        const k = orders ? moves.map((m) => `${m.from}>${m.to}`).join() : key(cur)
        if (!found.has(k)) found.set(k, { moves, end: cur })
      }
    }
  }
  for (const o of dieOrders) walk(s, o, [])
  let best = [...found.values()]
  if (!seq && bestLen === 1) {
    const high = Math.max(...dice)
    const withHigh = best.filter((p) => p.moves[0].die === high)
    if (withHigh.length) best = withHigh
  }
  return best
}

/** Every legal order of moves for `p` with these dice, in `p`'s own numbering. */
export const legalPlays = (b: Board, p: Player, dice: number[]) => plays(side(b, p), dice, true).map((x) => x.moves)

const sameMove = (a: Move, b: Move) => a.from === b.from && a.to === b.to

/** Single moves allowed after `done`: the next move of every legal play that starts with `done`. */
export function nextMoves(all: Move[][], done: Move[]): Move[] {
  const out: Move[] = []
  for (const play of all) {
    if (play.length <= done.length || !done.every((d, k) => sameMove(d, play[k]))) continue
    const m = play[done.length]
    if (!out.some((o) => sameMove(o, m))) out.push(m)
  }
  return out
}

/** Applies one move of `p` (in `p`'s numbering) to the board. */
export function move(b: Board, p: Player, m: Move): Board {
  return board(apply(side(b, p), m), p)
}

/** Pips `p` still has to travel. */
export function pips(b: Board, p: Player): number {
  const s = side(b, p)
  return s.me.reduce((t, v, i) => t + v * (i + 1), 0) + s.bar[0] * 25
}

/** 1 single, 2 gammon, 3 backgammon, or 0 while nobody has borne off all 15. */
export function winValue(b: Board, p: Player): number {
  if (b.off[p] < 15) return 0
  const q = (1 - p) as Player
  if (b.off[q] > 0) return 1
  const s = side(b, q)
  // The loser still has a checker on the bar or in the winner's home board.
  if (s.bar[0] || s.me.slice(18).some(Boolean)) return 3
  return 2
}

export function roll(rng: Rng): [number, number] {
  return [1 + randomInt(rng, 6), 1 + randomInt(rng, 6)]
}

/** Opening roll: each side throws one die until they differ; the higher moves first with both. */
export function openingRoll(rng: Rng): { first: Player; dice: [number, number] } {
  while (true) {
    const [a, b] = roll(rng)
    if (a !== b) return { first: a > b ? 0 : 1, dice: [a, b] }
  }
}

// ── Computer ────────────────────────────────────────

/** Chance (out of 36) of being hit by an opponent at this distance. */
const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3]

/** Static score of a position for the side that just moved (`me` in `s`). */
function evaluate(s: Side): number {
  if (s.off[0] === 15) return 1000
  const myPips = s.me.reduce((t, v, i) => t + v * (i + 1), 0) + s.bar[0] * 25
  // `op` is in my numbering too: the opponent's checker at my point i still has 24 - i to go.
  const opAt = (i: number) => s.op[i]
  const opPips = s.op.reduce((t, v, i) => t + v * (24 - i), 0) + s.bar[1] * 25
  // Contact: some opponent checker still has to pass one of mine.
  let myBack = -1
  for (let i = 23; i >= 0; i--) if (s.me[i]) {
    myBack = i
    break
  }
  if (s.bar[0]) myBack = 24
  let opBack = 24
  for (let i = 0; i < 24; i++) if (opAt(i)) {
    opBack = i
    break
  }
  if (s.bar[1]) opBack = -1
  const contact = myBack > opBack

  let score = (opPips - myPips) * 1.0 + s.off[0] * 2 - s.off[1] * 2
  if (!contact) return score + s.off[0] * 3

  for (let i = 0; i < 24; i++) {
    const v = s.me[i]
    if (v >= 2) {
      // Made points: the home board and the opponent's outfield matter most.
      score += i < 6 ? 6 : i < 12 ? 3 : i >= 18 ? 2.5 : 1.5
    } else if (v === 1) {
      // A blot: chance of being hit from behind, weighted by how far it would go back.
      // Opponents move up my numbering, so they hit from below (or entering from the bar).
      let shots = s.bar[1] ? SHOTS[Math.min(i + 1, 12)] : 0
      for (let j = i - 1; j >= Math.max(0, i - 12); j--) if (opAt(j)) shots = Math.max(shots, SHOTS[i - j])
      score -= (shots / 36) * (8 + (24 - i) * 0.6)
    }
  }
  // Primes: consecutive made points in front of the opponent.
  let run = 0
  for (let i = 0; i < 18; i++) {
    run = s.me[i] >= 2 ? run + 1 : 0
    if (run >= 3) score += run * 1.5
  }
  score += s.bar[1] * 8 - s.bar[0] * 8
  return score
}

/** Mirror a side so that the opponent becomes `me`. */
const flip = (s: Side): Side => ({
  me: s.op.map((_, i) => s.op[23 - i]),
  op: s.me.map((_, i) => s.me[23 - i]),
  bar: [s.bar[1], s.bar[0]],
  off: [s.off[1], s.off[0]],
})

const ROLLS: [number, number, number][] = []
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push([a, b, a === b ? 1 : 2])

/** The play the computer chooses for `p` (in `p`'s numbering). */
export function aiPlay(b: Board, p: Player, dice: number[], difficulty: Difficulty, rng: Rng): Move[] {
  const s = side(b, p)
  const options = plays(s, dice)
  if (!options.length || !options[0].moves.length) return []
  const scored = options.map((o) => ({ o, v: evaluate(o.end) })).sort((a, b) => b.v - a.v)
  if (difficulty === 'easy') return scored[randomInt(rng, Math.min(4, scored.length))].o.moves
  if (difficulty === 'medium') return scored[0].o.moves
  // Hard: of the best few, the one that leaves the opponent the worst average reply.
  let best = scored[0].o
  let bestV = -Infinity
  for (const { o } of scored.slice(0, 6)) {
    const them = flip(o.end)
    let total = 0
    for (const [d1, d2, w] of ROLLS) {
      const replies = plays(them, [d1, d2])
      const reply = replies.length && replies[0].moves.length ? Math.max(...replies.map((r) => evaluate(r.end))) : evaluate(them)
      total -= reply * w
    }
    if (total / 36 > bestV) [bestV, best] = [total / 36, o]
  }
  return best.moves
}
