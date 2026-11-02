import { type Rng, shuffled } from './rng'

/** Rank 2..14 (14 = ace), suit 0 ♠, 1 ♥, 2 ♦, 3 ♣. */
export type Card = { r: number; s: number }

export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']
export const rankLabel = (r: number) => (r <= 10 ? String(r) : ['J', 'Q', 'K', 'A'][r - 11])
export const isRedSuit = (s: number) => s === 1 || s === 2
export const cardLabel = (c: Card) => rankLabel(c.r) + SUIT_SYMBOLS[c.s]

export function newDeck(rng: Rng, decks = 1): Card[] {
  const one: Card[] = []
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) one.push({ r, s })
  return shuffled(Array.from({ length: decks }, () => one).flat(), rng)
}
