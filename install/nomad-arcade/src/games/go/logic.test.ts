import { seededRng } from '../../lib/rng'
import { type Game, KOMI, N, PASS, PLAYOUTS, areaScore, deadStones, legal, newGame, play, think } from './logic'

const at = (r: number, c: number) => r * N + c

/** Board from rows of '.', 'x' (black) and 'o' (white). */
function setup(rows: string[], toMove: 1 | 2 = 1): Game {
  const board = rows.join('').split('').map((ch) => (ch === 'x' ? 1 : ch === 'o' ? 2 : 0))
  return { ...newGame(), board, toMove }
}

test('surrounded stones are captured', () => {
  const g = setup(['.x.......', 'xox......', '.........', '.........', '.........', '.........', '.........', '.........', '.........'])
  const after = play(g, at(2, 1))!
  expect(after.board[at(1, 1)]).toBe(0)
  expect(after.captures).toEqual([1, 0])
})

test('suicide is illegal unless it captures', () => {
  const g = setup(['.x.......', 'x........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 2)
  expect(legal(g, at(0, 0))).toBe(false)
  expect(play(g, at(0, 0))).toBeNull()
})

test('simple ko cannot be retaken at once', () => {
  const g = setup([
    '.xo......',
    'xo.o.....',
    '.xo......',
    '.........', '.........', '.........', '.........', '.........', '.........',
  ])
  // Black takes the white stone at (1,1) by playing (1,2).
  const taken = play(g, at(1, 2))!
  expect(taken.board[at(1, 1)]).toBe(0)
  expect(taken.ko).toBe(at(1, 1))
  expect(legal(taken, at(1, 1))).toBe(false)
  // After a move elsewhere by each side the ko can be taken back.
  const later = play(play(taken, at(8, 8))!, at(8, 0))!
  expect(legal(later, at(1, 1))).toBe(true)
})

test('two passes and area scoring with komi', () => {
  // Black owns the left five columns, white the right four.
  const rows = Array.from({ length: N }, () => '....xo...')
  const s = areaScore(setup(rows).board)
  expect(s.black).toBe(45)
  expect(s.white).toBe(36 + KOMI)
  const ended = play(play(newGame(), PASS)!, PASS)!
  expect(ended.passes).toBe(2)
})

test('the computer captures a group in atari', () => {
  // White stone at (4,4) with one liberty left at (5,4).
  const g = setup([
    '.........', '.........', '.........',
    '....x....',
    '...xox...',
    '.........',
    '.........', '.........', '.........',
  ])
  expect(think(g, 1500, seededRng(3)).move).toBe(at(5, 4))
})

test('a dead stone inside territory is recognised', () => {
  const g = setup([
    'xxxxxxxxx',
    'x.......x',
    'x...o...x',
    'x.......x',
    'xxxxxxxxx',
    'ooooooooo',
    '.........',
    '.........',
    '.........',
  ], 2)
  const dead = deadStones(g, seededRng(1), 200)
  expect(dead.has(at(2, 4))).toBe(true)
  expect(dead.has(at(0, 0))).toBe(false)
})

test('the hard level answers within a few seconds', () => {
  const t0 = performance.now()
  think(newGame(), PLAYOUTS.hard, seededRng(7))
  expect(performance.now() - t0).toBeLessThan(6000)
})
