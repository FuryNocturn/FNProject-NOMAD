import { seededRng } from '../../lib/rng'
import { LEVELS, score, secret } from './logic'

test('scores blacks before whites and never counts a peg twice', () => {
  expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ black: 4, white: 0 })
  expect(score([3, 2, 1, 0], [0, 1, 2, 3])).toEqual({ black: 0, white: 4 })
  expect(score([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ black: 1, white: 2 })
  expect(score([5, 5, 5, 5], [5, 0, 0, 0])).toEqual({ black: 1, white: 0 })
  expect(score([1, 2, 3, 4], [0, 0, 0, 0])).toEqual({ black: 0, white: 0 })
})

test('secrets follow the level', () => {
  const rng = seededRng(9)
  for (const level of ['easy', 'medium', 'hard'] as const) {
    const { colours, pegs, repeats } = LEVELS[level]
    for (let k = 0; k < 50; k++) {
      const code = secret(level, rng)
      expect(code).toHaveLength(pegs)
      expect(code.every((v) => v >= 0 && v < colours)).toBe(true)
      if (!repeats) expect(new Set(code).size).toBe(pegs)
    }
  }
})
