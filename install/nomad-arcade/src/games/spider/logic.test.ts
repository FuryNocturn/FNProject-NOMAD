import { seededRng } from '../../lib/rng'
import type { Card } from '../solitaire/logic'
import { type State, canDeal, deal, dealRow, isWon, move, runStart } from './logic'

const c = (r: number, s = 0, up = true): Card => ({ s, r, up })
const empty = (): State => ({ columns: Array.from({ length: 10 }, () => []), stock: [], done: 0, suits: 1, moves: 0, score: 500 })

test('deal: 54 cards on the table, 50 in the stock, bottom cards face up', () => {
  const st = deal(seededRng(1), 2)
  expect(st.columns.map((col) => col.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5])
  expect(st.stock).toHaveLength(50)
  expect(st.columns.every((col) => col[col.length - 1].up)).toBe(true)
  expect(new Set([...st.stock, ...st.columns.flat()].map((x) => x.s))).toEqual(new Set([0, 1]))
})

test('only same-suit runs move together; any suit goes one rank higher', () => {
  const st = empty()
  st.columns[0] = [c(9, 0), c(8, 1), c(7, 1)] // 8-7 hearts is a run; the 9 is another suit
  st.columns[1] = [c(9, 2)]
  expect(runStart(st.columns[0])).toBe(1)
  expect(move(st, 0, 0, 1)).toBeNull()
  const after = move(st, 0, 1, 1)!
  expect(after.columns[1].map((x) => x.r)).toEqual([9, 8, 7])
})

test('a full king-to-ace run of one suit is removed', () => {
  const st = empty()
  st.columns[0] = [c(5, 0, false), ...Array.from({ length: 12 }, (_, k) => c(13 - k))] // K..2
  st.columns[1] = [c(1)]
  const after = move(st, 1, 0, 0)!
  expect(after.done).toBe(1)
  expect(after.columns[0]).toEqual([c(5, 0, true)])
  expect(after.score).toBe(599)
})

test('dealing needs every column filled and gives each one card', () => {
  const st = deal(seededRng(2), 1)
  const next = dealRow(st)!
  expect(next.stock).toHaveLength(40)
  expect(next.columns.map((col) => col.length)).toEqual(st.columns.map((col) => col.length + 1))
  const gap = { ...st, columns: [[], ...st.columns.slice(1)] }
  expect(canDeal(gap)).toBe(false)
  expect(isWon({ ...st, done: 8 })).toBe(true)
})
