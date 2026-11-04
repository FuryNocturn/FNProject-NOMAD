import { type Rng, randomInt, seededRng, shuffled } from '../../lib/rng'

/**
 * Sokoban with generated levels. Each level number always gives the same
 * puzzle: a random room, then a search that pulls the boxes back from the
 * goals to the position that needs the most pushes. Pulling backwards from
 * the solved state guarantees every level can be solved.
 * Text format (for tests): # wall, . goal, $ box, * box on a goal, @ player.
 */
export type Level = { w: number; h: number; walls: boolean[]; goals: boolean[] }
export type Pos = { player: number; boxes: number[] }

export function parse(rows: string[]): { level: Level; start: Pos } {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const walls: boolean[] = []
  const goals: boolean[] = []
  const boxes: number[] = []
  let player = -1
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c] ?? ' '
      const i = r * w + c
      walls.push(ch === '#')
      goals.push(ch === '.' || ch === '*' || ch === '+')
      if (ch === '$' || ch === '*') boxes.push(i)
      if (ch === '@' || ch === '+') player = i
    }
  return { level: { w, h, walls, goals }, start: { player, boxes: boxes.sort((a, b) => a - b) } }
}

export type Dir = 'up' | 'down' | 'left' | 'right'
const step = (l: Level, d: Dir) => ({ up: -l.w, down: l.w, left: -1, right: 1 })[d]

/** The position after a step, whether it pushed a box, or null when blocked. */
export function walk(l: Level, p: Pos, d: Dir): { pos: Pos; pushed: boolean } | null {
  const s = step(l, d)
  const to = p.player + s
  if (l.walls[to]) return null
  const k = p.boxes.indexOf(to)
  if (k < 0) return { pos: { player: to, boxes: p.boxes }, pushed: false }
  const beyond = to + s
  if (l.walls[beyond] || p.boxes.includes(beyond)) return null
  const boxes = [...p.boxes]
  boxes[k] = beyond
  return { pos: { player: to, boxes: boxes.sort((a, b) => a - b) }, pushed: true }
}

export const solved = (l: Level, p: Pos) => p.boxes.every((b) => l.goals[b])

/** Squares from which a box can still be pushed onto some goal (pulling back from the goals). */
export function liveSquares(l: Level): boolean[] {
  const live = l.goals.slice()
  const queue = l.goals.flatMap((g, i) => (g ? [i] : []))
  for (let k = 0; k < queue.length; k++)
    for (const s of [-l.w, l.w, -1, 1]) {
      const from = queue[k] + s
      if (!l.walls[from] && !l.walls[from + s] && !live[from]) {
        live[from] = true
        queue.push(from)
      }
    }
  return live
}

/**
 * Fewest pushes to solve, or -1 (breadth-first over box positions, with the
 * player's reachable area as part of the state). Only used by the tests.
 */
export function minPushes(l: Level, start: Pos, limit = 400000): number {
  const n = l.w * l.h
  const steps = [-l.w, l.w, -1, 1]
  const live = liveSquares(l)
  const occupied = new Uint8Array(n)
  const mark = new Int32Array(n)
  let stamp = 0
  const queue = new Int32Array(n)
  // Marks the player's reachable squares with the current stamp; returns the smallest one.
  const reach = (player: number) => {
    stamp++
    let len = 0
    let min = player
    queue[len++] = player
    mark[player] = stamp
    for (let k = 0; k < len; k++)
      for (const s of steps) {
        const q = queue[k] + s
        if (l.walls[q] || occupied[q] || mark[q] === stamp) continue
        mark[q] = stamp
        queue[len++] = q
        if (q < min) min = q
      }
    return min
  }
  const key = (boxes: number[], player: number) => {
    for (const b of boxes) occupied[b] = 1
    const k = `${reach(player)}|${boxes.join(',')}`
    for (const b of boxes) occupied[b] = 0
    return k
  }
  let frontier = [start]
  const seen = new Set([key(start.boxes, start.player)])
  for (let depth = 0; frontier.length; depth++) {
    const next: Pos[] = []
    for (const p of frontier) {
      if (solved(l, p)) return depth
      for (const b of p.boxes) occupied[b] = 1
      reach(p.player)
      const pushes: [number, number][] = []
      for (const b of p.boxes)
        for (const s of steps) {
          const to = b + s
          if (mark[b - s] === stamp && !l.walls[to] && !occupied[to] && live[to]) pushes.push([b, to])
        }
      for (const b of p.boxes) occupied[b] = 0
      for (const [b, to] of pushes) {
        const boxes = p.boxes.map((x) => (x === b ? to : x)).sort((x, y) => x - y)
        const k = key(boxes, b)
        if (seen.has(k)) continue
        seen.add(k)
        next.push({ player: b, boxes })
        if (seen.size > limit) return -1
      }
    }
    frontier = next
  }
  return -1
}

/** Size, boxes and shortest solution wanted for level `n` (1-based). */
function spec(n: number) {
  if (n <= 3) return { w: 6, h: 6, boxes: 2, min: 6 + n }
  if (n <= 8) return { w: 7, h: 7, boxes: 3, min: 10 + n }
  if (n <= 15) return { w: 8, h: 7, boxes: 3, min: 14 + n }
  // shortcut: 4 boxes made generation take seconds; 3 boxes in a bigger room stays under 1 s.
  return { w: 8, h: 8, boxes: 3, min: 30 }
}

