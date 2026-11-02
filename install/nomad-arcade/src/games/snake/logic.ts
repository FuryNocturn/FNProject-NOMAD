import { type Rng, randomInt } from '../../lib/rng'

export const COLS = 18
export const ROWS = 18
export type Dir = 'up' | 'down' | 'left' | 'right'
export type State = {
  snake: number[] // cell indexes, head first
  dir: Dir
  food: number
  alive: boolean
  score: number
}

const DELTA: Record<Dir, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export function placeFood(snake: number[], rng: Rng): number {
  const body = new Set(snake)
  const free = Array.from({ length: COLS * ROWS }, (_, i) => i).filter((i) => !body.has(i))
  return free.length ? free[randomInt(rng, free.length)] : -1
}

export function newGame(rng: Rng): State {
  const mid = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2)
  const snake = [mid, mid - 1, mid - 2]
  return { snake, dir: 'right', food: placeFood(snake, rng), alive: true, score: 0 }
}

/** A turn straight back into the body is ignored, as in the classic game. */
export const turn = (st: State, dir: Dir): Dir => (dir === OPPOSITE[st.dir] ? st.dir : dir)

/** Advances one tick. Hitting a wall or the body ends the game; eating grows the snake. */
export function step(st: State, dir: Dir, rng: Rng): State {
  if (!st.alive) return st
  const d = turn(st, dir)
  const head = st.snake[0]
  const r = Math.floor(head / COLS) + DELTA[d][0]
  const c = (head % COLS) + DELTA[d][1]
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return { ...st, dir: d, alive: false }
  const next = r * COLS + c
  const eats = next === st.food
  // The tail moves away this tick unless the snake grows, so stepping onto it is allowed.
  const body = eats ? st.snake : st.snake.slice(0, -1)
  if (body.includes(next)) return { ...st, dir: d, alive: false }
  const snake = [next, ...body]
  return eats
    ? { ...st, snake, dir: d, food: placeFood(snake, rng), score: st.score + 1 }
    : { ...st, snake, dir: d }
}
