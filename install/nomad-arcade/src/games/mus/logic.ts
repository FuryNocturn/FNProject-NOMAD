import { type Rng, randomInt, shuffled } from '../../lib/rng'
import { type SCard, sameCard, spanishDeck } from '../../lib/spanish'

/**
 * Mus for four: you (0) and your partner (2) against 1 and 3. Play goes 0, 1, 2, 3
 * from the mano, who moves round each hand. With "8 reyes" the threes count as
 * kings and the twos as aces; with "4 reyes" every card is what it says.
 *
 * Each hand: everyone says mus (swap cards) or cuts; then four lances in turn:
 * Grande (high cards), Chica (low cards), Pares and Juego (31 or more; Punto when
 * nobody has it). In each lance a side can pass, bet (envido), raise or go órdago
 * (the whole game); the other side wants it, refuses it (the bettors take what was
 * on the table, 1 for a first bet) or raises. Wanted bets, passed lances and the
 * pares and juego bonuses are counted when the cards are shown. First to 40 wins.
 * Ties go to the player closest to the mano.
 */
export type Variant = 'ocho' | 'cuatro'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Lance = 'grande' | 'chica' | 'pares' | 'juego' | 'punto'
export type Act =
  | { t: 'mus' }
  | { t: 'corto' }
  | { t: 'paso' }
  | { t: 'envido'; n: number }
  | { t: 'ordago' }
  | { t: 'quiero' }
  | { t: 'noquiero' }
export type Bet = { amount: number; prev: number; by: number; ordago: boolean }
export type LanceResult = {
  lance: Lance
  /** paso: everyone passed; quiero / noquiero: a bet was settled; single: only one side could play; none: nobody could. */
  kind: 'paso' | 'quiero' | 'noquiero' | 'single' | 'none'
  amount: number
  ordago: boolean
  team: number | null // the side that took a refused bet, or the only side in a 'single' lance
}
export type Score = { lance: Lance; team: number; points: number; bonus: number }
export type State = {
  variant: Variant
  difficulty: Difficulty
  hands: SCard[][]
  deck: SCard[]
  pile: SCard[]
  mano: number
  phase: 'mus' | 'discard' | 'lance' | 'end'
  speaker: number
  musCount: number
  /** Lances still to play this hand, current first. */
  lances: Lance[]
  order: number[] // players taking part in the current lance, from the mano
  spoken: number // how many in `order` have passed
  bet: Bet | null
  results: LanceResult[]
  /** What each player last said, for the table. */
  said: (Act | null)[]
  scores: [number, number]
  target: number
  breakdown: Score[] | null
  winner: number | null
}

export const team = (p: number) => p % 2
const HUMAN = 0
const dist = (p: number, mano: number) => (p - mano + 4) % 4
const fromMano = (mano: number) => [0, 1, 2, 3].map((i) => (mano + i) % 4)

// ── Card values ───────────────────────────────────────

export const rank = (c: SCard, v: Variant) => (v === 'ocho' ? (c.r === 3 ? 12 : c.r === 2 ? 1 : c.r) : c.r)
export const juegoValue = (c: SCard, v: Variant) => Math.min(10, rank(c, v))
export const total = (h: SCard[], v: Variant) => h.reduce((s, c) => s + juegoValue(c, v), 0)
export const hasJuego = (h: SCard[], v: Variant) => total(h, v) >= 31
const JUEGO_ORDER = [31, 32, 40, 37, 36, 35, 34, 33]

/** Pares: 0 none, 1 pareja, 2 medias, 3 duples; ranks of the pairs, high first. */
export function pares(h: SCard[], v: Variant): { kind: number; ranks: number[] } {
  const counts = new Map<number, number>()
  for (const c of h) counts.set(rank(c, v), (counts.get(rank(c, v)) ?? 0) + 1)
  const groups = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[0] - a[0])
  if (groups.some(([, n]) => n === 4)) return { kind: 3, ranks: [groups[0][0], groups[0][0]] }
  if (groups.length === 2) return { kind: 3, ranks: groups.map(([r]) => r) }
  if (groups.length === 1) return { kind: groups[0][1] === 3 ? 2 : 1, ranks: [groups[0][0]] }
  return { kind: 0, ranks: [] }
}

const lexi = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0)
  return 0
}

