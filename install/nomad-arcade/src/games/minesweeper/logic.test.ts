import { seededRng } from '../../lib/rng'
import { chord, layMines, neighbours, newGame, reveal, toggleFlag } from './logic'

test('the first click is never a mine and opens an area', () => {
  for (let seed = 0; seed < 20; seed++) {
    const g = reveal(newGame('expert'), 200, seededRng(seed))
    expect(g.status).not.toBe('lost')
    expect(g.cells.filter((c) => c.mine)).toHaveLength(99)
    for (const j of [200, ...neighbours(g, 200)]) expect(g.cells[j].mine).toBe(false)
    expect(g.cells.filter((c) => c.open).length).toBeGreaterThan(1)
  }
})

test('adjacent counts match the mines around each cell', () => {
  const g = layMines(newGame('intermediate'), 0, seededRng(9))
  g.cells.forEach((c, i) =>
    expect(c.adjacent).toBe(neighbours(g, i).filter((j) => g.cells[j].mine).length)
  )
})

test('opening a mine loses and reveals every mine', () => {
  const rng = seededRng(4)
  const g = reveal(newGame('beginner'), 40, rng)
  const mine = g.cells.findIndex((c) => c.mine)
  const lost = reveal(g, mine, rng)
  expect(lost.status).toBe('lost')
  expect(lost.exploded).toBe(mine)
  expect(lost.cells.filter((c) => c.mine).every((c) => c.open)).toBe(true)
})

test('opening every safe cell wins; flags block opening', () => {
  const rng = seededRng(11)
  let g = reveal(newGame('beginner'), 0, rng)
  const safe = g.cells.flatMap((c, i) => (!c.mine && !c.open ? [i] : []))
  const flagged = toggleFlag(g, safe[0])
  expect(reveal(flagged, safe[0], rng).cells[safe[0]].open).toBe(false)
  for (const i of safe) g = reveal(g, i, rng)
  expect(g.status).toBe('won')
})

test('chording opens the neighbours once the flags match the number', () => {
  const rng = seededRng(2)
  const g = reveal(newGame('beginner'), 0, rng)
  const i = g.cells.findIndex((c, idx) => c.open && c.adjacent > 0 && neighbours(g, idx).some((j) => !g.cells[j].open && !g.cells[j].mine))
  let flaggedGame = g
  for (const j of neighbours(g, i)) if (g.cells[j].mine) flaggedGame = toggleFlag(flaggedGame, j)
  const after = chord(flaggedGame, i, rng)
  for (const j of neighbours(g, i)) if (!g.cells[j].mine) expect(after.cells[j].open).toBe(true)
})
