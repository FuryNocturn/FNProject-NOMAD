import { type Rng, shuffled } from '../../lib/rng'

/** Suits: 0 ♠, 1 ♥, 2 ♦, 3 ♣. Ranks 1 (ace) to 13 (king). */
export type Card = { s: number; r: number; up: boolean }
export type DrawCount = 1 | 3
export type State = {
  stock: Card[] // face down, top is the last element
  waste: Card[] // face up, top is the last element
  foundations: Card[][] // 4 piles, built up by suit from the ace
  tableau: Card[][] // 7 piles
  draw: DrawCount
  moves: number
}

/** Where cards are taken from or put on. `index` is the first card of a tableau run. */
export type Loc =
  | { k: 'waste' }
  | { k: 'found'; i: number }
  | { k: 'tab'; i: number; index?: number }

export const isRed = (c: Card) => c.s === 1 || c.s === 2
export const SUITS = ['♠', '♥', '♦', '♣']
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function deal(rng: Rng, draw: DrawCount): State {
  const deck: Card[] = []
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false })
  const cards = shuffled(deck, rng)
  const tableau: Card[][] = []
  for (let i = 0; i < 7; i++) {
    const pile = cards.splice(0, i + 1)
    pile[pile.length - 1].up = true
    tableau.push(pile)
  }
  return { stock: cards, waste: [], foundations: [[], [], [], []], tableau, draw, moves: 0 }
}

/** Turns `draw` cards onto the waste, or turns the waste back over when the stock is empty. */
export function drawCards(st: State): State {
  if (st.stock.length === 0) {
    if (st.waste.length === 0) return st
    return { ...st, stock: [...st.waste].reverse().map((c) => ({ ...c, up: false })), waste: [], moves: st.moves + 1 }
  }
  const n = Math.min(st.draw, st.stock.length)
  const taken = st.stock.slice(-n).reverse().map((c) => ({ ...c, up: true }))
  return { ...st, stock: st.stock.slice(0, -n), waste: [...st.waste, ...taken], moves: st.moves + 1 }
}

export function canStackOnTableau(card: Card, pile: Card[]): boolean {
  const top = pile[pile.length - 1]
  if (!top) return card.r === 13
  return top.up && isRed(top) !== isRed(card) && top.r === card.r + 1
}

export function canStackOnFoundation(card: Card, pile: Card[]): boolean {
  const top = pile[pile.length - 1]
  if (!top) return card.r === 1
  return top.s === card.s && card.r === top.r + 1
}

/** The cards a location would hand over (a face-up run for the tableau, one card otherwise). */
export function cardsAt(st: State, from: Loc): Card[] {
  if (from.k === 'waste') return st.waste.slice(-1)
  if (from.k === 'found') return st.foundations[from.i].slice(-1)
  const pile = st.tableau[from.i]
  const index = from.index ?? pile.length - 1
  const run = pile.slice(index)
  return run.length > 0 && run.every((c) => c.up) ? run : []
}

/** Applies a move, or returns null when the rules forbid it. */
export function move(st: State, from: Loc, to: Loc): State | null {
  const cards = cardsAt(st, from)
  if (cards.length === 0) return null
  if (to.k === 'waste') return null
  if (to.k === 'found') {
    if (cards.length !== 1 || !canStackOnFoundation(cards[0], st.foundations[to.i])) return null
  } else {
    if (from.k === 'tab' && from.i === to.i) return null
    if (!canStackOnTableau(cards[0], st.tableau[to.i])) return null
  }
  const next: State = {
    ...st,
    waste: [...st.waste],
    foundations: st.foundations.map((p) => [...p]),
    tableau: st.tableau.map((p) => [...p]),
    moves: st.moves + 1,
  }
  if (from.k === 'waste') next.waste.pop()
  else if (from.k === 'found') next.foundations[from.i].pop()
  else {
    const pile = next.tableau[from.i]
    pile.splice(pile.length - cards.length)
    // Uncover the card underneath.
    if (pile.length && !pile[pile.length - 1].up) pile[pile.length - 1] = { ...pile[pile.length - 1], up: true }
  }
  if (to.k === 'found') next.foundations[to.i].push(cards[0])
  else next.tableau[to.i].push(...cards)
  return next
}

/** Sends the top card of `from` to whichever foundation takes it (double click / auto-move). */
export function toFoundation(st: State, from: Loc): State | null {
  for (let i = 0; i < 4; i++) {
    const next = move(st, from.k === 'tab' ? { k: 'tab', i: from.i } : from, { k: 'found', i })
    if (next) return next
  }
  return null
}

export const isWon = (st: State) => st.foundations.every((p) => p.length === 13)

/** True when every card is face up with nothing left to turn: the rest can be played automatically. */
export const canAutoFinish = (st: State) =>
  st.stock.length === 0 && st.waste.length === 0 && st.tableau.every((p) => p.every((c) => c.up))

/** One automatic move towards the foundations, or null when none is possible. */
export function autoStep(st: State): State | null {
  for (let i = 0; i < 7; i++) {
    const next = toFoundation(st, { k: 'tab', i })
    if (next) return next
  }
  return st.waste.length ? toFoundation(st, { k: 'waste' }) : null
}
