import { seededRng, randomInt } from '../../lib/rng'
import { type State, newGame, play } from './logic'

const at = (positions: number[], turn = 0): State => ({ ...newGame(positions.length), pos: positions, turn })

test('from goose to goose, and roll again', () => {
  const st = play(at([1, 1]), 4) // lands on 5
  expect(st.pos[0]).toBe(9)
  expect(st.last?.event).toBe('goose')
  expect(st.turn).toBe(0)
})

test('bridge and dice send you on and give another roll', () => {
  expect(play(at([1, 1]), 5).pos[0]).toBe(12) // 6 -> 12
  const d = play(at([20, 1]), 6) // 26 -> 53
  expect(d.pos[0]).toBe(53)
  expect(d.turn).toBe(0)
})

test('the inn loses a turn; the maze, jail and death', () => {
  let st = play(at([15, 1]), 4) // 19, inn
  expect(st.turn).toBe(1)
  st = play(st, 1) // player 1 moves
  st = play(st, 3) // player 0 misses this turn
  expect(st.last?.event).toBe('skip')
  expect(st.pos[0]).toBe(19)
  expect(play(at([40, 1]), 2).pos[0]).toBe(30) // maze
  expect(play(at([52, 1]), 4).skip[0]).toBe(2) // jail
  expect(play(at([55, 1]), 3).pos[0]).toBe(1) // death
})

test('the well holds you until someone else falls in', () => {
  let st = play(at([28, 25]), 3) // 28 + 3 = 31: the well
  expect(st.inWell).toBe(0)
  st = play(st, 2) // player 1 to 27 (goose) -> 32, rolls again
  st = play(st, 1) // player 1 to 33
  expect(play(st, 6).last?.event).toBe('stuck')
  const freed = play({ ...st, pos: [31, 29], turn: 1 }, 2) // player 1 falls in
  expect(freed.inWell).toBe(1)
})

test('63 must be exact; extra points bounce back', () => {
  const st = play(at([60, 1]), 5) // 65 -> 61
  expect(st.pos[0]).toBe(61)
  expect(st.last?.event).toBe('bounce')
  expect(play(at([57, 1]), 6).winner).toBe(0)
})

test('a four-player game always finishes', () => {
  const rng = seededRng(3)
  let st = newGame(4)
  for (let i = 0; i < 5000 && st.winner === null; i++) st = play(st, randomInt(rng, 6) + 1)
  expect(st.winner).not.toBeNull()
})
