import { type Card, newDeck } from '../../lib/cards'
import type { Rng } from '../../lib/rng'

/**
 * Blackjack against the dealer with play chips. Six decks, reshuffled when a
 * quarter is left. Dealer stands on all 17s; blackjack pays 3:2. The player
 * can hit, stand, double on any two cards and split pairs (up to four hands).
 */
export type Hand = { cards: Card[]; bet: number; done: boolean; doubled: boolean; fromSplit: boolean }
export type Outcome = 'blackjack' | 'win' | 'push' | 'lose'
export type State = {
  shoe: Card[]
  dealer: Card[]
  hands: Hand[]
  active: number
  phase: 'bet' | 'play' | 'done'
  chips: number
  results: { outcome: Outcome; delta: number }[]
}

const DECKS = 6

/** Best total, counting aces as 11 where that does not bust. */
export function total(cards: Card[]): { value: number; soft: boolean } {
  let value = 0
  let aces = 0
  for (const c of cards) {
    if (c.r === 14) {
      aces++
      value += 11
    } else value += Math.min(c.r, 10)
  }
  while (value > 21 && aces) {
    value -= 10
    aces--
  }
  return { value, soft: aces > 0 }
}

export const isBlackjack = (cards: Card[]) => cards.length === 2 && total(cards).value === 21

export const newState = (rng: Rng, chips = 1000): State => ({
  shoe: newDeck(rng, DECKS),
  dealer: [],
  hands: [],
  active: 0,
  phase: 'bet',
  chips,
  results: [],
})

export function deal(st: State, bet: number, rng: Rng): State {
  if (st.phase === 'play' || bet <= 0 || bet > st.chips) return st
  const shoe = st.shoe.length < 52 * DECKS * 0.25 ? newDeck(rng, DECKS) : [...st.shoe]
  const draw = () => shoe.pop()!
  const player = [draw(), draw()]
  const dealer = [draw(), draw()]
  const next: State = {
    ...st,
    shoe,
    dealer,
    hands: [{ cards: player, bet, done: false, doubled: false, fromSplit: false }],
    active: 0,
    phase: 'play',
    chips: st.chips - bet,
    results: [],
  }
  // A natural on either side ends the round at once.
  if (isBlackjack(player) || isBlackjack(dealer)) return finish(next)
  return next
}

const current = (st: State) => st.hands[st.active]

export function canDouble(st: State) {
  const h = current(st)
  return st.phase === 'play' && h.cards.length === 2 && st.chips >= h.bet
}

export function canSplit(st: State) {
  const h = current(st)
  return (
    st.phase === 'play' && h.cards.length === 2 && Math.min(h.cards[0].r, 10) === Math.min(h.cards[1].r, 10) &&
    st.hands.length < 4 && st.chips >= h.bet
  )
}

/** Moves to the next unfinished hand, or lets the dealer play when all are done. */
function advance(st: State): State {
  const next = st.hands.findIndex((h) => !h.done)
  return next < 0 ? finish(st) : { ...st, active: next }
}

function updateHand(st: State, h: Hand): State {
  const hands = st.hands.map((x, i) => (i === st.active ? h : x))
  return { ...st, hands }
}

export function hit(st: State): State {
  if (st.phase !== 'play') return st
  const shoe = [...st.shoe]
  const h = current(st)
  const cards = [...h.cards, shoe.pop()!]
  const done = total(cards).value >= 21
  return advance(updateHand({ ...st, shoe }, { ...h, cards, done }))
}

export function stand(st: State): State {
  if (st.phase !== 'play') return st
  return advance(updateHand(st, { ...current(st), done: true }))
}

export function double(st: State): State {
  if (!canDouble(st)) return st
  const shoe = [...st.shoe]
  const h = current(st)
  const cards = [...h.cards, shoe.pop()!]
  return advance(updateHand({ ...st, shoe, chips: st.chips - h.bet }, { ...h, cards, bet: h.bet * 2, doubled: true, done: true }))
}

export function split(st: State): State {
  if (!canSplit(st)) return st
  const shoe = [...st.shoe]
  const h = current(st)
  const aces = h.cards[0].r === 14
  // Split aces get one card each and stand.
  const a: Hand = { cards: [h.cards[0], shoe.pop()!], bet: h.bet, done: aces, doubled: false, fromSplit: true }
  const b: Hand = { cards: [h.cards[1], shoe.pop()!], bet: h.bet, done: aces, doubled: false, fromSplit: true }
  const hands = [...st.hands.slice(0, st.active), a, b, ...st.hands.slice(st.active + 1)]
  return advance({ ...st, shoe, hands, chips: st.chips - h.bet })
}

/** Dealer draws to 17 (unless every hand busted), then each hand is settled. */
function finish(st: State): State {
  const shoe = [...st.shoe]
  const dealer = [...st.dealer]
  // No need to draw when every hand busted, or against a lone player blackjack.
  const anyStanding = st.hands.some((h) => total(h.cards).value <= 21)
  const naturalOnly = st.hands.length === 1 && isBlackjack(st.hands[0].cards)
  if (anyStanding && !naturalOnly && !isBlackjack(dealer)) while (total(dealer).value < 17) dealer.push(shoe.pop()!)
  const d = total(dealer).value
  const dealerBJ = isBlackjack(dealer)
  let chips = st.chips
  const results = st.hands.map((h) => {
    const p = total(h.cards).value
    // A 21 on a split hand is not a blackjack.
    const playerBJ = isBlackjack(h.cards) && !h.fromSplit
    let outcome: Outcome
    if (playerBJ && !dealerBJ) outcome = 'blackjack'
    else if (p > 21) outcome = 'lose'
    else if (dealerBJ) outcome = playerBJ ? 'push' : 'lose'
    else if (d > 21 || p > d) outcome = 'win'
    else outcome = p === d ? 'push' : 'lose'
    // 3:2 on an odd bet is rounded down to whole chips.
    const back = outcome === 'blackjack' ? Math.floor(h.bet * 2.5) : outcome === 'win' ? h.bet * 2 : outcome === 'push' ? h.bet : 0
    chips += back
    return { outcome, delta: back - h.bet }
  })
  return { ...st, shoe, dealer, hands: st.hands.map((h) => ({ ...h, done: true })), phase: 'done', chips, results }
}
