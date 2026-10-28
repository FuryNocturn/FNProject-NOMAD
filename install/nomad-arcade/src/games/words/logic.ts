import { type Rng, randomInt, shuffled } from '../../lib/rng'

/**
 * Word Tiles: a crossword tile game against the computer on a 15x15 board
 * (our own premium layout and rules summary; no blank tiles). Words are checked
 * against a sorted word list, which also answers "is this a prefix?" by binary search.
 */
export const N = 15
export const CENTER = 7 * N + 7
export type Lang = 'es' | 'en'
export type Premium = 'DL' | 'TL' | 'DW' | 'TW' | null

/** Letter counts and values. Spanish has no digraph tiles here. */
export const LETTERS: Record<Lang, Record<string, [count: number, value: number]>> = {
  es: {
    A: [12, 1], E: [12, 1], O: [9, 1], I: [6, 1], S: [6, 1], N: [5, 1], R: [5, 1], U: [5, 1], L: [5, 1], T: [4, 1],
    D: [5, 2], G: [2, 2], C: [4, 3], B: [2, 3], M: [2, 3], P: [2, 3], H: [2, 4], F: [1, 4], V: [1, 4], Y: [1, 4],
    Q: [1, 5], J: [1, 8], Ñ: [1, 8], X: [1, 8], Z: [1, 10],
  },
  en: {
    A: [9, 1], B: [2, 3], C: [2, 3], D: [4, 2], E: [12, 1], F: [2, 4], G: [3, 2], H: [2, 4], I: [9, 1], J: [1, 8],
    K: [1, 5], L: [4, 1], M: [2, 3], N: [6, 1], O: [8, 1], P: [2, 3], Q: [1, 10], R: [6, 1], S: [4, 1], T: [6, 1],
    U: [4, 1], V: [2, 4], W: [2, 4], X: [1, 8], Y: [2, 4], Z: [1, 10],
  },
}

/** Premium squares of one quarter (row, col <= 7), mirrored to the other three. */
const QUARTER: [number, number, Premium][] = [
  [0, 0, 'TW'], [0, 7, 'TW'], [7, 0, 'TW'],
  [1, 5, 'DW'], [5, 1, 'DW'], [3, 3, 'DW'], [6, 6, 'DW'], [7, 7, 'DW'],
  [1, 1, 'TL'], [5, 5, 'TL'], [2, 6, 'TL'], [6, 2, 'TL'],
  [0, 4, 'DL'], [4, 0, 'DL'], [2, 2, 'DL'], [3, 7, 'DL'], [7, 3, 'DL'], [4, 6, 'DL'], [6, 4, 'DL'],
]
export const PREMIUMS: Premium[] = (() => {
  const p: Premium[] = Array(N * N).fill(null)
  for (const [r, c, kind] of QUARTER) for (const [rr, cc] of [[r, c], [r, N - 1 - c], [N - 1 - r, c], [N - 1 - r, N - 1 - c]]) p[rr * N + cc] = kind
  return p
})()

// ── Dictionary ────────────────────────────────────────

export class Dictionary {
  constructor(private readonly words: string[]) {}
  private lower(s: string) {
    let lo = 0
    let hi = this.words.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.words[mid] < s) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  has(w: string) {
    return this.words[this.lower(w)] === w
  }
  hasPrefix(p: string) {
    const w = this.words[this.lower(p)]
    return w !== undefined && w.startsWith(p)
  }
}

// ── Game state ────────────────────────────────────────

export type State = {
  lang: Lang
  board: string[] // '' = empty
  bag: string[]
  racks: [string[], string[]] // 0 = you, 1 = computer
  scores: [number, number]
  turn: 0 | 1
  scoreless: number // consecutive turns without points (game ends at 6)
  over: boolean
  last: { player: 0 | 1; words: string[]; points: number; kind: 'play' | 'swap' | 'pass' } | null
}
export type Placement = { cell: number; letter: string }
export type PlayResult = { ok: true; words: string[]; points: number } | { ok: false; reason: 'line' | 'gap' | 'center' | 'connect' | 'short' | 'word'; bad?: string[] }

export const value = (lang: Lang, letter: string) => LETTERS[lang][letter]?.[1] ?? 0

