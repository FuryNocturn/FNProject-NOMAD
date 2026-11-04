import { type Rng, randomInt, shuffled } from '../../lib/rng'
import { RANKS_40, type SCard, sameCard, spanishDeck } from '../../lib/spanish'

/**
 * Chinchón with the 40-card deck (or 42 with two jokers). Seven cards each; on your
 * turn draw from the stock or the discard pile, then discard. Melds are three or
 * four of a rank, or three or more in sequence in one suit (1-7, sota, caballo, rey).
 * You may close when what is left unmatched adds up to 5 or less: everyone then
 * scores their unmatched cards (court cards 10, a joker 25), the closer gets -10
 * with nothing unmatched, and seven in sequence in one suit without a joker
 * (chinchón) wins the match. Over 100 points you are out; the last one in wins.
 * Player 0 is the human.
 */
export type Variant = 'classic' | 'jokers'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Phase = 'draw' | 'discard'
export type State = {
  variant: Variant
  hands: SCard[][]
  deck: SCard[]
  discard: SCard[] // top is last
  turn: number
  phase: Phase
  /** Card just taken from the discard pile, which cannot go straight back. */
  taken: SCard | null
  /** Cards each player has picked up from the discard pile this round (the hard bots watch them). */
  picked: SCard[][]
  scores: number[]
  out: boolean[]
  starter: number
  round: { closer: number; chinchon: boolean; added: number[] } | null
  winner: number | null
}

export const CLOSE_LIMIT = 5
export const OUT_OVER = 100
const JOKER_POINTS = 25

export const isJoker = (c: SCard) => c.r === 0
export const cardPoints = (c: SCard) => (isJoker(c) ? JOKER_POINTS : c.r >= 10 ? 10 : c.r)
const pos = (r: number) => RANKS_40.indexOf(r)

export function newMatch(rng: Rng, players: number, variant: Variant): State {
  const base = { variant, scores: Array(players).fill(0), out: Array(players).fill(false), starter: 0 }
  return dealRound(rng, base)
}

export function dealRound(rng: Rng, prev: Pick<State, 'variant' | 'scores' | 'out' | 'starter'>): State {
  const deck = spanishDeck(rng, { jokers: prev.variant === 'jokers' ? 2 : 0 })
  const n = prev.scores.length
  const hands = Array.from({ length: n }, (_, p) => (prev.out[p] ? [] : deck.splice(0, 7)))
  const discard = [deck.pop()!]
  let turn = prev.starter
  while (prev.out[turn]) turn = (turn + 1) % n
  return {
    ...prev, hands, deck, discard, turn, phase: 'draw', taken: null,
    picked: hands.map(() => []), round: null, winner: null,
  }
}

// ── Melds ─────────────────────────────────────────────

export type Arrangement = { melds: SCard[][]; loose: SCard[]; points: number }

/** Melds that use `c` (a real card), drawing on the other real cards and `jokers` wildcards. */
function meldsWith(c: SCard, others: SCard[], jokers: SCard[]): { meld: SCard[]; used: SCard[]; jokersUsed: number }[] {
  const out: { meld: SCard[]; used: SCard[]; jokersUsed: number }[] = []
  // Groups of a rank (3 or 4 cards, jokers filling in).
  const same = others.filter((o) => o.r === c.r)
  const subsets = (arr: SCard[]): SCard[][] => arr.reduce<SCard[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]])
  for (const sub of subsets(same)) {
    for (let j = 0; j <= Math.min(jokers.length, 2); j++) {
      const size = 1 + sub.length + j
      if (size >= 3 && size <= 4) out.push({ meld: [c, ...sub, ...jokers.slice(0, j)], used: sub, jokersUsed: j })
    }
  }
  // Runs in c's suit through c's position.
  const p = pos(c.r)
  for (let start = Math.max(0, p - 9); start <= p; start++) {
    for (let end = Math.max(p, start + 2); end < RANKS_40.length; end++) {
      const used: SCard[] = []
      let need = 0
      for (let i = start; i <= end; i++) {
        if (i === p) continue
        const real = others.find((o) => o.s === c.s && o.r === RANKS_40[i])
        if (real) used.push(real)
        else need++
      }
      if (need > jokers.length || used.length + 1 < 2) continue
      const meld = [c, ...used, ...jokers.slice(0, need)]
      out.push({ meld, used, jokersUsed: need })
    }
  }
  return out
}

