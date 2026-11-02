import { seededRng } from '../../lib/rng'
import type { SCard } from '../../lib/spanish'
import { type State, act, aiAct, aiDiscards, isHumanTurn, lanceWinner, newGame, nextHand, pares, sena, swapCards, total } from './logic'

const c = (r: number, s = 0): SCard => ({ r, s })
const hand = (...rs: number[]) => rs.map((r, i) => c(r, i % 4))

test('8 reyes: threes are kings and twos are aces; 4 reyes keeps them apart', () => {
  expect(pares(hand(3, 12, 5, 6), 'ocho')).toEqual({ kind: 1, ranks: [12] })
  expect(pares(hand(3, 12, 5, 6), 'cuatro').kind).toBe(0)
  expect(total(hand(3, 12, 1, 7), 'ocho')).toBe(28)
  expect(total(hand(3, 12, 1, 7), 'cuatro')).toBe(21)
})

test('pares: pareja < medias < duples, four of a kind is duples', () => {
  expect(pares(hand(5, 5, 7, 1), 'cuatro').kind).toBe(1)
  expect(pares(hand(5, 5, 5, 1), 'cuatro').kind).toBe(2)
  expect(pares(hand(5, 5, 7, 7), 'cuatro')).toEqual({ kind: 3, ranks: [7, 5] })
  expect(pares(hand(4, 4, 4, 4), 'cuatro')).toEqual({ kind: 3, ranks: [4, 4] })
})

const withHands = (hands: SCard[][], mano = 0): State => ({ ...newGame(seededRng(1), 'cuatro', 'medium', mano), hands })

test('lance winners, with ties to the player closest to the mano', () => {
  const st = withHands([hand(12, 12, 4, 5), hand(12, 11, 7, 1), hand(1, 1, 2, 4), hand(12, 12, 4, 5)], 0)
  expect(lanceWinner(st, 'grande')).toBe(0) // tie with player 3: the mano wins
  expect(lanceWinner({ ...st, mano: 3 }, 'grande')).toBe(3)
  expect(lanceWinner(st, 'chica')).toBe(2)
  expect(lanceWinner(st, 'pares')).toBe(0)
  // Juego: 31 beats 32 beats 40 beats 37…
  const j = withHands([hand(12, 11, 10, 1), hand(12, 11, 10, 2), hand(12, 11, 10, 12), hand(12, 11, 10, 7)])
  expect(lanceWinner(j, 'juego')).toBe(0)
  expect(lanceWinner({ ...j, hands: [hand(4, 4, 4, 4), ...j.hands.slice(1)] }, 'juego')).toBe(1)
})

test('a refused first bet pays 1; a wanted one pays at the end', () => {
  let st = withHands([hand(12, 12, 12, 4), hand(4, 5, 6, 7), hand(4, 5, 6, 7), hand(4, 5, 6, 7)])
  st = act(st, { t: 'corto' })!
  expect(st.lances[0]).toBe('grande')
  st = act(st, { t: 'envido', n: 2 })!
  expect(st.speaker).toBe(1)
  st = act(st, { t: 'noquiero' })!
  expect(st.scores).toEqual([1, 0])
  expect(st.lances[0]).toBe('chica')
})

test('órdago wanted: the lance winner takes the game', () => {
  let st = withHands([hand(12, 12, 12, 4), hand(4, 5, 6, 7), hand(4, 5, 6, 7), hand(4, 5, 6, 7)])
  st = act(st, { t: 'corto' })!
  st = act(st, { t: 'ordago' })!
  st = act(st, { t: 'quiero' })!
  expect(st.phase).toBe('end')
  expect(st.winner).toBe(0)
})

test('pares is skipped as a bet when only one side has them, but still pays the bonus', () => {
  let st = withHands([hand(5, 5, 5, 1), hand(4, 6, 7, 1), hand(4, 6, 7, 2), hand(4, 6, 7, 10)])
  st = act(st, { t: 'corto' })!
  for (let i = 0; i < 20 && st.phase === 'lance'; i++) st = act(st, { t: 'paso' })!
  expect(st.phase).toBe('end')
  const p = st.breakdown!.find((b) => b.lance === 'pares')!
  expect(p).toEqual({ lance: 'pares', team: 0, points: 0, bonus: 2 })
})

test('mus by everyone leads to a discard, then back to talking', () => {
  let st = newGame(seededRng(2), 'ocho', 'medium')
  for (let i = 0; i < 4; i++) st = act(st, { t: 'mus' })!
  expect(st.phase).toBe('discard')
  expect(isHumanTurn(st)).toBe(true)
  const s2 = swapCards(st, [st.hands[0][0]], seededRng(3))!
  expect(s2.phase).toBe('mus')
  expect(s2.hands.every((h) => h.length === 4)).toBe(true)
  expect(new Set(s2.hands.flat().map((x) => `${x.r}-${x.s}`)).size).toBe(16)
})

test('bots keep kings and aces when they swap', () => {
  expect(aiDiscards(hand(12, 1, 5, 6), 'cuatro').map((x) => x.r)).toEqual([5, 6])
  expect(aiDiscards(hand(3, 2, 5, 6), 'ocho').map((x) => x.r)).toEqual([5, 6])
})

test('señas tell the partner the best thing in hand', () => {
  const st = withHands([hand(12, 11, 10, 1), hand(5, 5, 7, 7), hand(12, 12, 4, 6), hand(1, 1, 4, 6)])
  expect([0, 1, 2, 3].map((p) => sena(st, p))).toEqual(['treintayuna', 'duples', 'dosReyes', 'dosAses'])
})

test('bots play whole games to 40 in both variants', () => {
  for (const variant of ['ocho', 'cuatro'] as const) {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = seededRng(seed)
      let st = newGame(rng, variant, seed % 2 ? 'hard' : 'easy')
      for (let guard = 0; st.winner === null && guard < 5000; guard++) {
        if (st.phase === 'end') st = nextHand(st, rng)
        else if (st.phase === 'discard') st = swapCards(st, aiDiscards(st.hands[0], variant), rng)!
        else st = act(st, aiAct(st, rng))!
      }
      expect(st.winner).not.toBeNull()
      expect(Math.max(...st.scores)).toBeGreaterThanOrEqual(40)
    }
  }
})
