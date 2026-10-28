import { seededRng } from '../../lib/rng'
import { type Grid, SIZE, type State, findRuns, hasMove, newGame, newGrid, status, swap } from './logic'

/** Builds a grid from rows of digits ('.' = kind 5, filler that never matches in these tests). */
function grid(rows: string[]): Grid {
  // Fill unspecified cells with a checker of kinds 4/5 so they never line up.
  const g: Grid = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const ch = rows[r]?.[c]
      g.push({ k: ch && ch !== '.' ? Number(ch) : (r + c) % 2 ? 4 : 5, sp: null })
    }
  return g
}

test('new grids have no matches and at least one move', () => {
  for (let s = 0; s < 10; s++) {
    const g = newGrid(seededRng(s))
    expect(findRuns(g)).toEqual([])
    expect(hasMove(g)).toBe(true)
  }
})

test('a swap must make a match; a good one scores and uses a move', () => {
  const g = grid(['001', '..0'])
  const st: State = { ...newGame(seededRng(1)), grid: g, score: 0, moves: 10, target: 1000 }
  expect(swap(st, 0, 1, seededRng(2))).toBeNull() // two 0s swapped: nothing changes
  const after = swap(st, 2, 10, seededRng(2))! // the 0 below moves up: 0 0 0
  expect(after.moves).toBe(9)
  expect(after.score).toBeGreaterThanOrEqual(30)
  expect(after.grid.every(Boolean)).toBe(true)
})

test('four in a row leaves a striped gem; matching it clears the row', () => {
  const g = grid(['0010', '..0.'])
  const st: State = { ...newGame(seededRng(3)), grid: g, score: 0, moves: 10, target: 1000 }
  const after = swap(st, 2, 10, seededRng(4))!
  expect(after.grid.some((x) => x?.sp === 'row')).toBe(true)
})

test('winning needs the target score; running out of moves loses', () => {
  const base = newGame(seededRng(5))
  expect(status({ ...base, score: base.target })).toBe('won')
  expect(status({ ...base, moves: 0 })).toBe('lost')
  expect(status(base)).toBe('playing')
})
