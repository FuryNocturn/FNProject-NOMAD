import { seededRng } from '../../lib/rng'
import { H, PADDLES, W, WIN_SCORE, newGame, predictX, step, winner } from './logic'

const still = { dir: 0, target: null }

test('the ball waits a moment before each serve', () => {
  const st = newGame(seededRng(1))
  const after = step(st, still, 0.5, 'medium', seededRng(1))
  expect(after.ball).toEqual(st.ball)
  expect(after.serveIn).toBeCloseTo(0.5)
})

test('the ball bounces off the side walls', () => {
  let st = { ...newGame(seededRng(2)), serveIn: 0 }
  st = { ...st, ball: { x: 8, y: H / 2, vx: -300, vy: 10 } }
  const after = step(st, still, 0.02, 'medium', seededRng(2))
  expect(after.ball.vx).toBeGreaterThan(0)
  expect(after.ball.x).toBeGreaterThanOrEqual(5)
})

test('the player paddle returns the ball; a miss scores for the computer', () => {
  const rng = seededRng(3)
  const base = { ...newGame(rng), serveIn: 0 }
  const hit = step({ ...base, player: 200, ball: { x: 200, y: PADDLES.playerY - 8, vx: 0, vy: 400 } }, still, 0.02, 'medium', rng)
  expect(hit.ball.vy).toBeLessThan(0)
  const miss = step({ ...base, player: 40, ball: { x: 350, y: H + 5, vx: 0, vy: 400 } }, still, 0.02, 'medium', rng)
  expect(miss.score).toEqual([0, 1])
})

test('prediction follows wall bounces', () => {
  expect(predictX({ x: 200, y: 300, vx: 0, vy: -100 }, 0)).toBeCloseTo(200)
  // Heading left 300 px with 290 px to the wall: bounces back.
  const x = predictX({ x: 100, y: 300, vx: -300, vy: -300 }, 0)
  expect(x).toBeGreaterThan(5)
  expect(x).toBeLessThan(W)
})

test('a hard computer beats a paddle that never moves', () => {
  const rng = seededRng(5)
  let st = newGame(rng)
  for (let k = 0; k < 60 * 300 && winner(st) === null; k++) st = step(st, still, 1 / 60, 'hard', rng)
  expect(winner(st)).toBe(1)
  expect(st.score[1]).toBe(WIN_SCORE)
})
