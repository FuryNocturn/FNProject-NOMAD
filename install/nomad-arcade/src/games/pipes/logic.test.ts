import { seededRng } from '../../lib/rng'
import { DOWN, LEFT, RIGHT, UP, isSolved, newBoard, rotate, tree } from './logic'

test('rotation turns openings clockwise', () => {
  expect(rotate(UP)).toBe(RIGHT)
  expect(rotate(LEFT)).toBe(UP)
  expect(rotate(UP | RIGHT, 2)).toBe(DOWN | LEFT)
  expect(rotate(UP | DOWN, 4)).toBe(UP | DOWN)
})

test('the generated layout is a solved spanning tree', () => {
  const rng = seededRng(8)
  for (const n of [5, 7, 9]) {
    const tiles = tree(n, rng)
    const source = Math.floor(n / 2) * n + Math.floor(n / 2)
    expect(isSolved({ n, tiles, source })).toBe(true)
    // A tree on n² cells has n² - 1 links; each link is two openings.
    const openings = tiles.reduce((s, m) => s + ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)), 0)
    expect(openings).toBe(2 * (n * n - 1))
    expect(tiles.every((m) => m !== 15)).toBe(true)
  }
})

test('a new board starts scrambled and is solvable by rotating tiles', () => {
  const rng = seededRng(4)
  const b = newBoard(5, rng)
  expect(isSolved(b)).toBe(false)
})
