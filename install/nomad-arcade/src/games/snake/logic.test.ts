import { seededRng } from '../../lib/rng'
import { COLS, type State, newGame, step } from './logic'

const at = (r: number, c: number) => r * COLS + c

test('moves forward and ignores reversing into itself', () => {
  const rng = seededRng(1)
  const st = newGame(rng)
  const head = st.snake[0]
  expect(step(st, 'right', rng).snake[0]).toBe(head + 1)
  expect(step(st, 'left', rng).snake[0]).toBe(head + 1)
  expect(step(st, 'up', rng).snake[0]).toBe(head - COLS)
})

test('eating grows the snake and scores; food never lands on the body', () => {
  const rng = seededRng(2)
  const st: State = { snake: [at(5, 5), at(5, 4)], dir: 'right', food: at(5, 6), alive: true, score: 0 }
  const next = step(st, 'right', rng)
  expect(next.snake).toEqual([at(5, 6), at(5, 5), at(5, 4)])
  expect(next.score).toBe(1)
  expect(next.snake).not.toContain(next.food)
})

test('hitting a wall or the body ends the game; chasing the tail is fine', () => {
  const rng = seededRng(3)
  const wall: State = { snake: [at(0, 3), at(1, 3)], dir: 'up', food: at(9, 9), alive: true, score: 0 }
  expect(step(wall, 'up', rng).alive).toBe(false)
  // A 2x2 loop: the head moves onto the cell the tail is leaving.
  const loop: State = { snake: [at(5, 5), at(6, 5), at(6, 6), at(5, 6)], dir: 'up', food: at(0, 0), alive: true, score: 0 }
  expect(step(loop, 'right', rng).alive).toBe(true)
  const bite: State = { snake: [at(5, 5), at(6, 5), at(6, 6), at(5, 6), at(4, 6)], dir: 'up', food: at(0, 0), alive: true, score: 0 }
  expect(step(bite, 'right', rng).alive).toBe(false)
})
