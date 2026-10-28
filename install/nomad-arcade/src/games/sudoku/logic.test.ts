import { seededRng } from '../../lib/rng'
import { conflicts, countSolutions, generate, PEERS, solve } from './logic'

const isValidSolution = (g: number[]) =>
  g.every((v, i) => v >= 1 && v <= 9 && PEERS[i].every((j) => g[j] !== v))

test('every cell has 20 peers', () => {
  expect(PEERS.every((p) => p.length === 20)).toBe(true)
})

test.each(['easy', 'medium', 'hard'] as const)('%s puzzles have one solution matching the answer', (d) => {
  const { puzzle, solution } = generate(d, seededRng(42))
  expect(isValidSolution(solution)).toBe(true)
  expect(countSolutions(puzzle)).toBe(1)
  expect(solve(puzzle)).toEqual(solution)
  puzzle.forEach((v, i) => v && expect(v).toBe(solution[i]))
})

test('harder puzzles give fewer clues', () => {
  const clues = (d: 'easy' | 'hard') => generate(d, seededRng(5)).puzzle.filter(Boolean).length
  expect(clues('hard')).toBeLessThan(clues('easy'))
})

test('conflicts flags repeated digits', () => {
  const g = Array(81).fill(0)
  g[0] = 5
  g[8] = 5 // same row
  g[40] = 3
  expect([...conflicts(g)].sort((a, b) => a - b)).toEqual([0, 8])
})
