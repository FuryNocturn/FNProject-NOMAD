/**
 * El juego de la oca, with the usual Spanish squares. Positions 1..63; 63 must be
 * reached exactly (the rest bounces back).
 */
export const GOAL = 63
export const GEESE = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]
export const BRIDGES: Record<number, number> = { 6: 12, 12: 6 }
export const DICE: Record<number, number> = { 26: 53, 53: 26 }
export const INN = 19
export const WELL = 31
export const MAZE = 42
export const MAZE_TO = 30
export const JAIL = 56
export const DEATH = 58

export type Event = 'goose' | 'bridge' | 'dice' | 'inn' | 'well' | 'maze' | 'jail' | 'death' | 'bounce' | 'win' | 'stuck' | 'skip' | null
export type State = {
  pos: number[]
  turn: number
  skip: number[] // turns still to lose
  inWell: number | null
  winner: number | null
  last: { player: number; roll: number; from: number; to: number; event: Event } | null
}

export const newGame = (players: number): State => ({
  pos: Array(players).fill(1),
  turn: 0,
  skip: Array(players).fill(0),
  inWell: null,
  winner: null,
  last: null,
})

const nextPlayer = (st: State) => (st.turn + 1) % st.pos.length

/** Plays one roll for the player whose turn it is. */
export function play(st: State, roll: number): State {
  if (st.winner !== null) return st
  const p = st.turn
  // Losing turns (inn, jail) or waiting in the well.
  if (st.skip[p] > 0) {
    const skip = [...st.skip]
    skip[p]--
    return { ...st, skip, turn: nextPlayer(st), last: { player: p, roll: 0, from: st.pos[p], to: st.pos[p], event: 'skip' } }
  }
  if (st.inWell === p) return { ...st, turn: nextPlayer(st), last: { player: p, roll: 0, from: st.pos[p], to: st.pos[p], event: 'stuck' } }

  const from = st.pos[p]
  let to = from + roll
  let event: Event = null
  let again = false
  if (to > GOAL) {
    to = GOAL - (to - GOAL)
    event = 'bounce'
  }
  const pos = [...st.pos]
  const skip = [...st.skip]
  let inWell = st.inWell
  if (to === GOAL) event = 'win'
  else if (GEESE.includes(to)) {
    // From goose to goose, and roll again.
    to = GEESE.find((g) => g > to) ?? GOAL
    event = to === GOAL ? 'win' : 'goose'
    again = to !== GOAL
  } else if (BRIDGES[to]) {
    to = BRIDGES[to]
    event = 'bridge'
    again = true
  } else if (DICE[to]) {
    to = DICE[to]
    event = 'dice'
    again = true
  } else if (to === INN) {
    skip[p] = 1
    event = 'inn'
  } else if (to === WELL) {
    // Falling in frees whoever was there.
    inWell = p
    event = 'well'
  } else if (to === MAZE) {
    to = MAZE_TO
    event = 'maze'
  } else if (to === JAIL) {
    skip[p] = 2
    event = 'jail'
  } else if (to === DEATH) {
    to = 1
    event = 'death'
  }
  pos[p] = to
  const last = { player: p, roll, from, to, event }
  if (event === 'win') return { ...st, pos, skip, inWell, winner: p, last }
  return { ...st, pos, skip, inWell, last, turn: again ? p : nextPlayer(st) }
}