/** The way to lay out `cards` that leaves the fewest unmatched points. */
export function arrange(cards: SCard[]): Arrangement {
  const real = cards.filter((c) => !isJoker(c)).sort((a, b) => a.s - b.s || pos(a.r) - pos(b.r))
  const jokers = cards.filter(isJoker)
  const memo = new Map<string, Arrangement>()

  const search = (rest: SCard[], jk: SCard[]): Arrangement => {
    const key = rest.map((c) => `${c.r}.${c.s}`).join() + '|' + jk.length
    const hit = memo.get(key)
    if (hit) return hit
    let best: Arrangement
    if (!rest.length) {
      best = { melds: [], loose: jk, points: jk.length * JOKER_POINTS }
    } else {
      const [c, ...others] = rest
      const skip = search(others, jk)
      best = { melds: skip.melds, loose: [c, ...skip.loose], points: skip.points + cardPoints(c) }
      for (const m of meldsWith(c, others, jk)) {
        const sub = search(others.filter((o) => !m.used.includes(o)), jk.slice(m.jokersUsed))
        if (sub.points < best.points || (sub.points === best.points && sub.loose.length < best.loose.length))
          best = { melds: [m.meld, ...sub.melds], loose: sub.loose, points: sub.points }
      }
    }
    memo.set(key, best)
    return best
  }

  const best = search(real, jokers)
  // A spare joker can always join a meld already on the table.
  if (best.melds.length && best.loose.some(isJoker)) {
    const spare = best.loose.filter(isJoker)
    const loose = best.loose.filter((c) => !isJoker(c))
    return { melds: [...best.melds.slice(0, -1), [...best.melds.at(-1)!, ...spare]], loose, points: loose.reduce((s, c) => s + cardPoints(c), 0) }
  }
  return best
}

/** Seven in sequence in one suit, no jokers. */
export function isChinchon(cards: SCard[]): boolean {
  if (cards.length !== 7 || cards.some(isJoker) || new Set(cards.map((c) => c.s)).size !== 1) return false
  const ps = cards.map((c) => pos(c.r)).sort((a, b) => a - b)
  return ps.every((v, i) => i === 0 || v === ps[i - 1] + 1)
}

// ── Turn ──────────────────────────────────────────────

const nextActive = (st: State, from: number) => {
  let p = from
  do p = (p + 1) % st.hands.length
  while (st.out[p])
  return p
}

export function drawStock(st: State): State | null {
  if (st.round || st.phase !== 'draw') return null
  let deck = [...st.deck]
  let discard = [...st.discard]
  if (!deck.length) {
    // Reshuffle everything under the top discard.
    const top = discard.pop()!
    deck = shuffled(discard, Math.random)
    discard = [top]
  }
  const card = deck.pop()
  if (!card) return null
  const hands = st.hands.map((h, p) => (p === st.turn ? [...h, card] : h))
  return { ...st, deck, discard, hands, phase: 'discard', taken: null }
}

export function drawDiscard(st: State): State | null {
  if (st.round || st.phase !== 'draw' || !st.discard.length) return null
  const card = st.discard.at(-1)!
  const hands = st.hands.map((h, p) => (p === st.turn ? [...h, card] : h))
  const picked = st.picked.map((k, p) => (p === st.turn ? [...k, card] : k))
  return { ...st, discard: st.discard.slice(0, -1), hands, picked, phase: 'discard', taken: card }
}

const without = (hand: SCard[], card: SCard) => {
  const i = hand.findIndex((c) => sameCard(c, card))
  return [...hand.slice(0, i), ...hand.slice(i + 1)]
}

