/**
 * Parchís (Spanish rules). Four players: 0 yellow (the human), 1 blue, 2 red, 3 green.
 *
 * A piece's position counts steps along its own route: -1 at home (base),
 * 0..63 on the shared 68-square track (0 is its exit square), 64..70 its
 * coloured home column, 71 the goal.
 */
export const EXIT = [5, 22, 39, 56]
export const SAFE = new Set([5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63, 68])
export const LAST_TRACK = 63
export const GOAL = 71
export const CAPTURE_BONUS = 20
export const GOAL_BONUS = 10

export type Phase = 'roll' | 'move' | 'over'
export type State = {
  pieces: number[][] // [player][piece]
  turn: number
  phase: Phase
  /** Steps to move in the 'move' phase: the die (6 may count as 7) or a 20/10 bonus. */
  steps: number
  die: number | null
  /** The die showed 6: the same player rolls again after moving. */
  rollAgain: boolean
  sixes: number
  lastMoved: number | null
  /** Bonuses earned but not yet played (a capture and a goal in one move both count). */
  bonuses: number[]
  winner: number | null
}
export type Move = { piece: number; to: number; capture: [number, number] | null }

export const newGame = (): State => ({
  pieces: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]),
  turn: 0,
  phase: 'roll',
  steps: 0,
  die: null,
  rollAgain: false,
  sixes: 0,
  lastMoved: null,
  bonuses: [],
  winner: null,
})

/** Number (1..68) of the track square at `step` on `player`'s route. */
export const trackNumber = (player: number, step: number) => ((EXIT[player] - 1 + step) % 68) + 1

/** Pieces standing on track square `num`, as [player, piece]. */
export function occupants(st: State, num: number): [number, number][] {
  const out: [number, number][] = []
  st.pieces.forEach((ps, p) =>
    ps.forEach((pos, k) => {
      if (pos >= 0 && pos <= LAST_TRACK && trackNumber(p, pos) === num) out.push([p, k])
    })
  )
  return out
}

/** Two pieces of one colour on a square form a barrier nobody can pass or land on. */
function isBarrier(st: State, num: number): boolean {
  const occ = occupants(st, num)
  return occ.length === 2 && occ[0][0] === occ[1][0]
}

export function legalMoves(st: State, player: number, steps: number, fromDie: boolean): Move[] {
  const mine = st.pieces[player]
  // Leaving home with a 5 is compulsory when possible.
  if (fromDie && steps === 5 && mine.includes(-1)) {
    const exitNum = EXIT[player]
    const occ = occupants(st, exitNum)
    const own = occ.filter(([p]) => p === player).length
    if (own < 2) {
      const enemy = occ.find(([p]) => p !== player)
      // On the exit a full square gives way: a piece leaving home captures an enemy there.
      return [{ piece: mine.indexOf(-1), to: 0, capture: enemy && occ.length >= 2 ? enemy : null }]
    }
  }
  const moves: Move[] = []
  mine.forEach((pos, piece) => {
    if (pos < 0 || pos === GOAL) return
    const to = pos + steps
    if (to > GOAL) return
    for (let s = pos + 1; s <= Math.min(to, LAST_TRACK); s++) if (isBarrier(st, trackNumber(player, s))) return
    let capture: [number, number] | null = null
    if (to <= LAST_TRACK) {
      const num = trackNumber(player, to)
      const occ = occupants(st, num).filter(([p, k]) => !(p === player && k === piece))
      if (occ.length >= 2) return
      if (occ.length === 1 && occ[0][0] !== player && !SAFE.has(num)) capture = occ[0]
    }
    moves.push({ piece, to, capture })
  })
  return moves
}

/** What the current player can do now: their pending bonus, or the die. */
export function currentMoves(st: State): Move[] {
  if (st.phase !== 'move') return []
  const bonus = st.bonuses[0]
  return bonus ? legalMoves(st, st.turn, bonus, false) : legalMoves(st, st.turn, st.steps, true)
}

/** Hands the turn on when nothing is left to play this turn. */
function finishTurn(st: State): State {
  if (st.rollAgain) return { ...st, phase: 'roll', die: null }
  return { ...st, phase: 'roll', die: null, turn: (st.turn + 1) % 4, sixes: 0, rollAgain: false, lastMoved: null }
}

/** Skips bonuses that cannot be played, then ends the turn if nothing remains. */
function settle(st: State): State {
  let s = st
  while (s.bonuses.length && legalMoves(s, s.turn, s.bonuses[0], false).length === 0) s = { ...s, bonuses: s.bonuses.slice(1) }
  if (s.bonuses.length) return { ...s, phase: 'move' }
  return finishTurn(s)
}

export function roll(st: State, value: number): State {
  if (st.phase !== 'roll') return st
  const player = st.turn
  const six = value === 6
  const sixes = six ? st.sixes + 1 : 0
  // Third six in a row: the last piece moved goes home (unless already safe in its column) and the turn passes.
  if (sixes === 3) {
    const pieces = st.pieces.map((ps) => [...ps])
    if (st.lastMoved !== null && pieces[player][st.lastMoved] <= LAST_TRACK) pieces[player][st.lastMoved] = -1
    return { ...st, pieces, die: value, phase: 'roll', turn: (player + 1) % 4, sixes: 0, rollAgain: false, lastMoved: null }
  }
  // With no pieces left at home, a 6 counts as 7.
  const steps = six && !st.pieces[player].includes(-1) ? 7 : value
  const next: State = { ...st, die: value, steps, sixes, rollAgain: six, bonuses: [] }
  if (legalMoves(next, player, steps, true).length === 0) return finishTurn(next)
  return { ...next, phase: 'move' }
}

export function move(st: State, m: Move): State {
  if (st.phase !== 'move') return st
  const player = st.turn
  const pieces = st.pieces.map((ps) => [...ps])
  pieces[player][m.piece] = m.to
  const bonuses = st.bonuses.length ? st.bonuses.slice(1) : []
  if (m.capture) {
    pieces[m.capture[0]][m.capture[1]] = -1
    bonuses.push(CAPTURE_BONUS)
  }
  if (m.to === GOAL) bonuses.push(GOAL_BONUS)
  const next: State = { ...st, pieces, bonuses, lastMoved: m.piece }
  if (pieces[player].every((p) => p === GOAL)) return { ...next, phase: 'over', winner: player }
  return settle(next)
}

/** Simple priorities: capture, reach the goal, leave home, get to safety, advance the leader. */
export function aiChoose(st: State, moves: Move[]): Move {
  const score = (m: Move) => {
    const from = st.pieces[st.turn][m.piece]
    let s = m.to / 10
    if (m.capture) s += 100
    if (m.to === GOAL) s += 80
    if (from < 0) s += 60
    if (from <= LAST_TRACK && m.to > LAST_TRACK) s += 40
    if (m.to <= LAST_TRACK && SAFE.has(trackNumber(st.turn, m.to))) s += 20
    // Leaving a safe square exposes the piece.
    if (from >= 0 && from <= LAST_TRACK && SAFE.has(trackNumber(st.turn, from))) s -= 10
    return s
  }
  return moves.reduce((best, m) => (score(m) > score(best) ? m : best))
}
