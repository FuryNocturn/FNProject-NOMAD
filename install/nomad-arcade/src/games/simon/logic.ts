import { type Rng, randomInt } from '../../lib/rng'

/** Simon: repeat a growing sequence of four colours. */
export type State = { sequence: number[]; input: number; phase: 'idle' | 'showing' | 'input' | 'over'; best: number }

export const newState = (best = 0): State => ({ sequence: [], input: 0, phase: 'idle', best })

/** Appends one colour and starts showing the sequence. */
export const nextRound = (st: State, rng: Rng): State => ({
  ...st,
  sequence: [...st.sequence, randomInt(rng, 4)],
  input: 0,
  phase: 'showing',
})

/** Checks one press. A wrong colour ends the game; finishing the sequence waits for the next round. */
export function press(st: State, color: number): { state: State; result: 'ok' | 'round' | 'wrong' } {
  if (st.phase !== 'input') return { state: st, result: 'ok' }
  if (st.sequence[st.input] !== color) {
    const score = st.sequence.length - 1
    return { state: { ...st, phase: 'over', best: Math.max(st.best, score) }, result: 'wrong' }
  }
  const input = st.input + 1
  if (input === st.sequence.length) {
    return { state: { ...st, input, phase: 'idle', best: Math.max(st.best, st.sequence.length) }, result: 'round' }
  }
  return { state: { ...st, input }, result: 'ok' }
}

/** Milliseconds each colour stays lit: faster as the sequence grows. */
export const flashMs = (length: number) => Math.max(220, 600 - length * 25)
