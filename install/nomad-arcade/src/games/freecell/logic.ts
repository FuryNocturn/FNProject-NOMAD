import { isRed } from '../solitaire/logic'

/**
 * FreeCell with the classic numbered deals (the same deal #1..#32000 as the
 * Windows game). Cards are { s, r } with suits 0 ♠, 1 ♥, 2 ♦, 3 ♣ and rank 1..13.
 */
export type Card = { s: number; r: number; up: true }
export type State = { columns: Card[][]; cells: (Card | null)[]; foundations: Card[][]; deal: number; moves: number }
export type Loc = { k: 'col'; i: number; index?: number } | { k: 'cell'; i: number } | { k: 'found'; i: number }

/** Microsoft's FreeCell deal generator (linear congruential, as in the original). */
export function msDeal(seed: number): Card[][] {
  let state = seed
  const rand = () => {
    state = (state * 214013 + 2531011) & 0x7fffffff
    return state >> 16
  }
  const deck = Array.from({ length: 52 }, (_, i) => 51 - i)
  for (let i = 0; i < 52; i++) {
    const j = 51 - (rand() % (52 - i))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  // Card number c: rank c / 4, suit c % 4 in the order clubs, diamonds, hearts, spades.
  const SUIT_OF = [3, 2, 1, 0]
  const columns: Card[][] = Array.from({ length: 8 }, () => [])
  deck.forEach((c, i) => columns[i % 8].push({ r: Math.floor(c / 4) + 1, s: SUIT_OF[c % 4], up: true }))
  return columns
}

export const newGame = (deal: number): State => ({
  columns: msDeal(deal),
  cells: [null, null, null, null],
  foundations: [[], [], [], []],
  deal,
  moves: 0,
})

const top = <T,>(a: T[]) => a[a.length - 1]

/** How many cards can move at once: (free cells + 1) x 2^(empty columns not used as the target). */
export function maxRun(st: State, toEmptyColumn: boolean): number {
  const freeCells = st.cells.filter((c) => !c).length
  const empty = st.columns.filter((c) => !c.length).length - (toEmptyColumn ? 1 : 0)
  return (freeCells + 1) * 2 ** Math.max(0, empty)
}

/** Start of the alternating-colour descending run at the bottom of a column. */
export function runStart(col: Card[]): number {
  let i = col.length - 1
  while (i > 0 && isRed(col[i - 1]) !== isRed(col[i]) && col[i - 1].r === col[i].r + 1) i--
  return i
}

function cardsAt(st: State, from: Loc): Card[] {
  if (from.k === 'cell') return st.cells[from.i] ? [st.cells[from.i]!] : []
  if (from.k === 'found') return st.foundations[from.i].length ? [top(st.foundations[from.i])] : []
  const col = st.columns[from.i]
  const index = from.index ?? col.length - 1
  return index >= runStart(col) ? col.slice(index) : []
}

export function move(st: State, from: Loc, to: Loc): State | null {
  const cards = cardsAt(st, from)
  if (!cards.length || (from.k === to.k && from.i === to.i)) return null
  const first = cards[0]
  if (to.k === 'cell') {
    if (cards.length !== 1 || st.cells[to.i]) return null
  } else if (to.k === 'found') {
    const f = top(st.foundations[to.i])
    if (cards.length !== 1 || (f ? f.s !== first.s || f.r !== first.r - 1 : first.r !== 1)) return null
  } else {
    const t = top(st.columns[to.i])
    if (t && (isRed(t) === isRed(first) || t.r !== first.r + 1)) return null
    if (cards.length > maxRun(st, !t)) return null
  }
  const next: State = {
    ...st,
    columns: st.columns.map((c) => [...c]),
    cells: [...st.cells],
    foundations: st.foundations.map((f) => [...f]),
    moves: st.moves + 1,
  }
  if (from.k === 'cell') next.cells[from.i] = null
  else if (from.k === 'found') next.foundations[from.i].pop()
  else next.columns[from.i].splice(next.columns[from.i].length - cards.length)
  if (to.k === 'cell') next.cells[to.i] = first
  else if (to.k === 'found') next.foundations[to.i].push(first)
  else next.columns[to.i].push(...cards)
  return next
}

/**
 * Moves cards to the foundations while it cannot hurt: aces and twos always,
 * other cards once both foundations of the opposite colour have reached one rank lower.
 */
export function autoPlay(st: State): State {
  let cur = st
  for (let changed = true; changed; ) {
    changed = false
    const sources: Loc[] = [...cur.cells.map((_, i) => ({ k: 'cell', i }) as Loc), ...cur.columns.map((_, i) => ({ k: 'col', i }) as Loc)]
    for (const from of sources) {
      const card = cardsAt(cur, from).slice(-1)[0]
      if (!card || (from.k === 'col' && cardsAt(cur, from).length !== 1 && top(cur.columns[from.i]) !== card)) continue
      const level = (s: number) => cur.foundations.find((f) => f.length && f[0].s === s)?.length ?? 0
      const opposite = isRed(card) ? [0, 3] : [1, 2]
      if (card.r > 2 && !opposite.every((s) => level(s) >= card.r - 1)) continue
      for (let i = 0; i < 4; i++) {
        const next = move(cur, from.k === 'col' ? { k: 'col', i: from.i } : from, { k: 'found', i })
        if (next) {
          cur = { ...next, moves: cur.moves }
          changed = true
          break
        }
      }
    }
  }
  return cur
}

export const isWon = (st: State) => st.foundations.every((f) => f.length === 13)
