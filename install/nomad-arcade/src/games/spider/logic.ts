import { type Rng, shuffled } from '../../lib/rng'
import type { Card } from '../solitaire/logic'

/**
 * Spider: two decks, 10 columns. Runs of one suit in descending order move
 * together; any card goes on one rank higher. A full K..A run of one suit is
 * removed. Dealing gives every column a card and needs no empty column.
 */
export type Suits = 1 | 2 | 4
export type State = { columns: Card[][]; stock: Card[]; done: number; suits: Suits; moves: number; score: number }

export function deal(rng: Rng, suits: Suits): State {
  const suitList = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3]
  const deck: Card[] = []
  // 104 cards: 8 full runs, spread over the chosen suits.
  for (let k = 0; k < 8; k++) for (let r = 1; r <= 13; r++) deck.push({ s: suitList[k % suitList.length], r, up: false })
  const cards = shuffled(deck, rng)
  const columns = Array.from({ length: 10 }, (_, i) => {
    const pile = cards.splice(0, i < 4 ? 6 : 5)
    pile[pile.length - 1].up = true
    return pile
  })
  return { columns, stock: cards, done: 0, suits, moves: 0, score: 500 }
}

/** Index where the movable run at the bottom of a column starts. */
export function runStart(col: Card[]): number {
  let i = col.length - 1
  while (i > 0 && col[i - 1].up && col[i - 1].s === col[i].s && col[i - 1].r === col[i].r + 1) i--
  return i
}

/** Removes completed K..A runs and turns up the new bottom cards. */
function tidy(st: State): State {
  let done = st.done
  let score = st.score
  const columns = st.columns.map((col) => {
    let c = col
    if (c.length >= 13) {
      const tail = c.slice(-13)
      if (tail.every((x, k) => x.up && x.s === tail[0].s && x.r === 13 - k)) {
        c = c.slice(0, -13)
        done++
        score += 100
      }
    }
    if (c.length && !c[c.length - 1].up) c = [...c.slice(0, -1), { ...c[c.length - 1], up: true }]
    return c
  })
  return { ...st, columns, done, score }
}

export function canMove(st: State, from: number, index: number, to: number): boolean {
  const col = st.columns[from]
  if (from === to || index < runStart(col) || index >= col.length) return false
  const target = st.columns[to]
  const top = target[target.length - 1]
  return !top || top.r === col[index].r + 1
}

export function move(st: State, from: number, index: number, to: number): State | null {
  if (!canMove(st, from, index, to)) return null
  const columns = st.columns.map((c) => [...c])
  const run = columns[from].splice(index)
  columns[to].push(...run)
  return tidy({ ...st, columns, moves: st.moves + 1, score: st.score - 1 })
}

export const canDeal = (st: State) => st.stock.length > 0 && st.columns.every((c) => c.length > 0)

export function dealRow(st: State): State | null {
  if (!canDeal(st)) return null
  const stock = [...st.stock]
  const columns = st.columns.map((c) => [...c, { ...stock.pop()!, up: true }])
  return tidy({ ...st, columns, stock, moves: st.moves + 1, score: st.score - 1 })
}

export const isWon = (st: State) => st.done === 8