/** Positive when hand a beats hand b in the lance (before the mano tiebreak). */
function compare(lance: Lance, a: SCard[], b: SCard[], v: Variant): number {
  const ranks = (h: SCard[]) => h.map((c) => rank(c, v))
  switch (lance) {
    case 'grande':
      return lexi(ranks(a).sort((x, y) => y - x), ranks(b).sort((x, y) => y - x))
    case 'chica':
      return -lexi(ranks(a).sort((x, y) => x - y), ranks(b).sort((x, y) => x - y))
    case 'pares': {
      const pa = pares(a, v)
      const pb = pares(b, v)
      return pa.kind - pb.kind || lexi(pa.ranks, pb.ranks)
    }
    case 'juego':
      return JUEGO_ORDER.indexOf(total(b, v)) - JUEGO_ORDER.indexOf(total(a, v))
    case 'punto':
      return total(a, v) - total(b, v)
  }
}

export function eligible(st: Pick<State, 'hands' | 'variant'>, lance: Lance, p: number): boolean {
  if (lance === 'pares') return pares(st.hands[p], st.variant).kind > 0
  if (lance === 'juego') return hasJuego(st.hands[p], st.variant)
  return true
}

/** Best player of the lance among those taking part. */
export function lanceWinner(st: Pick<State, 'hands' | 'variant' | 'mano'>, lance: Lance): number {
  const players = fromMano(st.mano).filter((p) => eligible(st, lance, p))
  return players.reduce((best, p) => (compare(lance, st.hands[p], st.hands[best], st.variant) > 0 ? p : best))
}

/** Pares and juego bonuses for the winning side: each of its players with pares or juego. */
function bonus(st: State, lance: Lance, winTeam: number): number {
  return [0, 1, 2, 3]
    .filter((p) => team(p) === winTeam && eligible(st, lance, p))
    .reduce((s, p) => s + (lance === 'pares' ? pares(st.hands[p], st.variant).kind : total(st.hands[p], st.variant) === 31 ? 3 : 2), 0)
}

// ── Dealing and mus ───────────────────────────────────

export function newGame(rng: Rng, variant: Variant, difficulty: Difficulty, mano = 0): State {
  return deal(rng, { variant, difficulty, scores: [0, 0], target: 40, mano })
}

function deal(rng: Rng, base: Pick<State, 'variant' | 'difficulty' | 'scores' | 'target' | 'mano'>): State {
  const deck = spanishDeck(rng)
  const hands = [0, 1, 2, 3].map(() => deck.splice(0, 4))
  return {
    ...base, hands, deck, pile: [], phase: 'mus', speaker: base.mano, musCount: 0,
    lances: [], order: [], spoken: 0, bet: null, results: [], said: [null, null, null, null],
    breakdown: null, winner: null,
  }
}

export function nextHand(st: State, rng: Rng): State {
  return deal(rng, { ...st, mano: (st.mano + 1) % 4 })
}

/** Cards a player throws away when everyone wants mus: keep kings and aces, at least one goes. */
export function aiDiscards(hand: SCard[], v: Variant): SCard[] {
  const out = hand.filter((c) => rank(c, v) !== 12 && rank(c, v) !== 1)
  if (out.length) return out
  // All kings and aces: throw the lowest ace for kings, unless it would break a pair.
  return [hand.reduce((a, b) => (rank(b, v) < rank(a, v) ? b : a))]
}

/** Replace the chosen cards (each player in turn from the mano), reshuffling the thrown cards when the deck runs out. */
export function swapCards(st: State, humanDiscards: SCard[], rng: Rng): State | null {
  if (st.phase !== 'discard' || humanDiscards.length < 1 || humanDiscards.length > 4) return null
  let deck = [...st.deck]
  const pile = [...st.pile]
  const hands = st.hands.map((h) => [...h])
  for (const p of fromMano(st.mano)) {
    const throwAway = p === HUMAN ? humanDiscards : aiDiscards(hands[p], st.variant)
    if (!throwAway.every((c) => hands[p].some((h) => sameCard(h, c)))) return null
    hands[p] = hands[p].filter((h) => !throwAway.some((c) => sameCard(c, h)))
    pile.push(...throwAway)
    while (hands[p].length < 4) {
      if (!deck.length) deck = shuffled(pile.splice(0), rng)
      hands[p].push(deck.pop()!)
    }
  }
  return { ...st, hands, deck, pile, phase: 'mus', speaker: st.mano, musCount: 0, said: [null, null, null, null] }
}

// ── Lances ────────────────────────────────────────────

function startLances(st: State): State {
  const juego = [0, 1, 2, 3].some((p) => hasJuego(st.hands[p], st.variant))
  return openLance({ ...st, phase: 'lance', lances: ['grande', 'chica', 'pares', juego ? 'juego' : 'punto'], results: [] })
}

