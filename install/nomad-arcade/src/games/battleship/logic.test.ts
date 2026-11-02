import { seededRng } from '../../lib/rng'
import { FLEET, N, aiShot, allSunk, fire, newBoard, placeFleet } from './logic'

test('the fleet has the right sizes and no two ships touch', () => {
  for (let s = 0; s < 20; s++) {
    const ships = placeFleet(seededRng(s))
    expect(ships.map((x) => x.cells.length)).toEqual(FLEET)
    const owner = new Map<number, number>()
    ships.forEach((ship, k) => ship.cells.forEach((c) => owner.set(c, k)))
    for (const [cell, k] of owner) {
      const [r, c] = [Math.floor(cell / N), cell % N]
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const o = owner.get((r + dr) * N + c + dc)
          if (r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && o !== undefined) expect(o).toBe(k)
        }
    }
  }
})

test('hits, misses and sinking (which reveals the water around)', () => {
  let b = newBoard(seededRng(1))
  const ship = b.ships[4] // the 2-cell ship
  const water = Array.from({ length: N * N }, (_, i) => i).find((i) => !b.ships.some((s) => s.cells.includes(i)))!
  expect(fire(b, water).result).toBe('miss')
  let r = fire(b, ship.cells[0])
  expect(r.result).toBe('hit')
  r = fire(r.board, ship.cells[1])
  expect(r.result).toBe('sunk')
  b = r.board
  expect(b.marks.filter((m) => m === 'miss').length).toBeGreaterThan(0)
  expect(fire(b, ship.cells[0]).result).toBeNull()
})

test.each(['easy', 'medium', 'hard'] as const)('the %s AI sinks a whole fleet without repeating shots', (d) => {
  const rng = seededRng(7)
  let b = newBoard(rng)
  let shots = 0
  while (!allSunk(b) && shots < 100) {
    const i = aiShot(b, d, rng)
    expect(b.marks[i]).toBeNull()
    b = fire(b, i).board
    shots++
  }
  expect(allSunk(b)).toBe(true)
  if (d === 'hard') expect(shots).toBeLessThan(75)
})