export function newGame(lang: Lang, rng: Rng): State {
  const bag = shuffled(Object.entries(LETTERS[lang]).flatMap(([l, [n]]) => Array<string>(n).fill(l)), rng)
  const racks: [string[], string[]] = [bag.splice(0, 7), bag.splice(0, 7)]
  return { lang, board: Array(N * N).fill(''), bag, racks, scores: [0, 0], turn: 0, scoreless: 0, over: false, last: null }
}

/** Checks a set of new tiles and scores every word it forms. */
export function evaluate(st: State, placed: Placement[], dict: Dictionary): PlayResult {
  if (!placed.length) return { ok: false, reason: 'short' }
  const board = [...st.board]
  for (const p of placed) {
    if (board[p.cell]) return { ok: false, reason: 'line' }
    board[p.cell] = p.letter
  }
  const rows = new Set(placed.map((p) => Math.floor(p.cell / N)))
  const cols = new Set(placed.map((p) => p.cell % N))
  if (rows.size > 1 && cols.size > 1) return { ok: false, reason: 'line' }
  // A single tile can form its word either way; pick the direction with a neighbour.
  const horizontal = rows.size === 1 && (cols.size > 1 || hasNeighbour(board, placed[0].cell, 1))
  const step = horizontal ? 1 : N
  const cells = placed.map((p) => p.cell).sort((a, b) => a - b)
  for (let c = cells[0]; c <= cells[cells.length - 1]; c += step) if (!board[c]) return { ok: false, reason: 'gap' }
  const first = st.board.every((x) => !x)
  if (first && !cells.includes(CENTER)) return { ok: false, reason: 'center' }
  if (!first && !placed.some((p) => touchesOld(st.board, p.cell))) return { ok: false, reason: 'connect' }

  const newCells = new Set(cells)
  const words: { word: string; cells: number[] }[] = []
  const main = wordAt(board, cells[0], step)
  if (main.word.length >= 2) words.push(main)
  for (const c of cells) {
    const cross = wordAt(board, c, step === 1 ? N : 1)
    if (cross.word.length >= 2) words.push(cross)
  }
  if (!words.length) return { ok: false, reason: 'short' }
  const bad = words.filter((w) => !dict.has(w.word)).map((w) => w.word)
  if (bad.length) return { ok: false, reason: 'word', bad }
  let points = 0
  for (const w of words) {
    let sum = 0
    let mult = 1
    for (const c of w.cells) {
      const v = value(st.lang, board[c])
      const prem = newCells.has(c) ? PREMIUMS[c] : null
      sum += v * (prem === 'DL' ? 2 : prem === 'TL' ? 3 : 1)
      mult *= prem === 'DW' ? 2 : prem === 'TW' ? 3 : 1
    }
    points += sum * mult
  }
  if (placed.length === 7) points += 50
  return { ok: true, words: words.map((w) => w.word), points }
}

const inLine = (a: number, b: number, step: number) => (step === 1 ? Math.floor(a / N) === Math.floor(b / N) : true)

function hasNeighbour(board: string[], cell: number, step: number) {
  return (cell - step >= 0 && inLine(cell, cell - step, step) && !!board[cell - step]) ||
    (cell + step < N * N && inLine(cell, cell + step, step) && !!board[cell + step])
}

function touchesOld(board: string[], cell: number) {
  const r = Math.floor(cell / N)
  const c = cell % N
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc])
}

/** The full word through `cell` in direction `step` (1 across, N down). */
function wordAt(board: string[], cell: number, step: number) {
  let start = cell
  while (start - step >= 0 && inLine(start, start - step, step) && board[start - step]) start -= step
  const cells: number[] = []
  for (let c = start; c < N * N && inLine(start, c, step) && board[c]; c += step) cells.push(c)
  return { word: cells.map((c) => board[c]).join(''), cells }
}

function refill(rack: string[], bag: string[]) {
  while (rack.length < 7 && bag.length) rack.push(bag.pop()!)
}

/** Final scores: each player loses what is left on their rack; whoever went out gains it. */
function finish(st: State): State {
  const left = st.racks.map((r) => r.reduce((s, l) => s + value(st.lang, l), 0))
  const scores: [number, number] = [st.scores[0] - left[0], st.scores[1] - left[1]]
  for (const p of [0, 1] as const) if (!st.racks[p].length) scores[p] += left[1 - p]
  return { ...st, scores, over: true }
}

