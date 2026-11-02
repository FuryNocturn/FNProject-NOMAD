import { type Rng, randomInt } from '../../lib/rng'
import { type SCard, sameCard, spanishDeck, swapCard, trickPoints, trickStrength, trickWinner } from '../../lib/spanish'

/**
 * Two-player tute: eight cards each and a turned-up muestra for trumps. While cards
 * remain to draw, play is free; once the stock is gone ("arrastre") you must follow
 * suit and beat the card if you can, or trump if you cannot follow. After winning a
 * trick you may sing one king and knight pair: 20, or 40 in trumps. Holding all four
 * kings or all four knights then ("tute") wins the hand outright. The last trick is
 * worth 10. Player 0 is the human, 1 the machine.
 */
export type Difficulty = 'easy' | 'medium' | 'hard'
export type State = {
  deck: SCard[]
  muestra: SCard | null
  trump: number
  hands: [SCard[], SCard[]]
  table: SCard[]
  leader: number
  turn: number
  points: [number, number]
  /** Suits already sung (either player). */
  sung: number[]
  /** May sing now: the leader just won a trick and has not sung since. */
  canSing: boolean
  last: { cards: SCard[]; winner: number } | null
  cante: { player: number; suit: number; points: number } | null
  tute: number | null // who sang tute
  over: boolean
}

export const HAND = 8

export function deal(rng: Rng, leader = 0): State {
  const deck = spanishDeck(rng)
  const hands: [SCard[], SCard[]] = [deck.splice(0, HAND), deck.splice(0, HAND)]
  const muestra = deck.pop()!
  return {
    deck, muestra, trump: muestra.s, hands, table: [], leader, turn: leader, points: [0, 0],
    sung: [], canSing: false, last: null, cante: null, tute: null, over: false,
  }
}

export const stockSize = (st: State) => st.deck.length + (st.muestra ? 1 : 0)

/** Cards the player to move may play. */
export function legal(st: State): SCard[] {
  const hand = st.hands[st.turn]
  if (st.table.length === 0 || stockSize(st) > 0) return hand
  const led = st.table[0]
  const follow = hand.filter((c) => c.s === led.s)
  if (follow.length) {
    const higher = follow.filter((c) => trickStrength(c) > trickStrength(led))
    return higher.length ? higher : follow
  }
  const trumps = hand.filter((c) => c.s === st.trump)
  return trumps.length ? trumps : hand
}

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

/** Suits the player can sing right now (king and knight both in hand, not yet sung). */
export function singable(st: State, player: number): number[] {
  if (!st.canSing || st.turn !== player || st.table.length) return []
  const hand = st.hands[player]
  return [0, 1, 2, 3].filter(
    (s) => !st.sung.includes(s) && hand.some((c) => c.s === s && c.r === 12) && hand.some((c) => c.s === s && c.r === 11),
  )
}

export function hasTute(hand: SCard[]): boolean {
  return hand.filter((c) => c.r === 12).length === 4 || hand.filter((c) => c.r === 11).length === 4
}

export function sing(st: State, player: number, suit: number): State | null {
  if (!singable(st, player).includes(suit)) return null
  const value = suit === st.trump ? 40 : 20
  const points = [...st.points] as State['points']
  points[player] += value
  return { ...st, points, sung: [...st.sung, suit], canSing: false, cante: { player, suit, points: value } }
}

/** Tute ends the hand at once for whoever holds it when allowed to sing. */
export function singTute(st: State, player: number): State | null {
  if (!st.canSing || st.turn !== player || st.table.length || !hasTute(st.hands[player])) return null
  return { ...st, tute: player, canSing: false, over: true }
}

export function play(st: State, card: SCard): State | null {
  if (st.over || !legal(st).some((c) => sameCard(c, card))) return null
  const hands = [...st.hands] as State['hands']
  hands[st.turn] = hands[st.turn].filter((c) => !sameCard(c, card))
  const table = [...st.table, card]
  // A cante stays on show until the trick it was sung before is over.
  if (table.length < 2) return { ...st, hands, table, turn: 1 - st.turn, canSing: false }

  const winner = (st.leader + trickWinner(table, st.trump)) % 2
  const points = [...st.points] as State['points']
  points[winner] += table.reduce((s, c) => s + trickPoints(c), 0)
  const deck = [...st.deck]
  let muestra = st.muestra
  for (const p of [winner, 1 - winner]) {
    const next = deck.shift() ?? muestra
    if (next === muestra) muestra = null
    if (next) hands[p] = [...hands[p], next]
  }
  const over = hands[0].length === 0 && hands[1].length === 0
  if (over) points[winner] += 10 // diez de últimas
  return {
    ...st, deck, muestra, hands, table: [], leader: winner, turn: winner, points,
    last: { cards: table, winner }, canSing: !over, cante: null, over,
  }
}

/** 1 = player 0 wins the hand, -1 = player 1, 0 = tie, null = still playing. */
export function result(st: State): number | null {
  if (!st.over) return null
  if (st.tute !== null) return st.tute === 0 ? 1 : -1
  return Math.sign(st.points[0] - st.points[1])
}

const value = (c: SCard, trump: number) => trickPoints(c) + (c.s === trump ? 6 + trickStrength(c) : 0)
const cheapest = (cards: SCard[], trump: number) => cards.reduce((a, b) => (value(b, trump) < value(a, trump) ? b : a))
/** Kings and knights that could still be sung are worth keeping. */
const keepForCante = (st: State, c: SCard) =>
  (c.r === 11 || c.r === 12) && !st.sung.includes(c.s) && st.hands[st.turn].some((o) => o.s === c.s && o.r === 23 - c.r)

function solve(st: State, me: number, depth: number): number {
  if (st.over || depth === 0) return st.points[me] - st.points[1 - me]
  const maximize = st.turn === me
  let best = maximize ? -Infinity : Infinity
  for (const card of legal(st)) {
    const score = solve(play(st, card)!, me, depth - 1)
    best = maximize ? Math.max(best, score) : Math.min(best, score)
  }
  return best
}

export function aiChoose(st: State, difficulty: Difficulty, rng: Rng): SCard {
  const options = legal(st)
  if (difficulty === 'easy') return options[randomInt(rng, options.length)]
  // In the arrastre with few cards left, search to the end.
  if (difficulty === 'hard' && stockSize(st) === 0 && st.hands[st.turn].length <= 5) {
    const me = st.turn
    return options.reduce((a, b) => (solve(play(st, b)!, me, 10) > solve(play(st, a)!, me, 10) ? b : a))
  }
  const spare = options.filter((c) => !keepForCante(st, c))
  const pool = spare.length ? spare : options
  if (st.table.length === 0) return cheapest(pool, st.trump)
  const led = st.table[0]
  const winners = options.filter((c) => trickWinner([led, c], st.trump) === 1)
  if (winners.length) {
    const best = cheapest(winners, st.trump)
    if (best.s === led.s || trickPoints(led) >= 10 || (difficulty === 'hard' && trickPoints(led) + trickPoints(best) >= 10))
      return best
  }
  return cheapest(pool, st.trump)
}

/** The machine sings everything it can before leading: tute first, then the best pair. */
export function aiSing(st: State): State | null {
  const tute = singTute(st, st.turn)
  if (tute) return tute
  const suits = singable(st, st.turn)
  if (!suits.length) return null
  return sing(st, st.turn, suits.includes(st.trump) ? st.trump : suits[0])
}