/** Set up the current lance, or skip it when fewer than both sides can play. */
function openLance(st: State): State {
  const [lance] = st.lances
  if (!lance) return finish(st)
  const order = fromMano(st.mano).filter((p) => eligible(st, lance, p))
  const teams = new Set(order.map(team))
  const said = [null, null, null, null]
  if (teams.size < 2) {
    const result: LanceResult = { lance, kind: order.length ? 'single' : 'none', amount: 0, ordago: false, team: order.length ? team(order[0]) : null }
    return openLance({ ...st, lances: st.lances.slice(1), results: [...st.results, result], said })
  }
  return { ...st, order, spoken: 0, bet: null, speaker: order[0], said }
}

/** Who answers for a side: you when you are in the lance, else the side's first player in it. */
function responder(st: State, side: number): number {
  if (side === team(HUMAN) && st.order.includes(HUMAN)) return HUMAN
  return st.order.find((p) => team(p) === side)!
}

function closeLance(st: State, result: LanceResult): State {
  let next: State = { ...st, lances: st.lances.slice(1), results: [...st.results, result], bet: null }
  if (result.kind === 'noquiero') {
    const scores = [...st.scores] as State['scores']
    scores[result.team!] += result.amount
    next = { ...next, scores }
    if (scores[result.team!] >= st.target) return finish({ ...next, lances: [] }, result.team!)
  }
  if (result.kind === 'quiero' && result.ordago) return finish({ ...next, lances: [] })
  return openLance(next)
}

/** Legal acts for the player to speak. */
export function options(st: State): Act['t'][] {
  if (st.phase === 'mus') return ['mus', 'corto']
  if (st.phase !== 'lance') return []
  if (!st.bet) return ['paso', 'envido', 'ordago']
  if (st.bet.ordago) return ['quiero', 'noquiero']
  return ['quiero', 'noquiero', 'envido', 'ordago']
}

export function act(st: State, a: Act): State | null {
  if (!options(st).includes(a.t) || st.winner !== null) return null
  const said = st.said.map((s, p) => (p === st.speaker ? a : s))
  const s: State = { ...st, said }

  if (st.phase === 'mus') {
    if (a.t === 'corto') return startLances(s)
    const musCount = st.musCount + 1
    return musCount === 4 ? { ...s, phase: 'discard', musCount } : { ...s, musCount, speaker: (st.speaker + 1) % 4 }
  }

  const [lance] = st.lances
  if (!st.bet) {
    if (a.t === 'paso') {
      const spoken = st.spoken + 1
      if (spoken === st.order.length) return closeLance(s, { lance, kind: 'paso', amount: 1, ordago: false, team: null })
      return { ...s, spoken, speaker: st.order[spoken] }
    }
    const bet: Bet = { amount: a.t === 'ordago' ? 0 : Math.max(2, (a as { n: number }).n), prev: 1, by: team(st.speaker), ordago: a.t === 'ordago' }
    return { ...s, bet, speaker: responder(st, 1 - bet.by) }
  }

  const bet = st.bet
  switch (a.t) {
    case 'quiero':
      return closeLance(s, { lance, kind: 'quiero', amount: bet.amount, ordago: bet.ordago, team: null })
    case 'noquiero':
      return closeLance(s, { lance, kind: 'noquiero', amount: bet.prev, ordago: false, team: bet.by })
    case 'envido':
    case 'ordago': {
      const raised: Bet = {
        amount: a.t === 'ordago' ? bet.amount : bet.amount + Math.max(2, a.n),
        prev: bet.amount,
        by: team(st.speaker),
        ordago: a.t === 'ordago',
      }
      return { ...s, bet: raised, speaker: responder(st, 1 - raised.by) }
    }
  }
  return null
}

/** Show the cards and count every lance in order, stopping as soon as a side reaches the target. */
function finish(st: State, wonBy: number | null = null): State {
  if (wonBy !== null) return { ...st, phase: 'end', breakdown: [], winner: wonBy }
  const scores = [...st.scores] as State['scores']
  const breakdown: Score[] = []
  let winner: number | null = null
  for (const r of st.results) {
    if (winner !== null || r.kind === 'none') continue
    const w = r.kind === 'single' ? r.team! : team(lanceWinner(st, r.lance))
    if (r.ordago && r.kind === 'quiero') {
      breakdown.push({ lance: r.lance, team: w, points: st.target - scores[w], bonus: 0 })
      scores[w] = st.target
      winner = w
      continue
    }
    const won = r.kind === 'quiero' ? r.amount : r.kind === 'paso' ? 1 : 0
    // Grande and chica in paso pay 1; pares and juego pay their bonuses whatever happened to the bet.
    const points = r.lance === 'pares' || r.lance === 'juego' ? (r.kind === 'quiero' ? r.amount : 0) : r.kind === 'noquiero' ? 0 : won
    const extra = r.lance === 'pares' || r.lance === 'juego' ? bonus(st, r.lance, w) : r.lance === 'punto' && r.kind === 'quiero' ? 1 : 0
    if (points + extra === 0) continue
    breakdown.push({ lance: r.lance, team: w, points, bonus: extra })
    scores[w] += points + extra
    if (scores[w] >= st.target) winner = w
  }
  return { ...st, phase: 'end', scores, breakdown, winner, lances: [] }
}

