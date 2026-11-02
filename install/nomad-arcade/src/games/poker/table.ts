import { type Card, newDeck } from '../../lib/cards'
import { type Rng, shuffled } from '../../lib/rng'
import { type HandValue, bestHoldem, bestOmaha } from './hands'

/** No-limit Hold'em or Omaha against computer players, with play chips. Player 0 is the human. */
export type Variant = 'holdem' | 'omaha'
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type Seat = {
  stack: number
  hole: Card[]
  bet: number // chips put in on this street
  total: number // chips put in this hand
  folded: boolean
  allIn: boolean
  out: boolean // busted: no chips left
}
export type Action = { type: 'fold' | 'check' | 'call' } | { type: 'raise'; to: number }
export type Award = { seat: number; amount: number; hand: HandValue | null }
export type Table = {
  variant: Variant
  seats: Seat[]
  deck: Card[]
  board: Card[]
  dealer: number
  street: Street
  toAct: number
  currentBet: number
  minRaise: number
  needsAction: boolean[]
  sb: number
  bb: number
  awards: Award[] | null // set when the hand is over
  lastActions: (string | null)[]
}

export const holeCount = (v: Variant) => (v === 'omaha' ? 4 : 2)
export const evaluate = (v: Variant, hole: Card[], board: Card[]) =>
  v === 'omaha' ? bestOmaha(hole, board) : bestHoldem(hole, board)

export function newTable(variant: Variant, players = 4, stack = 1000): Table {
  return {
    variant,
    seats: Array.from({ length: players }, () => ({ stack, hole: [], bet: 0, total: 0, folded: false, allIn: false, out: false })),
    deck: [],
    board: [],
    dealer: players - 1,
    street: 'showdown',
    toAct: -1,
    currentBet: 0,
    minRaise: 20,
    needsAction: Array(players).fill(false),
    sb: 10,
    bb: 20,
    awards: [],
    lastActions: Array(players).fill(null),
  }
}

const inHand = (t: Table) => t.seats.flatMap((s, i) => (!s.out && !s.folded ? [i] : []))
const canAct = (s: Seat) => !s.out && !s.folded && !s.allIn

function nextSeat(t: Table, from: number, pred: (s: Seat) => boolean): number {
  for (let k = 1; k <= t.seats.length; k++) {
    const i = (from + k) % t.seats.length
    if (pred(t.seats[i])) return i
  }
  return -1
}

/** Puts chips in, capped by the stack (all-in). */
function commit(seat: Seat, amount: number) {
  const put = Math.min(amount, seat.stack)
  seat.stack -= put
  seat.bet += put
  seat.total += put
  if (seat.stack === 0) seat.allIn = true
}

export function startHand(prev: Table, rng: Rng): Table {
  const t: Table = structuredClone(prev)
  t.seats.forEach((s) => {
    s.out = s.stack <= 0
    Object.assign(s, { hole: [], bet: 0, total: 0, folded: false, allIn: false })
  })
  if (t.seats.filter((s) => !s.out).length < 2) return t
  t.deck = newDeck(rng)
  t.board = []
  t.awards = null
  t.street = 'preflop'
  t.lastActions = t.seats.map(() => null)
  t.dealer = nextSeat(t, t.dealer, (s) => !s.out)
  const active = t.seats.filter((s) => !s.out).length
  // Heads-up the dealer posts the small blind.
  const sbSeat = active === 2 ? t.dealer : nextSeat(t, t.dealer, (s) => !s.out)
  const bbSeat = nextSeat(t, sbSeat, (s) => !s.out)
  commit(t.seats[sbSeat], t.sb)
  commit(t.seats[bbSeat], t.bb)
  for (let k = 0; k < holeCount(t.variant); k++) for (const s of t.seats) if (!s.out) s.hole.push(t.deck.pop()!)
  t.currentBet = t.bb
  t.minRaise = t.bb
  t.needsAction = t.seats.map(canAct)
  t.toAct = nextSeat(t, bbSeat, canAct)
  return settle(t)
}

export function legalActions(t: Table, seat = t.toAct) {
  const s = t.seats[seat]
  const toCall = Math.min(t.currentBet - s.bet, s.stack)
  const maxTo = s.bet + s.stack
  const minTo = Math.min(t.currentBet + t.minRaise, maxTo)
  return { canCheck: toCall === 0, toCall, canRaise: maxTo > t.currentBet, minTo, maxTo }
}

export function act(prev: Table, a: Action): Table {
  if (prev.awards || prev.toAct < 0) return prev
  const t: Table = structuredClone(prev)
  const i = t.toAct
  const s = t.seats[i]
  const { toCall, canRaise, minTo, maxTo } = legalActions(t, i)
  if (a.type === 'fold') {
    s.folded = true
    t.lastActions[i] = 'fold'
  } else if (a.type !== 'raise' || !canRaise) {
    commit(s, toCall)
    t.lastActions[i] = toCall ? (s.allIn ? 'allIn' : 'call') : 'check'
  } else {
    const to = Math.max(minTo, Math.min(a.to, maxTo))
    const raiseBy = to - t.currentBet
    commit(s, to - s.bet)
    // A short all-in raise does not reopen the minimum raise size.
    if (raiseBy >= t.minRaise) t.minRaise = raiseBy
    t.currentBet = Math.max(t.currentBet, s.bet)
    t.seats.forEach((o, k) => (t.needsAction[k] = k !== i && canAct(o)))
    t.lastActions[i] = s.allIn ? 'allIn' : 'raise'
  }
  t.needsAction[i] = false
  t.toAct = nextSeat(t, i, canAct)
  return settle(t)
}

