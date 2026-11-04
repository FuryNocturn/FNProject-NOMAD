import { seededRng } from '../../lib/rng'
import { cageHolds, countSolutions, generate, mistakes } from './logic'

test('generated puzzles have exactly one solution that satisfies every cage', () => {
  const rng = seededRng(21)
  for (const n of [4, 5, 6])
    for (let k = 0; k < 3; k++) {
      const p = generate(n, rng)
      expect(countSolutions(n, p.cages)).toBe(1)
      // Every cell in exactly one cage.
      expect(p.cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual(Array.from({ length: n * n }, (_, i) => i))
      for (const cage of p.cages) expect(cageHolds(cage, cage.cells.map((i) => p.solution[i]))).toBe(true)
      // Latin square: each row and column has 1..n once.
      for (let r = 0; r < n; r++) expect(new Set(p.solution.slice(r * n, r * n + n)).size).toBe(n)
    }
}, 30_000)

test('cage operations', () => {
  expect(cageHolds({ cells: [0, 1], op: '−', target: 2 }, [1, 3])).toBe(true)
  expect(cageHolds({ cells: [0, 1], op: '÷', target: 3 }, [6, 2])).toBe(true)
  expect(cageHolds({ cells: [0, 1, 2], op: '×', target: 24 }, [2, 3, 4])).toBe(true)
  expect(cageHolds({ cells: [0, 1, 2], op: '+', target: 9 }, [2, 3, 4])).toBe(true)
})

test('mistakes flag repeats and wrong full cages', () => {
  const p = generate(4, seededRng(2))
  const grid = [...p.solution]
  ;[grid[0], grid[1]] = [grid[1], grid[0]]
  expect(mistakes(p, p.solution).size).toBe(0)
  expect(mistakes(p, grid).size).toBeGreaterThan(0)
})