// ── Machine players ───────────────────────────────────

/** How good this hand is for the lance, 0..1, from the player's own cards. */
export function strength(st: State, p: number, lance: Lance): number {
  const h = st.hands[p]
  const v = st.variant
  const rs = h.map((c) => rank(c, v))
  const near = (3 - dist(p, st.mano)) * 0.03 // the mano wins ties
  switch (lance) {
    case 'grande':
      return Math.min(1, rs.filter((r) => r === 12).length * 0.28 + (Math.max(...rs) >= 11 ? 0.08 : 0) + near)
    case 'chica':
      return Math.min(1, rs.filter((r) => r === 1).length * 0.28 + (Math.min(...rs) <= 2 ? 0.08 : 0) + near)
    case 'pares': {
      const pr = pares(h, v)
      return Math.min(1, [0, 0.35, 0.6, 0.85][pr.kind] + (pr.ranks[0] ?? 0) / 100 + near)
    }
    case 'juego': {
      const i = JUEGO_ORDER.indexOf(total(h, v))
      return i < 0 ? 0 : Math.min(1, [0.92, 0.72, 0.6, 0.45, 0.4, 0.36, 0.33, 0.3][i] + near)
    }
    case 'punto':
      return Math.min(1, (total(h, v) - 15) / 16 + near)
  }
}

/** A partner's signal (seña), from the hand: the best thing worth telling. */
export function sena(st: State, p: number): 'treintayuna' | 'duples' | 'medias' | 'dosReyes' | 'dosAses' | 'nada' {
  const v = st.variant
  const h = st.hands[p]
  if (total(h, v) === 31) return 'treintayuna'
  const pr = pares(h, v).kind
  if (pr === 3) return 'duples'
  if (pr === 2) return 'medias'
  if (h.filter((c) => rank(c, v) === 12).length >= 2) return 'dosReyes'
  if (h.filter((c) => rank(c, v) === 1).length >= 2) return 'dosAses'
  return 'nada'
}

export function aiAct(st: State, rng: Rng): Act {
  const p = st.speaker
  const easy = st.difficulty === 'easy'
  const v = st.variant
  if (st.phase === 'mus') {
    const h = st.hands[p]
    const good = pares(h, v).kind >= 1 || hasJuego(h, v) || h.filter((c) => rank(c, v) === 12).length >= 2
    if (easy) return rng() < 0.5 ? { t: 'mus' } : { t: 'corto' }
    return good ? { t: 'corto' } : { t: 'mus' }
  }
  const [lance] = st.lances
  let s = strength(st, p, lance)
  // The partner's seña counts for the side when it is about this lance.
  const partner = (p + 2) % 4
  if (st.order.includes(partner)) s = Math.max(s, strength(st, partner, lance) * (st.difficulty === 'hard' ? 0.9 : 0.6))
  const bluff = st.difficulty === 'hard' && rng() < 0.08 ? 0.25 : 0
  if (easy) s = s * 0.6 + rng() * 0.4

  if (!st.bet) {
    if (s >= 0.97) return { t: 'ordago' }
    if (s + bluff >= 0.68) return { t: 'envido', n: s >= 0.85 ? 5 : 2 }
    return { t: 'paso' }
  }
  if (st.bet.ordago) return s >= 0.85 ? { t: 'quiero' } : { t: 'noquiero' }
  const cost = st.bet.amount
  if (s >= 0.95 && cost >= 4) return { t: 'ordago' }
  if (s + bluff >= 0.85 && cost < 10) return { t: 'envido', n: 2 }
  return s >= 0.5 + Math.min(0.2, cost / 50) ? { t: 'quiero' } : { t: 'noquiero' }
}

export const isHumanTurn = (st: State) => st.winner === null && (st.phase === 'discard' || ((st.phase === 'mus' || st.phase === 'lance') && st.speaker === HUMAN))

/** Pick a random card to throw for tests and simple clients. */
export const randomDiscard = (h: SCard[], rng: Rng) => [h[randomInt(rng, h.length)]]
