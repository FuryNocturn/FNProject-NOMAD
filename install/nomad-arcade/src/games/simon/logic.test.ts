import { seededRng } from '../../lib/rng'
import { type State, flashMs, newState, nextRound, press } from './logic'

test('repeating the sequence completes the round and grows it next time', () => {
  const rng = seededRng(1)
  let st = nextRound(newState(), rng)
  expect(st.sequence).toHaveLength(1)
  st = { ...st, phase: 'input' }
  const r = press(st, st.sequence[0])
  expect(r.result).toBe('round')
  expect(r.state.best).toBe(1)
  expect(nextRound(r.state, rng).sequence).toHaveLength(2)
})

test('a wrong colour ends the game and keeps the best score', () => {
  let st: State = { ...nextRound(nextRound(newState(), seededRng(2)), seededRng(3)), phase: 'input' }
  st = press(st, st.sequence[0]).state
  const wrong = (st.sequence[1] + 1) % 4
  const r = press(st, wrong)
  expect(r.result).toBe('wrong')
  expect(r.state.phase).toBe('over')
  expect(r.state.best).toBe(1)
})

test('the pace speeds up but never below 220 ms', () => {
  expect(flashMs(1)).toBeGreaterThan(flashMs(10))
  expect(flashMs(100)).toBe(220)
})
