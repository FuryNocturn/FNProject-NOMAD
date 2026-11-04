import { type Rng, randomInt } from '../../lib/rng'

/**
 * Bubble shooter: aim, shoot, and pop groups of three or more of a colour;
 * bubbles left hanging fall. Hex grid of COLS bubbles; odd rows (counting
 * `parity`) are shifted half a bubble right and hold one fewer.
 */
export const W = 400
export const H = 600
export const COLS = 10
export const R = W / (2 * COLS)
export const ROW_H = R * Math.sqrt(3)
export const SHOOTER = { x: W / 2, y: H - 40 }
export const LOSE_ROW = 14
const SHOT_SPEED = 900
const ADD_EVERY = 6

export type Cell = number | null // colour index
export type Shot = { x: number; y: number; vx: number; vy: number; colour: number }
export type State = {
  rows: Cell[][]
  parity: 0 | 1
  shot: Shot | null
  next: number
  after: number
  shots: number // since the last new row
  score: number
  level: number
  colours: number
  over: boolean
  cleared: boolean
}

export const shifted = (st: Pick<State, 'parity'>, r: number) => (r + st.parity) % 2 === 1
export const rowLen = (st: Pick<State, 'parity'>, r: number) => (shifted(st, r) ? COLS - 1 : COLS)
export const centre = (st: Pick<State, 'parity'>, r: number, c: number) => ({ x: R + c * 2 * R + (shifted(st, r) ? R : 0), y: R + r * ROW_H })

export function neighbours(st: Pick<State, 'parity'>, r: number, c: number): [number, number][] {
  const d = shifted(st, r) ? [0, 1] : [-1, 0]
  const out: [number, number][] = [[r, c - 1], [r, c + 1], [r - 1, c + d[0]], [r - 1, c + d[1]], [r + 1, c + d[0]], [r + 1, c + d[1]]]
  return out.filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < rowLen(st, rr))
}

const randomRow = (st: Pick<State, 'parity'>, r: number, colours: number, rng: Rng): Cell[] =>
  Array.from({ length: COLS }, (_, c) => (c < rowLen(st, r) ? randomInt(rng, colours) : null))

const present = (st: State) => [...new Set(st.rows.flat().filter((v): v is number => v !== null))]

function pick(st: State, rng: Rng): number {
  const list = present(st)
  return list.length ? list[randomInt(rng, list.length)] : randomInt(rng, st.colours)
}

export function newLevel(level: number, rng: Rng, score = 0): State {
  const colours = Math.min(3 + level, 6)
  const st: State = { rows: [], parity: 0, shot: null, next: 0, after: 0, shots: 0, score, level, colours, over: false, cleared: false }
  for (let r = 0; r < 4 + Math.min(level, 4); r++) st.rows.push(randomRow(st, r, colours, rng))
  st.next = pick(st, rng)
  st.after = pick(st, rng)
  return st
}

const get = (st: State, r: number, c: number) => st.rows[r]?.[c] ?? null

/** Same-colour group joined to (r, c). */
function cluster(st: State, r: number, c: number): [number, number][] {
  const colour = get(st, r, c)
  const seen = new Set([`${r},${c}`])
  const out: [number, number][] = [[r, c]]
  for (let k = 0; k < out.length; k++)
    for (const [rr, cc] of neighbours(st, out[k][0], out[k][1])) {
      const key = `${rr},${cc}`
      if (!seen.has(key) && get(st, rr, cc) === colour) {
        seen.add(key)
        out.push([rr, cc])
      }
    }
  return out
}

