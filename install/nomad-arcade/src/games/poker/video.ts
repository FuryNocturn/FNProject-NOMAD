import { type Card, newDeck } from '../../lib/cards'
import type { Rng } from '../../lib/rng'
import { score5 } from './hands'

/** Jacks or Better, the classic "9/6" pay table (payout per coin bet). */
export const PAYTABLE = [
  { id: 'royalFlush', pays: 250 },
  { id: 'straightFlush', pays: 50 },
  { id: 'quads', pays: 25 },
  { id: 'fullHouse', pays: 9 },
  { id: 'flush', pays: 6 },
  { id: 'straight', pays: 4 },
  { id: 'trips', pays: 3 },
  { id: 'twoPair', pays: 2 },
  { id: 'jacksOrBetter', pays: 1 },
] as const
export type PayId = (typeof PAYTABLE)[number]['id']

/** The paying combination of a five-card hand, or null. */
export function payline(hand: Card[]): PayId | null {
  const v = score5(hand)
  if (v.category === 'straightFlush') {
    const ranks = hand.map((c) => c.r).sort((a, b) => a - b)
    return ranks[0] === 10 ? 'royalFlush' : 'straightFlush'
  }
  if (v.category === 'pair') {
    const counts = new Map<number, number>()
    for (const c of hand) counts.set(c.r, (counts.get(c.r) ?? 0) + 1)
    const pairRank = [...counts].find(([, n]) => n === 2)![0]
    return pairRank >= 11 ? 'jacksOrBetter' : null
  }
  return v.category === 'highCard' ? null : (v.category as PayId)
}

/** Coins won for a hand at a bet of 1-5 coins. A royal flush with 5 coins pays the 4000 bonus. */
export function payout(hand: Card[], bet: number): number {
  const line = payline(hand)
  if (!line) return 0
  if (line === 'royalFlush' && bet === 5) return 4000
  return PAYTABLE.find((p) => p.id === line)!.pays * bet
}

export type Round = { deck: Card[]; hand: Card[]; held: boolean[]; phase: 'deal' | 'draw' | 'done'; bet: number }

export function dealRound(rng: Rng, bet: number): Round {
  const deck = newDeck(rng)
  return { deck, hand: deck.splice(0, 5), held: Array(5).fill(false), phase: 'draw', bet }
}

/** Replaces every card not held, from the same deck. */
export function draw(r: Round): Round {
  const deck = [...r.deck]
  const hand = r.hand.map((c, i) => (r.held[i] ? c : deck.shift()!))
  return { ...r, deck, hand, phase: 'done' }
}
