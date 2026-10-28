import { seededRng } from '../../lib/rng'
import { clueOf, generate, isSolved, solvable, solveLine } from './logic'

test('clues count runs of filled cells', () => {
  expect(clueOf([true, true, false, true])).toEqual([2, 1])
  expect(clueOf([false, false])).toEqual([0])
})

test('line logic: overlaps fill the middle, a full clue fills everything', () => {
  expect(solveLine([4], Array(5).fill(null))).toEqual([null, true, true, true, null])
  expect(solveLine([2, 2], Array(5).fill(null))).toEqual([true, true, false, true, true])
  expect(solveLine([0], Array(3).fill(null))).toEqual([false, false, false])
  expect(solveLine([3], [false, null, null, null, false])).toEqual([false, true, true, true, false])
  expect(solveLine([2], [true, null, true])).toBeNull()
})

test('ambiguous puzzles are rejected', () => {
  // A 2x2 diagonal has two solutions.
  expect(solvable(2, [[1], [1]], [[1], [1]])).toBe(false)
})

test.each([5, 10])('generated %ix%i puzzles are solvable by logic and check correctly', (size) => {
  const p = generate(size, seededRng(size))
  expect(solvable(size, p.rows, p.cols)).toBe(true)
  expect(isSolved(p, p.solution.map((v) => (v ? 1 : 2)))).toBe(true)
  expect(isSolved(p, p.solution.map(() => 0))).toBe(false)
})