function dealStreet(t: Table) {
  const n = t.street === 'preflop' ? 3 : 1
  for (let k = 0; k < n; k++) t.board.push(t.deck.pop()!)
  t.street = t.street === 'preflop' ? 'flop' : t.street === 'flop' ? 'turn' : 'river'
}

/** Advances streets when betting is done, runs out the board when nobody can act, and pays the pots. */
function settle(t: Table): Table {
  for (;;) {
    const live = inHand(t)
    if (live.length === 1) return award(t, [[live[0]]])
    const bettingDone =
      t.seats.every((s, k) => !canAct(s) || (!t.needsAction[k] && s.bet === t.currentBet)) ||
      t.seats.filter(canAct).length === 0
    // Only one player can still bet and has matched: nothing left to decide.
    const oneLeft = t.seats.filter(canAct).length <= 1 && t.seats.every((s) => !canAct(s) || s.bet >= t.currentBet)
    if (!bettingDone && !oneLeft) return t
    if (t.street === 'river') return showdown(t)
    for (const s of t.seats) s.bet = 0
    t.currentBet = 0
    t.minRaise = t.bb
    dealStreet(t)
    t.needsAction = t.seats.map(canAct)
    t.toAct = nextSeat(t, t.dealer, canAct)
    if (t.seats.filter(canAct).length >= 2) return t
  }
}

/** Splits every pot level among the best hands still in, so all-in players only win what they matched. */
function showdown(t: Table): Table {
  t.street = 'showdown'
  const live = inHand(t)
  const values = new Map(live.map((i) => [i, evaluate(t.variant, t.seats[i].hole, t.board)]))
  const levels = [...new Set(t.seats.map((s) => s.total).filter((x) => x > 0))].sort((a, b) => a - b)
  const winnersPerPot: number[][] = []
  const potSizes: number[] = []
  let prev = 0
  for (const level of levels) {
    const size = t.seats.reduce((sum, s) => sum + Math.max(0, Math.min(s.total, level) - prev), 0)
    const eligible = live.filter((i) => t.seats[i].total >= level)
    prev = level
    if (!eligible.length || !size) continue
    const top = Math.max(...eligible.map((i) => values.get(i)!.score))
    winnersPerPot.push(eligible.filter((i) => values.get(i)!.score === top))
    potSizes.push(size)
  }
  return award(t, winnersPerPot, potSizes, values)
}

function award(t: Table, winners: number[][], sizes?: number[], values?: Map<number, HandValue>): Table {
  const totals = new Map<number, number>()
  const potSizes = sizes ?? [t.seats.reduce((s, x) => s + x.total, 0)]
  winners.forEach((ws, k) => {
    const share = Math.floor(potSizes[k] / ws.length)
    // Odd chips go to the first winner after the dealer.
    const order = [...ws].sort((a, b) => ((a - t.dealer + t.seats.length) % t.seats.length) - ((b - t.dealer + t.seats.length) % t.seats.length))
    order.forEach((w, j) => totals.set(w, (totals.get(w) ?? 0) + share + (j === 0 ? potSizes[k] - share * ws.length : 0)))
  })
  for (const [w, amount] of totals) t.seats[w].stack += amount
  t.awards = [...totals].map(([seat, amount]) => ({ seat, amount, hand: values?.get(seat) ?? null }))
  t.toAct = -1
  return t
}

// ── Computer players ──────────────────────────────────

/** Share of random run-outs this hand wins against `opponents` random hands. */
export function equity(t: Table, seat: number, opponents: number, rng: Rng, iterations = 150): number {
  const me = t.seats[seat].hole
  const known = new Set([...me, ...t.board].map((c) => c.r * 4 + c.s))
  const rest = newDeck(rng).filter((c) => !known.has(c.r * 4 + c.s))
  const n = holeCount(t.variant)
  let wins = 0
  for (let it = 0; it < iterations; it++) {
    const deck = shuffled(rest, rng)
    const board = [...t.board, ...deck.splice(0, 5 - t.board.length)]
    const mine = evaluate(t.variant, me, board).score
    let best = true
    let tie = false
    for (let o = 0; o < opponents && best; o++) {
      const v = evaluate(t.variant, deck.splice(0, n), board).score
      if (v > mine) best = false
      else if (v === mine) tie = true
    }
    if (best) wins += tie ? 0.5 : 1
  }
  return wins / iterations
}

/** Calls or raises when the odds justify it, with the occasional bluff. */
export function botAction(t: Table, rng: Rng): Action {
  const seat = t.toAct
  const { canCheck, toCall, canRaise, minTo, maxTo } = legalActions(t, seat)
  const pot = t.seats.reduce((s, x) => s + x.total, 0)
  const opponents = inHand(t).length - 1
  const e = equity(t, seat, opponents, rng)
  const bluff = rng() < 0.06
  const raiseTo = (frac: number) => ({ type: 'raise' as const, to: Math.min(maxTo, Math.max(minTo, t.currentBet + Math.round(pot * frac))) })
  if (canCheck) {
    if (canRaise && (e > 0.62 || bluff)) return raiseTo(e > 0.8 ? 0.9 : 0.5)
    return { type: 'check' }
  }
  const potOdds = toCall / (pot + toCall)
  if (canRaise && e > 0.72 && rng() < 0.7) return raiseTo(0.75)
  if (e >= potOdds * 1.05 || (toCall <= t.bb && rng() < 0.5)) return { type: 'call' }
  return bluff && canRaise ? raiseTo(0.6) : { type: 'fold' }
}

