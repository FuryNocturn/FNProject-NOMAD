import { type Card, type State, autoPlay, maxRun, move, msDeal, newGame } from './logic'

const name = (c: Card) => 'A23456789TJQK'[c.r - 1] + 'SHDC'[c.s]

test('deal #1 matches the classic Windows deal', () => {
  const cols = msDeal(1)
  // First row of game #1: JD 2D 9H JC 5D 7H 7C 5H.
  expect(cols.map((c) => name(c[0]))).toEqual(['JD', '2D', '9H', 'JC', '5D', '7H', '7C', '5H'])
  expect(cols.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
  expect(new Set(cols.flat().map(name)).size).toBe(52)
})

test('run size depends on free cells and empty columns', () => {
  const st: State = { ...newGame(1), cells: [null, null, null, null], columns: [[], [], ...newGame(1).columns.slice(2)] }
  expect(maxRun(st, false)).toBe(20) // (4 + 1) x 2^2
  expect(maxRun(st, true)).toBe(10) // one empty column is the target
})

test('columns take alternating colours one rank lower; foundations build by suit', () => {
  const st: State = {
    columns: [[{ s: 0, r: 8, up: true }], [{ s: 1, r: 7, up: true }], [{ s: 3, r: 7, up: true }], [], [], [], [], []],
    cells: [{ s: 2, r: 1, up: true }, null, null, null],
    foundations: [[], [], [], []],
    deal: 0,
    moves: 0,
  }
  expect(move(st, { k: 'col', i: 1 }, { k: 'col', i: 0 })?.columns[0]).toHaveLength(2)
  expect(move(st, { k: 'col', i: 2 }, { k: 'col', i: 0 })).toBeNull()
  expect(move(st, { k: 'cell', i: 0 }, { k: 'found', i: 0 })?.foundations[0]).toEqual([{ s: 2, r: 1, up: true }])
})

test('auto-play sends aces and safe low cards up, but not cards still needed', () => {
  const st: State = {
    columns: [[{ s: 0, r: 1, up: true }], [{ s: 0, r: 2, up: true }], [{ s: 0, r: 3, up: true }], [], [], [], [], []],
    cells: [null, null, null, null],
    foundations: [[], [], [], []],
    deal: 0,
    moves: 0,
  }
  const after = autoPlay(st)
  // A and 2 of spades go up; the 3 waits until the red foundations reach 2.
  expect(after.foundations.flat().map((c) => c.r)).toEqual([1, 2])
  expect(after.columns[2]).toHaveLength(1)
})
