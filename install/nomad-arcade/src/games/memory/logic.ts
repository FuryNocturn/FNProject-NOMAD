import { type Rng, shuffled } from '../../lib/rng'

export type Size = 'small' | 'medium' | 'large'
export const SIZES: Record<Size, { pairs: number; cols: number }> = {
  small: { pairs: 8, cols: 4 },
  medium: { pairs: 12, cols: 6 },
  large: { pairs: 18, cols: 6 },
}

const FACES = [
  '🍎', '🍌', '🍇', '🍓', '🥕', '🌽', '🐶', '🐱', '🦊', '🐻', '🐼', '🐸',
  '🚗', '🚀', '⚓', '🌙', '⭐', '🔥', '🌲', '🍄', '🎈', '🎸', '⚽', '🧭',
]

export type Card = { face: string; matched: boolean }
export type State = { cards: Card[]; open: number[]; moves: number }

export function newGame(size: Size, rng: Rng): State {
  const faces = shuffled(FACES, rng).slice(0, SIZES[size].pairs)
  const cards = shuffled([...faces, ...faces], rng).map((face) => ({ face, matched: false }))
  return { cards, open: [], moves: 0 }
}

/**
 * Turns a card. A second card completes a move: a pair stays matched,
 * otherwise both stay open until `closeUnmatched` (the screen waits a moment so they can be seen).
 */
export function flip(st: State, i: number): State {
  const card = st.cards[i]
  if (card.matched || st.open.includes(i) || st.open.length >= 2) return st
  const open = [...st.open, i]
  if (open.length < 2) return { ...st, open }
  const [a, b] = open
  if (st.cards[a].face !== st.cards[b].face) return { ...st, open, moves: st.moves + 1 }
  const cards = st.cards.map((c, k) => (k === a || k === b ? { ...c, matched: true } : c))
  return { cards, open: [], moves: st.moves + 1 }
}

export const closeUnmatched = (st: State): State => (st.open.length === 2 ? { ...st, open: [] } : st)

export const isWon = (st: State) => st.cards.every((c) => c.matched)
