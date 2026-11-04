import { seededRng } from '../../lib/rng'
import { isSolved, neighbourFor, shuffle, slide, solvedGrid } from './logic'

/** Even permutation parity plus gap row rule: the standard solvability test. */
function solvable(g: number[], n: number): boolean {
  const tiles = g.filter(Boolean)
  let inv = 0
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inv++
  if (n % 2) return inv % 2 === 0
  const rowFromBottom = n - Math.floor(g.indexOf(0) / n)
  return (inv + rowFromBottom) % 2 === 1
}

test('shuffles are solvable and never already solved', () => {
  const rng = seededRng(3)
  for (const n of [3, 4, 5])
    for (let k = 0; k < 20; k++) {
      const g = shuffle(n, rng)
      expect(isSolved(g)).toBe(false)
      expect(solvable(g, n)).toBe(true)
    }
})

test('a tile in line with the gap slides the whole row', () => {
  const g = solvedGrid(4) // gap at the bottom right
  const row = slide(g, 4, 12)!
  expect(row.slice(12)).toEqual([0, 13, 14, 15])
  expect(slide(g, 4, 0)).toBeNull()
  // Arrow up moves the tile below the gap: none below the bottom row.
  expect(neighbourFor(g, 4, 'up')).toBe(-1)
  expect(neighbourFor(g, 4, 'down')).toBe(11)
})