export function canDiscard(st: State, card: SCard): boolean {
  return !st.round && st.phase === 'discard' && st.hands[st.turn].some((c) => sameCard(c, card)) && !(st.taken && sameCard(st.taken, card))
}

export function discard(st: State, card: SCard): State | null {
  if (!canDiscard(st, card)) return null
  const hands = st.hands.map((h, p) => (p === st.turn ? without(h, card) : h))
  return { ...st, hands, discard: [...st.discard, card], turn: nextActive(st, st.turn), phase: 'draw', taken: null }
}

export function canClose(st: State, card: SCard): boolean {
  return canDiscard(st, card) && arrange(without(st.hands[st.turn], card)).points <= CLOSE_LIMIT
}

/** Close the round by laying `card` face down; scores everyone and checks who is out. */
export function close(st: State, card: SCard): State | null {
  if (!canClose(st, card)) return null
  const closer = st.turn
  const hands = st.hands.map((h, p) => (p === closer ? without(h, card) : h))
  const chinchon = isChinchon(hands[closer])
  const added = hands.map((h, p) => {
    if (st.out[p]) return 0
    const pts = arrange(h).points
    return p === closer && pts === 0 ? -10 : pts
  })
  const scores = st.scores.map((s, p) => s + added[p])
  const out = st.out.map((o, p) => o || scores[p] > OUT_OVER)
  const alive = out.map((o, p) => (o ? -1 : p)).filter((p) => p >= 0)
  const winner = chinchon ? closer : alive.length === 1 ? alive[0] : alive.length === 0 ? closer : null
  return { ...st, hands, discard: [...st.discard, card], scores, out, round: { closer, chinchon, added }, winner }
}

export function nextRound(st: State, rng: Rng): State {
  return dealRound(rng, { variant: st.variant, scores: st.scores, out: st.out, starter: nextActive(st, st.starter) })
}

// ── Machine players ───────────────────────────────────

/** Best discard: leaves the fewest unmatched points; ties throw the heavier card. */
function bestDiscard(st: State, hand: SCard[], avoid: (c: SCard) => boolean): { card: SCard; points: number } {
  let best: { card: SCard; points: number; penalty: number } | null = null
  for (const card of hand) {
    if (st.taken && sameCard(st.taken, card)) continue
    const points = arrange(without(hand, card)).points
    const penalty = avoid(card) ? 3 : 0
    if (!best || points + penalty < best.points + best.penalty || (points + penalty === best.points + best.penalty && cardPoints(card) > cardPoints(best.card)))
      best = { card, points, penalty }
  }
  return best!
}

export function aiDraw(st: State, difficulty: Difficulty, rng: Rng): State {
  const top = st.discard.at(-1)
  if (top && difficulty !== 'easy') {
    const hand = st.hands[st.turn]
    const now = arrange(hand).points
    const withTop = bestDiscard({ ...st, taken: top }, [...hand, top], () => false).points
    if (withTop <= now - 3 || isJoker(top)) return drawDiscard(st)!
  } else if (top && rng() < 0.25) return drawDiscard(st)!
  return drawStock(st) ?? drawDiscard(st)!
}

export function aiDiscard(st: State, difficulty: Difficulty, rng: Rng): State {
  const hand = st.hands[st.turn]
  if (difficulty === 'easy') {
    const loose = arrange(hand).loose.filter((c) => canDiscard(st, c))
    const pool = loose.length ? loose : hand.filter((c) => canDiscard(st, c))
    const card = pool[randomInt(rng, pool.length)]
    return canClose(st, card) ? close(st, card)! : discard(st, card)!
  }
  // The hard bot does not feed the next player what they have been picking up.
  const nextPicked = difficulty === 'hard' ? st.picked[nextActive(st, st.turn)] : []
  const helps = (c: SCard) =>
    nextPicked.some((k) => !isJoker(k) && (k.r === c.r || (k.s === c.s && Math.abs(pos(k.r) - pos(c.r)) === 1)))
  const { card, points } = bestDiscard(st, hand, helps)
  if (points <= CLOSE_LIMIT) return close(st, card)!
  return discard(st, card)!
}
