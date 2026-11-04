import type { Rng } from '../../lib/rng'

/**
 * Orbital defence (our take on the space shooter): a formation sweeps side to
 * side and steps down; shoot it before it lands. Shields soak up shots.
 */
export const W = 400
export const H = 600
export const COLS = 8
export const ROWS = 5
export const ALIEN_W = 28
export const ALIEN_H = 20
const GAP_X = 14
const GAP_Y = 14
export const SHIP_W = 34
export const SHIP_Y = H - 46
const SHIP_SPEED = 260
const SHOT_SPEED = 520
const BOMB_SPEED = 190
const STEP_DOWN = 16
export const BLOCK = 6

export type Alien = { col: number; row: number; alive: boolean }
export type Shot = { x: number; y: number }
export type State = {
  aliens: Alien[]
  ox: number // formation offset
  oy: number
  dir: 1 | -1
  ship: number
  shot: Shot | null
  bombs: Shot[]
  shields: { x: number; y: number }[]
  score: number
  lives: number
  wave: number
  hitTimer: number // seconds of invulnerability after being hit
  over: boolean
}

export const alienX = (st: State, a: Alien) => st.ox + a.col * (ALIEN_W + GAP_X)
export const alienY = (st: State, a: Alien) => st.oy + a.row * (ALIEN_H + GAP_Y)
/** Top rows are worth more. */
export const points = (row: number) => [40, 30, 20, 20, 10][row] ?? 10

function shields(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let s = 0; s < 3; s++) {
    const left = 48 + s * 122
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 9; c++) {
        // An arch: the bottom middle is open.
        if (r >= 2 && c >= 3 && c <= 5) continue
        out.push({ x: left + c * BLOCK, y: SHIP_Y - 70 + r * BLOCK })
      }
  }
  return out
}

function wave(n: number, keep?: Pick<State, 'score' | 'lives'>): State {
  const aliens: Alien[] = []
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) aliens.push({ col, row, alive: true })
  return {
    aliens,
    ox: 20,
    oy: 60 + Math.min(4, n - 1) * 14,
    dir: 1,
    ship: W / 2,
    shot: null,
    bombs: [],
    shields: shields(),
    score: keep?.score ?? 0,
    lives: keep?.lives ?? 3,
    wave: n,
    hitTimer: 0,
    over: false,
  }
}

export const newGame = (): State => wave(1)

/** Formation speed: faster with fewer aliens left and on later waves. */
export function speed(st: State): number {
  const left = st.aliens.filter((a) => a.alive).length
  return (28 + (ROWS * COLS - left) * 4.2) * (1 + (st.wave - 1) * 0.15)
}

export type Input = { dir: number; fire: boolean }

const overlaps = (x: number, y: number, w: number, h: number, px: number, py: number) => px >= x && px <= x + w && py >= y && py <= y + h

export function step(st: State, input: Input, dt: number, rng: Rng): State {
  if (st.over) return st
  const s: State = { ...st, aliens: st.aliens, bombs: [...st.bombs], shields: st.shields, hitTimer: Math.max(0, st.hitTimer - dt) }
  s.ship = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, s.ship + input.dir * SHIP_SPEED * dt))
  if (input.fire && !s.shot) s.shot = { x: s.ship, y: SHIP_Y - 6 }

  // Formation: sweep, and step down and turn at the edges.
  const alive = s.aliens.filter((a) => a.alive)
  const minCol = Math.min(...alive.map((a) => a.col))
  const maxCol = Math.max(...alive.map((a) => a.col))
  s.ox += s.dir * speed(s) * dt
  const left = s.ox + minCol * (ALIEN_W + GAP_X)
  const right = s.ox + maxCol * (ALIEN_W + GAP_X) + ALIEN_W
  if (right > W - 8 || left < 8) {
    s.ox -= s.dir * speed(s) * dt
    s.dir = s.dir === 1 ? -1 : 1
    s.oy += STEP_DOWN
  }

  // The player's shot.
  if (s.shot) {
    const shot = { x: s.shot.x, y: s.shot.y - SHOT_SPEED * dt }
    s.shot = shot.y < 0 ? null : shot
    if (s.shot) {
      const hit = s.aliens.find((a) => a.alive && overlaps(alienX(s, a), alienY(s, a), ALIEN_W, ALIEN_H, shot.x, shot.y))
      if (hit) {
        s.aliens = s.aliens.map((a) => (a === hit ? { ...a, alive: false } : a))
        s.score += points(hit.row)
        s.shot = null
      } else {
        const block = s.shields.findIndex((b) => overlaps(b.x, b.y, BLOCK, BLOCK, shot.x, shot.y))
        if (block >= 0) {
          s.shields = s.shields.filter((_, k) => k !== block)
          s.shot = null
        }
      }
    }
  }

  // Bombs from the lowest alien of a random column.
  const rate = 0.9 + s.wave * 0.25
  if (rng() < rate * dt) {
    const bottoms = new Map<number, Alien>()
    for (const a of s.aliens) if (a.alive && (!bottoms.has(a.col) || bottoms.get(a.col)!.row < a.row)) bottoms.set(a.col, a)
    const list = [...bottoms.values()]
    if (list.length) {
      const a = list[Math.floor(rng() * list.length)]
      s.bombs.push({ x: alienX(s, a) + ALIEN_W / 2, y: alienY(s, a) + ALIEN_H })
    }
  }
  const bombs: Shot[] = []
  let hitShip = false
  for (const b of s.bombs) {
    const nb = { x: b.x, y: b.y + BOMB_SPEED * dt }
    if (nb.y > H) continue
    const block = s.shields.findIndex((q) => overlaps(q.x, q.y, BLOCK, BLOCK, nb.x, nb.y))
    if (block >= 0) {
      s.shields = s.shields.filter((_, k) => k !== block)
      continue
    }
    if (overlaps(s.ship - SHIP_W / 2, SHIP_Y, SHIP_W, 18, nb.x, nb.y) && s.hitTimer === 0) {
      hitShip = true
      continue
    }
    bombs.push(nb)
  }
  s.bombs = bombs
  if (hitShip) {
    s.lives--
    s.hitTimer = 1.5
    s.bombs = []
    if (s.lives <= 0) s.over = true
  }

  // Aliens eat through shields they touch; reaching the ship's row ends the game.
  const lowest = Math.max(...s.aliens.filter((a) => a.alive).map((a) => alienY(s, a) + ALIEN_H), 0)
  if (lowest >= SHIP_Y - 70) s.shields = s.shields.filter((b) => b.y > lowest)
  if (lowest >= SHIP_Y) s.over = true

  if (!s.over && s.aliens.every((a) => !a.alive)) return wave(s.wave + 1, { score: s.score, lives: Math.min(5, s.lives + 1) })
  return s
}
