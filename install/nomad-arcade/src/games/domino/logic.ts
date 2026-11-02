import { type Rng, shuffled } from '../../lib/rng'

/**
 * Spanish partnership dominoes: four players with seven tiles each, no boneyard.
 * Players 0 (you) and 2 are partners against 1 and 3; play goes 0, 1, 2, 3.
 * A player who cannot match either end passes. The round ends when someone
 * plays their last tile, or when all four pass (blocked).
 */
export type Tile = [number, number]
export type Placed = { tile: Tile; flipped: boolean } // flipped: shown as [b, a]
export type Side = 'left' | 'right'
export type State = {
  hands: Tile[][]
  chain: Placed[]
  turn: number
  passes: number
  scores: [number, number] // team 0 (players 0 and 2), team 1 (players 1 and 3)
  target: number
  /** Who opens the next round: the winner of the last one. */
  nextStarter: number | null
  round: { winnerTeam: number | null; points: number; blocked: boolean } | null
  matchWinner: number | null
}

export const team = (player: number) => player % 2
export const pips = (t: Tile) => t[0] + t[1]
export const handPips = (h: Tile[]) => h.reduce((s, t) => s + pips(t), 0)
export const isDouble = (t: Tile) => t[0] === t[1]

export function ends(chain: Placed[]): [number, number] | null {
  if (!chain.length) return null
  const first = chain[0]
  const last = chain[chain.length - 1]
  return [first.flipped ? first.tile[1] : first.tile[0], last.flipped ? last.tile[0] : last.tile[1]]
}

export function deal(rng: Rng, prev?: Pick<State, 'scores' | 'target' | 'nextStarter'>): State {
  const all: Tile[] = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push([a, b])
  const tiles = shuffled(all, rng)
  const hands = [0, 1, 2, 3].map((p) => tiles.slice(p * 7, p * 7 + 7))
  // The first round is opened by whoever holds the double six.
  const turn = prev?.nextStarter ?? hands.findIndex((h) => h.some((t) => t[0] === 6 && t[1] === 6))
  return {
    hands,
    chain: [],
    turn,
    passes: 0,
    scores: prev?.scores ?? [0, 0],
    target: prev?.target ?? 100,
    nextStarter: prev?.nextStarter ?? null,
    round: null,
    matchWinner: null,
  }
}

/** Sides a tile can go on (both when it matches both ends). The very first tile goes anywhere. */
export function sidesFor(st: State, t: Tile): Side[] {
  const e = ends(st.chain)
  if (!e) {
    // The opening tile of the first round must be the double six.
    if (st.nextStarter === null && st.scores[0] === 0 && st.scores[1] === 0 && !(t[0] === 6 && t[1] === 6))
      return st.hands[st.turn].some((x) => x[0] === 6 && x[1] === 6) ? [] : ['right']
    return ['right']
  }
  const out: Side[] = []
  if (t.includes(e[0])) out.push('left')
  if (t.includes(e[1]) && !(out.length && e[0] === e[1])) out.push('right')
  return out
}

export const playable = (st: State, player = st.turn) =>
  st.hands[player].filter((t) => sidesFor({ ...st, turn: player }, t).length > 0)

function endRound(st: State, winnerTeam: number | null, blocked: boolean): State {
  const losers = winnerTeam === null ? [] : [0, 1, 2, 3].filter((p) => team(p) !== winnerTeam)
  const points = losers.reduce((s, p) => s + handPips(st.hands[p]), 0)
  const scores: [number, number] = [...st.scores]
  if (winnerTeam !== null) scores[winnerTeam] += points
  const matchWinner = scores[0] >= st.target ? 0 : scores[1] >= st.target ? 1 : null
  return { ...st, scores, round: { winnerTeam, points, blocked }, matchWinner }
}

export function play(st: State, t: Tile, side: Side): State | null {
  if (st.round || !sidesFor(st, t).includes(side)) return null
  const e = ends(st.chain)
  let placed: Placed
  if (!e) placed = { tile: t, flipped: false }
  else if (side === 'left') placed = { tile: t, flipped: t[0] === e[0] } // its outer value must face left
  else placed = { tile: t, flipped: t[1] === e[1] }
  const hands = st.hands.map((h, p) => (p === st.turn ? h.filter((x) => x !== t) : h))
  const chain = side === 'left' ? [placed, ...st.chain] : [...st.chain, placed]
  const next: State = { ...st, hands, chain, passes: 0, turn: (st.turn + 1) % 4 }
  if (hands[st.turn].length === 0) return endRound({ ...next, nextStarter: st.turn }, team(st.turn), false)
  return next
}

/** Passing is only allowed with no playable tile. Four passes in a row block the game. */
export function pass(st: State): State | null {
  if (st.round || playable(st).length) return null
  const passes = st.passes + 1
  const next = { ...st, passes, turn: (st.turn + 1) % 4 }
  if (passes < 4) return next
  // Blocked: the team with fewer points in hand wins the round; a tie scores nothing.
  const t0 = handPips(st.hands[0]) + handPips(st.hands[2])
  const t1 = handPips(st.hands[1]) + handPips(st.hands[3])
  const winnerTeam = t0 < t1 ? 0 : t1 < t0 ? 1 : null
  const lowest = [0, 1, 2, 3]
    .filter((p) => winnerTeam !== null && team(p) === winnerTeam)
    .sort((a, b) => handPips(st.hands[a]) - handPips(st.hands[b]))[0]
  return endRound({ ...next, nextStarter: lowest ?? st.turn }, winnerTeam, true)
}

/** Heaviest tile first (fewer points left if blocked), preferring doubles, which are hard to place later. */
export function aiChoose(st: State): { tile: Tile; side: Side } | null {
  const options = playable(st)
  if (!options.length) return null
  const score = (t: Tile) => pips(t) + (isDouble(t) ? 4 : 0)
  const tile = options.reduce((a, b) => (score(b) > score(a) ? b : a))
  return { tile, side: sidesFor(st, tile)[0] }
}
