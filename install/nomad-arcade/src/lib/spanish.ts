import { type Rng, shuffled } from './rng'

/**
 * Spanish deck. Rank 1..7, 10 (sota), 11 (caballo), 12 (rey); 8 and 9 only in
 * the 48-card deck; 0 is a joker (comodín). Suit 0 oros, 1 copas, 2 espadas, 3 bastos.
 */
export type SCard = { r: number; s: number }

export const RANKS_40 = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]

export const sameCard = (a: SCard, b: SCard) => a.r === b.r && a.s === b.s
export const cardKey = (c: SCard) => `${c.r}-${c.s}`

export function spanishDeck(rng: Rng, opts: { eights?: boolean; jokers?: number } = {}): SCard[] {
  const ranks = opts.eights ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : RANKS_40
  const deck: SCard[] = []
  for (let s = 0; s < 4; s++) for (const r of ranks) deck.push({ r, s })
  // Jokers get distinct suits so cardKey stays unique.
  for (let j = 0; j < (opts.jokers ?? 0); j++) deck.push({ r: 0, s: j })
  return shuffled(deck, rng)
}

/** Brisca and tute: ace, three, king, knight, jack, then 7 down to 2. Higher is stronger. */
const TRICK_ORDER = [2, 4, 5, 6, 7, 10, 11, 12, 3, 1]
export const trickStrength = (c: SCard) => TRICK_ORDER.indexOf(c.r)

/** Brisca and tute card points (120 in the deck). */
export const trickPoints = (c: SCard) => ({ 1: 11, 3: 10, 12: 4, 11: 3, 10: 2 })[c.r] ?? 0

/** Winner (index into `played`) of a trick: highest trump, else highest card of the suit led. */
export function trickWinner(played: SCard[], trump: number): number {
  let best = 0
  for (let i = 1; i < played.length; i++) {
    const a = played[best]
    const b = played[i]
    const beats = b.s === a.s ? trickStrength(b) > trickStrength(a) : b.s === trump
    if (beats) best = i
  }
  return best
}

/**
 * "Cambiar el siete": the 7 of trumps takes the turned-up card when that card is
 * an ace, three or court card; the 2 of trumps takes it when it is a 7 or lower.
 */
export function swapCard(muestra: SCard, hand: SCard[]): SCard | null {
  const wanted = muestra.r >= 10 || muestra.r === 1 || muestra.r === 3 ? 7 : muestra.r === 2 ? null : 2
  if (wanted === null) return null
  return hand.find((c) => c.s === muestra.s && c.r === wanted) ?? null
}

/** Sort for display: by suit, then by rank. */
export const sortHand = (hand: SCard[], strength: (c: SCard) => number = (c) => c.r) =>
  [...hand].sort((a, b) => a.s - b.s || strength(a) - strength(b))
