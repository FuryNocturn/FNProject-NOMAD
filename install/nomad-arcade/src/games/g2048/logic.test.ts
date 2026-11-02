import { seededRng } from '../../lib/rng'
import { canMove, newGrid, slide, slideLine } from './logic'

test('a line merges each pair once and keeps order', () => {
  expect(slideLine([2, 2, 2, 0])).toEqual({ line: [4, 2, 0, 0], gained: 4 })
  expect(slideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 })
  expect(slideLine([0, 4, 0, 4])).toEqual({ line: [8, 0, 0, 0], gained: 8 })
  expect(slideLine([2, 4, 8, 16]).gained).toBe(0)
})

test('sliding in each direction', () => {
  const g = [2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0]
  expect(slide(g, 'right').grid.slice(0, 4)).toEqual([0, 0, 0, 4])
  expect(slide(g, 'left').grid.slice(0, 4)).toEqual([4, 0, 0, 0])
  expect(slide(g, 'down').grid[12]).toBe(4)
  expect(slide(g, 'down').grid[8]).toBe(2)
  expect(slide(g, 'up').grid[0]).toBe(2)
  expect(slide([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], 'left').moved).toBe(false)
})

test('a new game has two tiles and a full grid without pairs is stuck', () => {
  expect(newGrid(seededRng(1)).filter(Boolean)).toHaveLength(2)
  expect(canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])).toBe(false)
  expect(canMove([2, 2, 4, 8, 4, 8, 2, 4, 2, 4, 8, 2, 4, 2, 4, 8])).toBe(true)
})
