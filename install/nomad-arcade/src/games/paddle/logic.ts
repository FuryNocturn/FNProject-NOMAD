import type { Rng } from '../../lib/rng'

/**
 * Paddle duel (our take on the classic): the player's paddle at the bottom,
 * the computer's at the top, first to WIN_SCORE points. Units are canvas pixels.
 */
export const W = 400
export const H = 600
export const PADDLE_W = 76
export const PADDLE_H = 12
export const BALL = 10
export const WIN_SCORE = 7
const PLAYER_Y = H - 34
const AI_Y = 22
const START_SPEED = 330
const MAX_SPEED = 820
const PLAYER_SPEED = 620

export type Difficulty = 'easy' | 'medium' | 'hard'
const AI: Record<Difficulty, { speed: number; error: number }> = {
  easy: { speed: 230, error: 46 },
  medium: { speed: 360, error: 24 },
  hard: { speed: 520, error: 8 },
}

export type State = {
  ball: { x: number; y: number; vx: number; vy: number }
  player: number // paddle centre x
  ai: number
  aiAim: number // where the computer is heading, with its error
  score: [number, number] // player, computer
  serveIn: number // seconds until the ball moves
  hits: number
}

export type Input = { dir: number; target: number | null }

function serve(st: State, towardPlayer: boolean, rng: Rng): State {
  const angle = (rng() - 0.5) * 0.9
  const v = START_SPEED
  return {
    ...st,
    ball: { x: W / 2, y: H / 2, vx: Math.sin(angle) * v, vy: Math.cos(angle) * v * (towardPlayer ? 1 : -1) },
    serveIn: 1,
    hits: 0,
  }
}

export const newGame = (rng: Rng): State =>
  serve({ ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, player: W / 2, ai: W / 2, aiAim: W / 2, score: [0, 0], serveIn: 1, hits: 0 }, true, rng)

export const winner = (st: State): 0 | 1 | null => (st.score[0] >= WIN_SCORE ? 0 : st.score[1] >= WIN_SCORE ? 1 : null)

const clampPaddle = (x: number) => Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x))

/** Where the ball will cross height `y`, bouncing off the side walls. */
export function predictX(ball: State['ball'], y: number): number {
  if (ball.vy === 0) return ball.x
  const t = (y - ball.y) / ball.vy
  if (t < 0) return W / 2
  const span = W - BALL
  let x = ball.x - BALL / 2 + ball.vx * t
  x = ((x % (2 * span)) + 2 * span) % (2 * span)
  return (x > span ? 2 * span - x : x) + BALL / 2
}

/** Bounce off a paddle: the further from its centre, the sharper the angle; a little faster each time. */
function bounce(ball: State['ball'], paddleX: number, up: boolean, hits: number) {
  const offset = Math.max(-1, Math.min(1, (ball.x - paddleX) / (PADDLE_W / 2)))
  const speed = Math.min(MAX_SPEED, START_SPEED + hits * 28)
  const angle = offset * 1.05
  return { ...ball, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed * (up ? -1 : 1) }
}

export function step(st: State, input: Input, dt: number, difficulty: Difficulty, rng: Rng): State {
  if (winner(st) !== null) return st
  // Player paddle: towards the finger/mouse if there is one, else the keys.
  let player = st.player
  if (input.target !== null) player += Math.max(-PLAYER_SPEED * dt * 1.6, Math.min(PLAYER_SPEED * dt * 1.6, input.target - player))
  else player += input.dir * PLAYER_SPEED * dt
  player = clampPaddle(player)

  // Computer paddle: heads for where the ball will arrive, give or take its error.
  const cfg = AI[difficulty]
  let aiAim = st.aiAim
  if (st.ball.vy < 0) aiAim = Math.abs(aiAim - predictX(st.ball, AI_Y + PADDLE_H)) > cfg.error * 2 ? predictX(st.ball, AI_Y + PADDLE_H) + (rng() - 0.5) * 2 * cfg.error : aiAim
  else aiAim = W / 2
  const ai = clampPaddle(st.ai + Math.max(-cfg.speed * dt, Math.min(cfg.speed * dt, aiAim - st.ai)))

  if (st.serveIn > 0) return { ...st, player, ai, aiAim, serveIn: Math.max(0, st.serveIn - dt) }

  let ball = { ...st.ball, x: st.ball.x + st.ball.vx * dt, y: st.ball.y + st.ball.vy * dt }
  let hits = st.hits
  if (ball.x < BALL / 2) ball = { ...ball, x: BALL - ball.x, vx: Math.abs(ball.vx) }
  if (ball.x > W - BALL / 2) ball = { ...ball, x: 2 * (W - BALL / 2) - ball.x, vx: -Math.abs(ball.vx) }

  const touches = (py: number, px: number) =>
    ball.y + BALL / 2 >= py && ball.y - BALL / 2 <= py + PADDLE_H && Math.abs(ball.x - px) <= PADDLE_W / 2 + BALL / 2
  if (ball.vy > 0 && touches(PLAYER_Y, player)) {
    ball = bounce({ ...ball, y: PLAYER_Y - BALL / 2 }, player, true, ++hits)
  } else if (ball.vy < 0 && touches(AI_Y, ai)) {
    ball = bounce({ ...ball, y: AI_Y + PADDLE_H + BALL / 2 }, ai, false, ++hits)
  }

  if (ball.y > H + BALL) return serve({ ...st, player, ai, aiAim, score: [st.score[0], st.score[1] + 1] }, true, rng)
  if (ball.y < -BALL) return serve({ ...st, player, ai, aiAim, score: [st.score[0] + 1, st.score[1]] }, false, rng)
  return { ...st, ball, player, ai, aiAim, hits }
}

export const PADDLES = { playerY: PLAYER_Y, aiY: AI_Y }
