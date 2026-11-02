import type { Card } from '../../lib/cards'

/** Hand categories, weakest first. */
export const CATEGORIES = [
  'highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush',
] as const
export type Category = (typeof CATEGORIES)[number]
export type HandValue = { score: number; category: Category; cards: Card[] }

/** Scores five cards: higher is better, equal scores tie. */
export function score5(cards: Card[]): HandValue {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a)
  const flush = cards.every((c) => c.s === cards[0].s)
  const unique = [...new Set(ranks)]
  // The wheel (A-2-3-4-5) is a five-high straight.
  let straightHigh = 0
  if (unique.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0]
    else if (ranks.join() === '14,5,4,3,2') straightHigh = 5
  }
  const counts = new Map<number, number>()
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1)
  // Groups by size, then rank: e.g. full house 3 + 2.
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const shape = groups.map((g) => g[1]).join('')
  let cat: number
  let kickers: number[]
  if (straightHigh && flush) [cat, kickers] = [8, [straightHigh]]
  else if (shape === '41') [cat, kickers] = [7, groups.map((g) => g[0])]
  else if (shape === '32') [cat, kickers] = [6, groups.map((g) => g[0])]
  else if (flush) [cat, kickers] = [5, ranks]
  else if (straightHigh) [cat, kickers] = [4, [straightHigh]]
  else if (shape === '311') [cat, kickers] = [3, groups.map((g) => g[0])]
  else if (shape === '221') [cat, kickers] = [2, groups.map((g) => g[0])]
  else if (shape === '2111') [cat, kickers] = [1, groups.map((g) => g[0])]
  else [cat, kickers] = [0, ranks]
  const score = kickers.reduce((s, k, i) => s + k * 15 ** (4 - i), cat * 15 ** 5)
  return { score, category: CATEGORIES[cat], cards }
}

function* combinations<T>(items: T[], k: number, start = 0, picked: T[] = []): Generator<T[]> {
  if (picked.length === k) {
    yield picked
    return
  }
  for (let i = start; i <= items.length - (k - picked.length); i++) yield* combinations(items, k, i + 1, [...picked, items[i]])
}

const best = (hands: Iterable<Card[]>) => {
  let top: HandValue | null = null
  for (const h of hands) {
    const v = score5(h)
    if (!top || v.score > top.score) top = v
  }
  return top!
}

/** Hold'em: best five of the seven cards. */
export const bestHoldem = (hole: Card[], board: Card[]) => best(combinations([...hole, ...board], 5))

/** Omaha: exactly two hole cards and exactly three from the board. */
export function bestOmaha(hole: Card[], board: Card[]): HandValue {
  const hands: Card[][] = []
  for (const h of combinations(hole, 2)) for (const b of combinations(board, 3)) hands.push([...h, ...b])
  return best(hands)
}
