import { type Rng, randomInt, shuffled } from '../../lib/rng'

/**
 * Gem maze: collect every gem in a generated maze while guards roam it.
 * The maze is a tile grid (true = wall) of (2·cells+1)² tiles, carved by a
 * random depth-first walk with some extra openings so there are loops to escape by.
 */
export type Dir = 'up' | 'down' | 'left' | 'right'
export const DELTA: Record<Dir, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }
const DIRS: Dir[] = ['up', 'down', 'left', 'right']
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export type Mover = { r: number; c: number; dir: Dir | null; progress: number } // progress 0..1 towards the next tile
export type State = {
  size: number // tiles per side
  walls: boolean[]
  gems: number[]
  player: Mover
  want: Dir | null
  guards: Mover[]
  lives: number
  level: number
  score: number
  hitTimer: number
  over: boolean
  cleared: boolean
}

export function carve(cells: number, rng: Rng): boolean[] {
  const size = 2 * cells + 1
  const walls = Array(size * size).fill(true)
  const at = (r: number, c: number) => r * size + c
  const seen = new Set<number>()
  const stack: [number, number][] = [[0, 0]]
  seen.add(0)
  walls[at(1, 1)] = false
  while (stack.length) {
    const [r, c] = stack[stack.length - 1]
    const next = shuffled(DIRS, rng)
      .map((d) => [r + DELTA[d][0], c + DELTA[d][1]] as [number, number])
      .filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < cells && cc < cells && !seen.has(rr * cells + cc))
    if (!next.length) {
      stack.pop()
      continue
    }
    const [rr, cc] = next[0]
    seen.add(rr * cells + cc)
    walls[at(2 * rr + 1, 2 * cc + 1)] = false
    walls[at(r + rr + 1, c + cc + 1)] = false
    stack.push([rr, cc])
  }
  // Knock out some inner walls between two open tiles to make loops.
  for (let k = 0; k < cells * cells * 0.18; k++) {
    const r = 1 + randomInt(rng, size - 2)
    const c = 1 + randomInt(rng, size - 2)
    if (!walls[at(r, c)]) continue
    const horiz = !walls[at(r, c - 1)] && !walls[at(r, c + 1)] && walls[at(r - 1, c)] && walls[at(r + 1, c)]
    const vert = !walls[at(r - 1, c)] && !walls[at(r + 1, c)] && walls[at(r, c - 1)] && walls[at(r, c + 1)]
    if (horiz || vert) walls[at(r, c)] = false
  }
  return walls
}

export const open = (st: Pick<State, 'size' | 'walls'>, r: number, c: number) =>
  r >= 0 && c >= 0 && r < st.size && c < st.size && !st.walls[r * st.size + c]

/** First step from (r, c) on a shortest path to (tr, tc), or null. */
export function towards(st: Pick<State, 'size' | 'walls'>, r: number, c: number, tr: number, tc: number): Dir | null {
  const n = st.size
  const from = new Map<number, Dir>()
  const start = r * n + c
  const queue = [start]
  const seen = new Set([start])
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]
    if (i === tr * n + tc) return from.get(i) ?? null
    for (const d of DIRS) {
      const rr = Math.floor(i / n) + DELTA[d][0]
      const cc = (i % n) + DELTA[d][1]
      const j = rr * n + cc
      if (!open(st, rr, cc) || seen.has(j)) continue
      seen.add(j)
      from.set(j, from.get(i) ?? d)
      queue.push(j)
    }
  }
  return null
}

const mover = (r: number, c: number): Mover => ({ r, c, dir: null, progress: 0 })

/** Guards start in the far corners. */
const corners = (size: number): [number, number][] => [[size - 2, size - 2], [1, size - 2], [size - 2, 1]]

