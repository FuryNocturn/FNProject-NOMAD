import { seededRng, randomInt } from '../../lib/rng'
import { GOAL, type State, aiChoose, currentMoves, legalMoves, move, newGame, roll, trackNumber } from './logic'

const withPieces = (pieces: number[][], turn = 0): State => ({ ...newGame(), pieces, turn })
const home = [-1, -1, -1, -1]

test('routes: each colour exits on its square and enters its column at the right number', () => {
  expect([0, 1, 2, 3].map((p) => trackNumber(p, 0))).toEqual([5, 22, 39, 56])
  expect([0, 1, 2, 3].map((p) => trackNumber(p, 63))).toEqual([68, 17, 34, 51])
})

test('a 5 must take a piece out; without one, nothing moves and the turn passes', () => {
  const st = roll(newGame(), 5)
  expect(st.phase).toBe('move')
  expect(currentMoves(st)).toEqual([{ piece: 0, to: 0, capture: null }])
  const none = roll(newGame(), 3)
  expect(none.turn).toBe(1)
  expect(none.phase).toBe('roll')
})

test('landing on a lone enemy outside a safe square captures it and earns 20', () => {
  // Yellow at step 17 moves 3 to step 20, square 25.
  // Blue stands on square 25, which is blue's step 3 (blue never visits 18-21: it turns home at 17).
  const blueStep = (25 - 22 + 68) % 68
  let st = withPieces([[17, -1, -1, -1], [blueStep, -1, -1, -1], home, home])
  st = roll(st, 3)
  const m = currentMoves(st)[0]
  expect(m.capture).toEqual([1, 0])
  st = move(st, m)
  expect(st.pieces[1][0]).toBe(-1)
  expect(st.bonuses).toEqual([20])
  expect(st.phase).toBe('move')
  st = move(st, currentMoves(st)[0])
  expect(st.pieces[0][0]).toBe(40)
  expect(st.turn).toBe(1)
})

test('no capture on a safe square, and a barrier cannot be passed', () => {
  // Square 12 is safe; blue sits there. Yellow lands on it from step 4 with a 3.
  const blueOn12 = (12 - 22 + 68) % 68
  const safe = withPieces([[4, -1, -1, -1], [blueOn12, -1, -1, -1], home, home])
  expect(legalMoves(safe, 0, 3, true)).toEqual([{ piece: 0, to: 7, capture: null }])
  // Two blue pieces on square 10 (yellow step 5) block a yellow piece at step 3.
  const b = (10 - 22 + 68) % 68
  const barrier = withPieces([[3, -1, -1, -1], [b, b, -1, -1], home, home])
  expect(legalMoves(barrier, 0, 4, true)).toEqual([])
})

test('a 6 counts as 7 with no pieces at home, and the goal needs the exact count', () => {
  const st = roll(withPieces([[10, 20, 30, 40], home, home, home]), 6)
  expect(st.steps).toBe(7)
  expect(legalMoves(withPieces([[68, -1, -1, -1], home, home, home]), 0, 4, true)).toEqual([])
  const done = move(roll(withPieces([[68, GOAL, GOAL, GOAL], home, home, home]), 3), { piece: 0, to: GOAL, capture: null })
  expect(done.winner).toBe(0)
})

test('a third six sends the last piece moved home', () => {
  let st = withPieces([[10, 20, -1, -1], home, home, home])
  st = { ...st, sixes: 2, lastMoved: 1 }
  st = roll(st, 6)
  expect(st.pieces[0][1]).toBe(-1)
  expect(st.turn).toBe(1)
})

test('four computer players finish a whole game with legal moves only', () => {
  const rng = seededRng(12)
  let st = newGame()
  for (let i = 0; i < 20000 && st.phase !== 'over'; i++) {
    if (st.phase === 'roll') st = roll(st, randomInt(rng, 6) + 1)
    else {
      const moves = currentMoves(st)
      st = move(st, aiChoose(st, moves))
    }
  }
  expect(st.phase).toBe('over')
  expect(st.pieces[st.winner!].every((p) => p === GOAL)).toBe(true)
})