export function applyPlay(st: State, placed: Placement[], dict: Dictionary): State | null {
  const res = evaluate(st, placed, dict)
  if (!res.ok) return null
  const p = st.turn
  const board = [...st.board]
  const rack = [...st.racks[p]]
  for (const pl of placed) {
    board[pl.cell] = pl.letter
    rack.splice(rack.indexOf(pl.letter), 1)
  }
  const bag = [...st.bag]
  refill(rack, bag)
  const racks: [string[], string[]] = p === 0 ? [rack, st.racks[1]] : [st.racks[0], rack]
  const scores: [number, number] = [...st.scores]
  scores[p] += res.points
  const next: State = { ...st, board, bag, racks, scores, turn: (1 - p) as 0 | 1, scoreless: 0, last: { player: p, words: res.words, points: res.points, kind: 'play' } }
  return !rack.length && !bag.length ? finish(next) : next
}

export function swap(st: State, letters: string[], rng: Rng): State | null {
  if (st.bag.length < 7 || !letters.length) return null
  const p = st.turn
  const rack = [...st.racks[p]]
  for (const l of letters) {
    const i = rack.indexOf(l)
    if (i < 0) return null
    rack.splice(i, 1)
  }
  const bag = shuffled([...st.bag, ...letters], rng)
  refill(rack, bag)
  return endScoreless({ ...st, bag, racks: p === 0 ? [rack, st.racks[1]] : [st.racks[0], rack], last: { player: p, words: [], points: 0, kind: 'swap' } })
}

export const pass = (st: State) => endScoreless({ ...st, last: { player: st.turn, words: [], points: 0, kind: 'pass' } })

function endScoreless(st: State): State {
  const next = { ...st, turn: (1 - st.turn) as 0 | 1, scoreless: st.scoreless + 1 }
  return next.scoreless >= 6 ? finish(next) : next
}

// ── Computer player ───────────────────────────────────

export type Candidate = { placed: Placement[]; points: number; words: string[] }

/**
 * Every legal play for the rack, found by extending words from each start
 * square while the letters so far are a prefix of some word.
 */
export function allMoves(st: State, rack: string[], dict: Dictionary, limit = 4000): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<string>()
  const first = st.board.every((x) => !x)
  for (const step of [1, N]) {
    for (let line = 0; line < N; line++) {
      for (let k = 0; k < N; k++) {
        const start = step === 1 ? line * N + k : k * N + line
        const prev = step === 1 ? (k > 0 ? start - 1 : -1) : k > 0 ? start - N : -1
        if (prev >= 0 && st.board[prev]) continue // a word cannot start right after a tile
        const extend = (pos: number, idx: number, word: string, left: string[], placed: Placement[]) => {
          if (out.length >= limit) return
          if (idx >= N) return
          const letter = st.board[pos]
          const tries = letter ? [letter] : [...new Set(left)]
          for (const l of tries) {
            const w = word + l
            if (!dict.hasPrefix(w)) continue
            const pl = letter ? placed : [...placed, { cell: pos, letter: l }]
            const rest = letter ? left : (() => { const r = [...left]; r.splice(r.indexOf(l), 1); return r })()
            const nextPos = pos + step
            const ends = idx + 1 >= N || !st.board[nextPos]
            if (ends && pl.length && w.length >= 2 && dict.has(w)) {
              const key = pl.map((p) => `${p.cell}${p.letter}`).sort().join()
              if (!seen.has(key)) {
                seen.add(key)
                const res = evaluate(st, pl, dict)
                if (res.ok) out.push({ placed: pl, points: res.points, words: res.words })
              }
            }
            if (idx + 1 < N && (rest.length || st.board[nextPos])) extend(nextPos, idx + 1, w, rest, pl)
          }
        }
        // On the first move only lines through the centre matter.
        if (first && line !== 7) continue
        extend(start, k, '', rack, [])
      }
    }
  }
  return out
}

export type Difficulty = 'easy' | 'medium' | 'hard'

/** Hard plays the best scoring move; medium a good one; easy a modest one. */
export function aiChoose(st: State, dict: Dictionary, difficulty: Difficulty, rng: Rng): Candidate | null {
  const moves = allMoves(st, st.racks[1], dict).sort((a, b) => b.points - a.points)
  if (!moves.length) return null
  if (difficulty === 'hard') return moves[0]
  const from = difficulty === 'medium' ? 0 : Math.floor(moves.length / 3)
  const to = difficulty === 'medium' ? Math.max(1, Math.ceil(moves.length / 4)) : moves.length
  return moves[from + randomInt(rng, Math.max(1, to - from))]
}