/** Bubbles not joined to the top row. */
function floating(st: State): [number, number][] {
  const seen = new Set<string>()
  const queue: [number, number][] = []
  st.rows[0]?.forEach((v, c) => {
    if (v !== null) {
      seen.add(`0,${c}`)
      queue.push([0, c])
    }
  })
  for (let k = 0; k < queue.length; k++)
    for (const [rr, cc] of neighbours(st, queue[k][0], queue[k][1]))
      if (get(st, rr, cc) !== null && !seen.has(`${rr},${cc}`)) {
        seen.add(`${rr},${cc}`)
        queue.push([rr, cc])
      }
  const out: [number, number][] = []
  st.rows.forEach((row, r) => row.forEach((v, c) => v !== null && !seen.has(`${r},${c}`) && out.push([r, c])))
  return out
}

/** Puts a bubble in the nearest free cell to (x, y), then pops and drops. */
export function land(st: State, x: number, y: number, colour: number, rng: Rng): State {
  const s: State = { ...st, rows: st.rows.map((row) => [...row]), shot: null }
  const rApprox = Math.max(0, Math.round((y - R) / ROW_H))
  let best: [number, number] | null = null
  let bestD = Infinity
  for (let r = Math.max(0, rApprox - 1); r <= rApprox + 1; r++)
    for (let c = 0; c < rowLen(s, r); c++) {
      if (get(s, r, c) !== null) continue
      const p = centre(s, r, c)
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < bestD) [bestD, best] = [d, [r, c]]
    }
  if (!best) return { ...s, over: true }
  const [r, c] = best
  while (s.rows.length <= r) s.rows.push(Array.from({ length: COLS }, () => null))
  s.rows[r][c] = colour
  let popped = false
  const group = cluster(s, r, c)
  if (group.length >= 3) {
    popped = true
    for (const [rr, cc] of group) s.rows[rr][cc] = null
    s.score += group.length * 10
    const fall = floating(s)
    for (const [rr, cc] of fall) s.rows[rr][cc] = null
    s.score += fall.length * 20
  }
  while (s.rows.length && s.rows.at(-1)!.every((v) => v === null)) s.rows.pop()
  if (!s.rows.length) return { ...s, cleared: true }
  s.shots = popped ? s.shots : s.shots + 1
  // Every few shots without a pop, the ceiling comes down a row.
  if (s.shots >= ADD_EVERY) {
    s.parity = s.parity === 0 ? 1 : 0
    s.rows.unshift(randomRow(s, 0, s.colours, rng))
    s.shots = 0
  }
  if (s.rows.length > LOSE_ROW) s.over = true
  return s
}

/** Shoots the waiting bubble at `angle` (radians, 0 = right, π/2 = straight up). */
export function shoot(st: State, angle: number, rng: Rng): State {
  if (st.shot || st.over || st.cleared) return st
  const a = Math.max(0.15, Math.min(Math.PI - 0.15, angle))
  return {
    ...st,
    shot: { x: SHOOTER.x, y: SHOOTER.y, vx: Math.cos(a) * SHOT_SPEED, vy: -Math.sin(a) * SHOT_SPEED, colour: st.next },
    next: st.after,
    after: pick(st, rng),
  }
}

export function step(st: State, dt: number, rng: Rng): State {
  if (!st.shot) return st
  let { x, y, vx } = st.shot
  const { vy, colour } = st.shot
  // Small sub-steps so a fast bubble cannot pass between two others.
  const n = Math.ceil((SHOT_SPEED * dt) / (R / 2))
  for (let k = 0; k < n; k++) {
    x += (vx * dt) / n
    y += (vy * dt) / n
    if (x < R) [x, vx] = [2 * R - x, Math.abs(vx)]
    if (x > W - R) [x, vx] = [2 * (W - R) - x, -Math.abs(vx)]
    if (y <= R) return land(st, x, y, colour, rng)
    for (let r = 0; r < st.rows.length; r++)
      for (let c = 0; c < COLS; c++) {
        if (st.rows[r][c] === null) continue
        const p = centre(st, r, c)
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < (2 * R * 0.88) ** 2) return land(st, x, y, colour, rng)
      }
  }
  return { ...st, shot: { x, y, vx, vy, colour } }
}