/** A walled room of `w`×`h` inner squares with some wall blocks, all floor connected. */
function room(w: number, h: number, rng: Rng): Level | null {
  const W = w + 2
  const H = h + 2
  const walls = Array.from({ length: W * H }, (_, i) => {
    const r = Math.floor(i / W)
    const c = i % W
    return r === 0 || c === 0 || r === H - 1 || c === W - 1
  })
  const blocks = Math.floor((w * h) / 7)
  for (let k = 0; k < blocks; k++) {
    const r = 1 + randomInt(rng, h)
    const c = 1 + randomInt(rng, w)
    walls[r * W + c] = true
    if (rng() < 0.4) walls[r * W + Math.min(w, c + 1)] = true
  }
  const floor = walls.flatMap((x, i) => (x ? [] : [i]))
  if (floor.length < w * h * 0.6) return null
  const seen = new Set([floor[0]])
  const queue = [floor[0]]
  for (let k = 0; k < queue.length; k++)
    for (const s of [-W, W, -1, 1]) {
      const q = queue[k] + s
      if (!walls[q] && !seen.has(q)) {
        seen.add(q)
        queue.push(q)
      }
    }
  if (seen.size !== floor.length) return null
  return { w: W, h: H, walls, goals: walls.map(() => false) }
}

/**
 * From the solved position, every position reachable by pulling boxes;
 * returns the one furthest away in pushes (ties: boxes moved the most).
 */
function furthest(l: Level, goals: number[], limit: number): { pos: Pos; pushes: number } | null {
  const n = l.w * l.h
  const steps = [-l.w, l.w, -1, 1]
  const occupied = new Uint8Array(n)
  const mark = new Int32Array(n)
  const queue = new Int32Array(n)
  let stamp = 0
  // Marks the squares the player can reach (boxes set in `occupied`); returns the smallest.
  const reach = (player: number) => {
    stamp++
    let len = 0
    let min = player
    queue[len++] = player
    mark[player] = stamp
    for (let k = 0; k < len; k++)
      for (const s of steps) {
        const q = queue[k] + s
        if (l.walls[q] || occupied[q] || mark[q] === stamp) continue
        mark[q] = stamp
        queue[len++] = q
        if (q < min) min = q
      }
    return min
  }
  const keyOf = (boxes: number[], player: number) => {
    for (const b of boxes) occupied[b] = 1
    const k = `${reach(player)}|${boxes.join(',')}`
    for (const b of boxes) occupied[b] = 0
    return k
  }
  const seen = new Set<string>()
  let frontier: Pos[] = []
  // The player may finish anywhere, so every free region around the solved boxes is a start.
  for (let i = 0; i < n; i++) {
    if (l.walls[i] || goals.includes(i)) continue
    const k = keyOf(goals, i)
    if (seen.has(k)) continue
    seen.add(k)
    frontier.push({ player: i, boxes: goals })
  }
  let best: { pos: Pos; pushes: number; spread: number } | null = null
  for (let depth = 0; frontier.length && seen.size <= limit; depth++) {
    const next: Pos[] = []
    for (const p of frontier) {
      const spread = p.boxes.filter((b) => !l.goals[b]).length
      if (!best || depth > best.pushes || (depth === best.pushes && spread > best.spread)) best = { pos: p, pushes: depth, spread }
      for (const b of p.boxes) occupied[b] = 1
      reach(p.player)
      const pulls: [number, number][] = []
      for (const b of p.boxes)
        for (const s of steps) {
          // Player beside the box at b+s steps back to b+2s, dragging the box to b+s.
          if (mark[b + s] === stamp && !l.walls[b + 2 * s] && !occupied[b + 2 * s]) pulls.push([b, s])
        }
      for (const b of p.boxes) occupied[b] = 0
      for (const [b, s] of pulls) {
        const boxes = p.boxes.map((x) => (x === b ? b + s : x)).sort((x, y) => x - y)
        const k = keyOf(boxes, b + 2 * s)
        if (seen.has(k)) continue
        seen.add(k)
        next.push({ player: b + 2 * s, boxes })
      }
    }
    frontier = next
  }
  return best && best.pushes > 0 ? { pos: best.pos, pushes: best.pushes } : null
}

/** Level `n` (1-based) and its shortest solution in pushes. */
export function generate(n: number): { level: Level; start: Pos; pushes: number } {
  const { w, h, boxes, min } = spec(n)
  const rng = seededRng(n * 7919 + 17)
  let fallback: { level: Level; start: Pos; pushes: number } | null = null
  for (let attempt = 0; attempt < 12; attempt++) {
    const l = room(w, h, rng)
    if (!l) continue
    const floor = l.walls.flatMap((x, i) => (x ? [] : [i]))
    const goals = shuffled(floor, rng).slice(0, boxes).sort((a, b) => a - b)
    for (const g of goals) l.goals[g] = true
    const found = furthest(l, goals, 30000)
    if (!found) continue
    const result = { level: l, start: found.pos, pushes: found.pushes }
    if (found.pushes >= min) return result
    if (!fallback || found.pushes > fallback.pushes) fallback = result
  }
  return fallback!
}
