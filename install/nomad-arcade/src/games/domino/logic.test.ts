import { seededRng } from '../../lib/rng'
import { type State, type Tile, aiChoose, deal, ends, pass, play, playable, sidesFor } from './logic'

test('deal gives 7 different tiles to each player and the double six opens', () => {
  const st = deal(seededRng(1))
  expect(st.hands.flat()).toHaveLength(28)
  expect(new Set(st.hands.flat().map((t) => t.join())).size).toBe(28)
  expect(st.hands[st.turn].some((t) => t[0] === 6 && t[1] === 6)).toBe(true)
  expect(playable(st)).toEqual([[6, 6]])
})

test('tiles join matching ends, flipped when needed', () => {
  let st = deal(seededRng(2))
  const open = st.hands[st.turn].find((t) => t[0] === 6 && t[1] === 6)!
  st = play(st, open, 'right')!
  expect(ends(st.chain)).toEqual([6, 6])
  const s2: State = { ...st, hands: st.hands.map((h, p) => (p === st.turn ? [[2, 6] as Tile, ...h] : h)) }
  const tile = s2.hands[s2.turn][0]
  expect(sidesFor(s2, tile)).toEqual(['left'])
  const after = play(s2, tile, 'left')!
  expect(ends(after.chain)).toEqual([2, 6])
  expect(after.chain[0]).toEqual({ tile: [2, 6], flipped: false })
})

test('playing the last tile wins the round for the team, scoring the opponents\' points', () => {
  const st: State = {
    ...deal(seededRng(3)),
    hands: [[[1, 2]], [[6, 6], [5, 5]], [[0, 0]], [[3, 3]]],
    chain: [{ tile: [2, 2], flipped: false }],
    turn: 0,
    scores: [10, 10],
    nextStarter: 0,
  }
  const after = play(st, st.hands[0][0], 'left')!
  expect(after.round).toEqual({ winnerTeam: 0, points: 22 + 6, blocked: false })
  expect(after.scores).toEqual([38, 10])
})

test('passing needs no playable tile; four passes block and the lighter team wins', () => {
  const st: State = {
    ...deal(seededRng(4)),
    hands: [[[0, 1]], [[5, 5]], [[0, 2]], [[6, 6]]],
    chain: [{ tile: [4, 4], flipped: false }],
    turn: 0,
    scores: [0, 0],
    nextStarter: 1,
  }
  let s: State | null = st
  for (let i = 0; i < 4; i++) s = pass(s!)
  expect(s!.round).toEqual({ winnerTeam: 0, points: 22, blocked: true })
  expect(pass({ ...st, chain: [{ tile: [1, 1], flipped: false }] })).toBeNull()
})

test('four computer players finish a match to 100', () => {
  const rng = seededRng(5)
  let st = deal(rng)
  for (let guard = 0; guard < 5000 && st.matchWinner === null; guard++) {
    if (st.round) {
      st = deal(rng, st)
      continue
    }
    const choice = aiChoose(st)
    st = choice ? play(st, choice.tile, choice.side)! : pass(st)!
  }
  expect(st.matchWinner).not.toBeNull()
  expect(Math.max(...st.scores)).toBeGreaterThanOrEqual(100)
})
