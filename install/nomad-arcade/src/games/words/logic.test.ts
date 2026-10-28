import { seededRng } from '../../lib/rng'
import { CENTER, Dictionary, N, PREMIUMS, type State, aiChoose, allMoves, applyPlay, evaluate, newGame, pass } from './logic'

const dict = new Dictionary(['CASA', 'CASAS', 'CAS', 'SA', 'AS', 'OSO', 'SOL', 'LOS', 'ASA', 'OSA', 'COSA', 'ROSA'].sort())
const row = (r: number, c: number) => r * N + c
const withRack = (rack: string[]): State => ({ ...newGame('es', seededRng(1)), racks: [rack, ['O', 'S', 'A', 'L', 'R', 'E', 'E']] })

test('the dictionary answers words and prefixes', () => {
  expect(dict.has('CASA')).toBe(true)
  expect(dict.has('CAS')).toBe(true)
  expect(dict.has('CASO')).toBe(false)
  expect(dict.hasPrefix('CAS')).toBe(true)
  expect(dict.hasPrefix('CAX')).toBe(false)
})

test('the board is symmetric with a double word in the centre', () => {
  expect(PREMIUMS[CENTER]).toBe('DW')
  for (let i = 0; i < N * N; i++) expect(PREMIUMS[i]).toBe(PREMIUMS[N * N - 1 - i])
})

test('the first word must cross the centre and is scored with premiums', () => {
  const st = withRack(['C', 'A', 'S', 'A', 'E', 'E', 'E'])
  const off = evaluate(st, 'CASA'.split('').map((l, k) => ({ cell: row(0, 4 + k), letter: l })), dict)
  expect(off).toEqual({ ok: false, reason: 'center' })
  const res = evaluate(st, 'CASA'.split('').map((l, k) => ({ cell: row(7, 4 + k), letter: l })), dict)
  // C3 + A1 + S1 + A1 = 6, doubled by the centre square under the last A.
  expect(res).toMatchObject({ ok: true, points: 12 })
})

test('later words must connect, form real words in every direction and have no gaps', () => {
  let st = withRack(['C', 'A', 'S', 'A', 'O', 'O', 'L'])
  st = applyPlay(st, 'CASA'.split('').map((l, k) => ({ cell: row(7, 4 + k), letter: l })), dict)!
  st = { ...st, turn: 0, racks: [['O', 'O', 'L', 'S', 'S', 'R', 'E'], st.racks[1]] }
  expect(evaluate(st, [{ cell: row(2, 2), letter: 'O' }], dict)).toEqual({ ok: false, reason: 'connect' })
  // CASA + S = CASAS (the S goes right after it).
  const casas = evaluate(st, [{ cell: row(7, 8), letter: 'S' }], dict)
  expect(casas).toMatchObject({ ok: true, words: ['CASAS'] })
  // An O under the S of CASA spells "SO" downwards, which is not in the list.
  expect(evaluate(st, [{ cell: row(8, 6), letter: 'O' }], dict)).toMatchObject({ ok: false, reason: 'word' })
})

test('the computer finds legal plays and the hard level takes the best one', () => {
  const st = { ...newGame('es', seededRng(2)), turn: 1 as const, racks: [['E'], ['C', 'A', 'S', 'A', 'O', 'L', 'R']] as [string[], string[]] }
  const moves = allMoves(st, st.racks[1], dict)
  expect(moves.length).toBeGreaterThan(0)
  expect(moves.every((m) => m.placed.some((p) => p.cell === CENTER))).toBe(true)
  const best = aiChoose(st, dict, 'hard', seededRng(3))!
  expect(best.points).toBe(Math.max(...moves.map((m) => m.points)))
})

test('six scoreless turns in a row end the game', () => {
  let st = newGame('en', seededRng(4))
  for (let i = 0; i < 6; i++) st = pass(st)
  expect(st.over).toBe(true)
})
