import { type Rng, randomInt } from '../../lib/rng'
import { type SCard, sameCard, spanishDeck, swapCard, trickPoints, trickStrength, trickWinner } from '../../lib/spanish'

/**
 * Two-player brisca: three cards each, the turned-up card (muestra) sets trumps and
 * is the last card drawn. Following suit is never required. The trick winner draws
 * first and leads. 120 points in the deck: more than 60 wins, 60-60 is a draw.
 * Player 0 is the human, 1 the machine.
 */
export type Difficulty = 'easy' | 'medium' | 'hard'
export type State = {
  deck: SCard[]
  muestra: SCard | null // still under the deck when not null
  trump: number
  hands: [SCard[], SCard[]]
  table: SCard[] // cards played to the current trick, leader first
  leader: number
  turn: number
  points: [number, number]
  /** The last finished trick, to show it for a moment. */
  last: { cards: SCard[]; winner: number } | null
  over: boolean
}

export function deal(rng: Rng, leader = 0): State {
  const deck = spanishDeck(rng)
  const hands: [SCard[], SCard[]] = [deck.splice(0, 3), deck.splice(0, 3)]
  const muestra = deck.pop()!
  return { deck, muestra, trump: muestra.s, hands, table: [], leader, turn: leader, points: [0, 0], last: null, over: false }
}

/** Cards still to draw, counting the muestra. */
export const stockSize = (st: State) => st.deck.length + (st.muestra ? 1 : 0)

/** The leader may swap the 7 (or 2) of trumps for the muestra while cards remain to draw. */
export function canSwap(st: State, player: number): SCard | null {
  if (st.over || !st.muestra || st.turn !== player || st.table.length || st.deck.length === 0) return null
  return swapCard(st.muestra, st.hands[player])
}

export function swap(st: State, player: number): State | null {
  const card = canSwap(st, player)
  if (!card) return null
  const hands = [...st.hands] as State['hands']
  hands[player] = [...hands[player].filter((c) => !sameCard(c, card)), st.muestra!]
  return { ...st, hands, muestra: card }
}

export function play(st: State, card: SCard): State | null {
  const hand = st.hands[st.turn]
  if (st.over || !hand.some((c) => sameCard(c, card))) return null
  const hands = [...st.hands] as State['hands']
  hands[st.turn] = hand.filter((c) => !sameCard(c, card))
  const table = [...st.table, card]
  if (table.length < 2) return { ...st, hands, table, turn: 1 - st.turn }

  const winner = (st.leader + trickWinner(table, st.trump)) % 2
  const points = [...st.points] as State['points']
  points[winner] += table.reduce((s, c) => s + trickPoints(c), 0)
  // Winner draws first; the muestra is the very last card.
  const deck = [...st.deck]
  let muestra = st.muestra
  for (const p of [winner, 1 - winner]) {
    const next = deck.shift() ?? muestra
    if (next === muestra) muestra = null
    if (next) hands[p] = [...hands[p], next]
  }
  const over = hands[0].length === 0 && hands[1].length === 0
  return { ...st, deck, muestra, hands, table: [], leader: winner, turn: winner, points, last: { cards: table, winner }, over }
}

/** 1 = player 0 wins, -1 = player 1 wins, 0 = draw, null = still playing. */
export const result = (st: State) => (!st.over ? null : st.points[0] > 60 ? 1 : st.points[1] > 60 ? -1 : 0)

const value = (c: SCard, trump: number) => trickPoints(c) + (c.s === trump ? 6 + trickStrength(c) : 0)
const cheapest = (cards: SCard[], trump: number) => cards.reduce((a, b) => (value(b, trump) < value(a, trump) ? b : a))

/** Exact play once nothing is left to draw: both hands are known to someone who counted. */
function solve(st: State, me: number): { card: SCard; score: number } {
  if (st.over) return { card: null as unknown as SCard, score: st.points[me] - st.points[1 - me] }
  const maximize = st.turn === me
  let best: { card: SCard; score: number } | null = null
  for (const card of st.hands[st.turn]) {
    const { score } = solve(play(st, card)!, me)
    if (!best || (maximize ? score > best.score : score < best.score)) best = { card, score }
  }
  return best!
}

export function aiChoose(st: State, difficulty: Difficulty, rng: Rng): SCard {
  const hand = st.hands[st.turn]
  if (difficulty === 'easy') return hand[randomInt(rng, hand.length)]
  if (difficulty === 'hard' && stockSize(st) === 0) return solve(st, st.turn).card

  if (st.table.length === 0) return cheapest(hand, st.trump) // lead low, keep trumps
  const led = st.table[0]
  const winners = hand.filter((c) => trickWinner([led, c], st.trump) === 1)
  const atStake = trickPoints(led)
  // Take a trick worth having with the cheapest card that wins it; otherwise throw the cheapest.
  if (winners.length) {
    const best = cheapest(winners, st.trump)
    const freeWin = best.s === led.s // winning in suit costs no trump
    if (freeWin || atStake >= 10 || (difficulty === 'hard' && atStake + trickPoints(best) >= 10)) return best
  }
  return cheapest(hand, st.trump)
}
