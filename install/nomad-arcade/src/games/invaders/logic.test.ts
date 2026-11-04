import { seededRng } from '../../lib/rng'
import { ALIEN_H, ALIEN_W, SHIP_Y, type State, W, alienX, alienY, newGame, points, step } from './logic'

const none = { dir: 0, fire: false }
const calm = () => 0.99 // no bombs

test('a shot kills the alien it reaches and scores', () => {
  let st = newGame()
  const target = st.aliens.find((a) => a.row === 4 && a.col === 3)!
  // Aim a little ahead: the formation keeps moving right while the shot climbs.
  st = { ...st, shields: [], ship: alienX(st, target) + ALIEN_W / 2 + 18 }
  st = step(st, { dir: 0, fire: true }, 0.01, calm)
  for (let k = 0; k < 200 && st.shot; k++) st = step(st, none, 0.01, calm)
  expect(st.aliens.filter((a) => !a.alive)).toHaveLength(1)
  expect(st.score).toBe(points(4))
})

test('the formation turns and steps down at the edge', () => {
  let st: State = { ...newGame(), ox: W - 8 - (7 * (ALIEN_W + 14) + ALIEN_W) - 0.1 }
  const y0 = st.oy
  st = step(st, none, 0.05, calm)
  expect(st.dir).toBe(-1)
  expect(st.oy).toBeGreaterThan(y0)
})

test('a bomb on the ship costs a life; no lives left ends the game', () => {
  const base = newGame()
  let st: State = { ...base, bombs: [{ x: base.ship, y: SHIP_Y - 1 }] }
  st = step(st, none, 0.02, calm)
  expect(st.lives).toBe(2)
  st = { ...st, lives: 1, hitTimer: 0, bombs: [{ x: st.ship, y: SHIP_Y - 1 }] }
  expect(step(st, none, 0.02, calm).over).toBe(true)
})

test('clearing the wave brings a faster one and a life back', () => {
  const base = newGame()
  const last = base.aliens.map((a, i) => ({ ...a, alive: i === 0 }))
  let st: State = { ...base, aliens: last, ship: alienX(base, base.aliens[0]) + ALIEN_W / 2, oy: SHIP_Y - 200 }
  st = { ...st, shot: { x: alienX(st, st.aliens[0]) + ALIEN_W / 2, y: alienY(st, st.aliens[0]) + ALIEN_H } }
  st = step(st, none, 0.01, calm)
  expect(st.wave).toBe(2)
  expect(st.lives).toBe(4)
  expect(st.aliens.every((a) => a.alive)).toBe(true)
})

test('left alone the aliens eventually land', () => {
  const rng = seededRng(2)
  let st = { ...newGame(), lives: 99 }
  for (let k = 0; k < 60 * 600 && !st.over; k++) st = step(st, none, 1 / 60, rng)
  expect(st.over).toBe(true)
})