export function newLevel(level: number, rng: Rng, keep?: Pick<State, 'score' | 'lives'>): State {
  const cells = Math.min(6 + level, 12)
  const walls = carve(cells, rng)
  const size = 2 * cells + 1
  const st: State = {
    size,
    walls,
    gems: [],
    player: mover(1, 1),
    want: null,
    guards: [],
    lives: keep?.lives ?? 3,
    level,
    score: keep?.score ?? 0,
    hitTimer: 0,
    over: false,
    cleared: false,
  }
  const floor = walls.flatMap((w, i) => (w ? [] : [i])).filter((i) => i !== size + 1)
  st.gems = shuffled(floor, rng).slice(0, 10 + level * 3)
  st.guards = corners(size).slice(0, Math.min(3, 1 + Math.floor((level + 1) / 2))).map(([r, c]) => mover(r, c))
  return st
}

const PLAYER_SPEED = 6.5 // tiles per second
const guardSpeed = (level: number) => Math.min(5.8, 3.4 + level * 0.3)

/** Moves `m` along; at each tile centre `choose` picks the next direction. */
function advance(st: State, m: Mover, speed: number, dt: number, choose: (m: Mover) => Dir | null): Mover {
  let { r, c, dir, progress } = m
  let left = speed * dt
  while (left > 0) {
    if (!dir || progress === 0) {
      const d = choose({ r, c, dir, progress })
      if (!d || !open(st, r + DELTA[d][0], c + DELTA[d][1])) return { r, c, dir: null, progress: 0 }
      dir = d
    }
    const take = Math.min(left, 1 - progress)
    progress += take
    left -= take
    if (progress >= 1) {
      r += DELTA[dir][0]
      c += DELTA[dir][1]
      progress = 0
    }
  }
  return { r, c, dir, progress }
}

/** Where a mover is drawn, in tiles. */
export const posOf = (m: Mover) => ({ y: m.r + (m.dir ? DELTA[m.dir][0] * m.progress : 0), x: m.c + (m.dir ? DELTA[m.dir][1] * m.progress : 0) })

export function step(st: State, want: Dir | null, dt: number, rng: Rng): State {
  if (st.over || st.cleared) return st
  const s: State = { ...st, want: want ?? st.want, hitTimer: Math.max(0, st.hitTimer - dt) }
  s.player = advance(s, s.player, PLAYER_SPEED, dt, (m) => {
    if (s.want && open(s, m.r + DELTA[s.want][0], m.c + DELTA[s.want][1])) return s.want
    return m.dir && open(s, m.r + DELTA[m.dir][0], m.c + DELTA[m.dir][1]) ? m.dir : null
  })
  // Turning back is allowed mid-tile.
  if (s.want && s.player.dir && s.want === OPPOSITE[s.player.dir] && s.player.progress > 0)
    s.player = { r: s.player.r + DELTA[s.player.dir][0], c: s.player.c + DELTA[s.player.dir][1], dir: s.want, progress: 1 - s.player.progress }

  const gems = s.gems
  const here = s.player.r * s.size + s.player.c
  if (gems.includes(here)) {
    s.gems = gems.filter((g) => g !== here)
    s.score += 10
  }

  // Guards: usually head for the player, sometimes wander (never straight back unless stuck).
  const chase = Math.min(0.85, 0.45 + s.level * 0.06)
  s.guards = s.guards.map((g) =>
    advance(s, g, guardSpeed(s.level), dt, (m) => {
      const options = DIRS.filter((d) => open(s, m.r + DELTA[d][0], m.c + DELTA[d][1]) && (!m.dir || d !== OPPOSITE[m.dir]))
      if (rng() < chase) {
        const d = towards(s, m.r, m.c, s.player.r, s.player.c)
        if (d) return d
      }
      return options.length ? options[randomInt(rng, options.length)] : m.dir ? OPPOSITE[m.dir] : null
    }),
  )

  const p = posOf(s.player)
  const caught = s.hitTimer === 0 && s.guards.some((g) => {
    const q = posOf(g)
    return Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 0.7
  })
  if (caught) {
    s.lives--
    if (s.lives <= 0) return { ...s, over: true }
    s.player = mover(1, 1)
    s.want = null
    s.guards = s.guards.map((_, k) => mover(...corners(s.size)[k]))
    s.hitTimer = 1.5
  }
  if (!s.gems.length) return { ...s, cleared: true, score: s.score + 50 * s.level }
  return s
}
