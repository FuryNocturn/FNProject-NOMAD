import { type Rng, shuffled } from '../../lib/rng'

export type Size = 'beginner' | 'intermediate' | 'expert'
export const SIZES: Record<Size, { rows: number; cols: number; mines: number }> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
}

export type Cell = { mine: boolean; adjacent: number; open: boolean; flagged: boolean }
export type Status = 'ready' | 'playing' | 'won' | 'lost'
export type Game = {
  rows: number
  cols: number
  mines: number
  cells: Cell[]
  status: Status
  /** Index of the mine that went off, for highlighting. */
  exploded: number | null
}

export function newGame(size: Size): Game {
  const { rows, cols, mines } = SIZES[size]
  const cells = Array.from({ length: rows * cols }, () => ({
    mine: false,
    adjacent: 0,
    open: false,
    flagged: false,
  }))
  return { rows, cols, mines, cells, status: 'ready', exploded: null }
}

export function neighbours(g: Pick<Game, 'rows' | 'cols'>, i: number): number[] {
  const r = Math.floor(i / g.cols)
  const c = i % g.cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < g.rows && nc >= 0 && nc < g.cols) out.push(nr * g.cols + nc)
    }
  return out
}

/**
 * Mines are laid on the first click, away from the clicked cell and its
 * neighbours, so the first click always opens an area.
 */
export function layMines(g: Game, firstClick: number, rng: Rng): Game {
  const safe = new Set([firstClick, ...neighbours(g, firstClick)])
  const spots = shuffled(
    g.cells.map((_, i) => i).filter((i) => !safe.has(i)),
    rng
  ).slice(0, g.mines)
  const cells = g.cells.map((c) => ({ ...c, mine: false }))
  for (const i of spots) cells[i].mine = true
  cells.forEach((c, i) => (c.adjacent = neighbours(g, i).filter((j) => cells[j].mine).length))
  return { ...g, cells, status: 'playing' }
}

function finish(g: Game): Game {
  const won = g.cells.every((c) => c.mine || c.open)
  if (!won) return g
  // Flag the remaining mines on a win, as classic Minesweeper does.
  return { ...g, status: 'won', cells: g.cells.map((c) => (c.mine ? { ...c, flagged: true } : c)) }
}

/** Opens a cell; zeros flood-fill outward. Opening a mine loses and reveals every mine. */
export function reveal(g: Game, i: number, rng: Rng): Game {
  if (g.status === 'won' || g.status === 'lost') return g
  if (g.status === 'ready') g = layMines(g, i, rng)
  if (g.cells[i].open || g.cells[i].flagged) return g
  const cells = g.cells.map((c) => ({ ...c }))
  if (cells[i].mine) {
    for (const c of cells) if (c.mine) c.open = true
    return { ...g, cells, status: 'lost', exploded: i }
  }
  const stack = [i]
  while (stack.length) {
    const j = stack.pop()!
    const c = cells[j]
    if (c.open || c.flagged) continue
    c.open = true
    if (c.adjacent === 0) stack.push(...neighbours(g, j))
  }
  return finish({ ...g, cells })
}

export function toggleFlag(g: Game, i: number): Game {
  if (g.status !== 'playing' || g.cells[i].open) return g
  const cells = [...g.cells]
  cells[i] = { ...cells[i], flagged: !cells[i].flagged }
  return { ...g, cells }
}

/**
 * Clicking an open number whose flags already match it opens all its other
 * neighbours (a wrong flag means hitting a mine, as in the original).
 */
export function chord(g: Game, i: number, rng: Rng): Game {
  const c = g.cells[i]
  if (g.status !== 'playing' || !c.open || c.adjacent === 0) return g
  const around = neighbours(g, i)
  if (around.filter((j) => g.cells[j].flagged).length !== c.adjacent) return g
  for (const j of around) g = reveal(g, j, rng)
  return g
}

export const flagsLeft = (g: Game) => g.mines - g.cells.filter((c) => c.flagged).length
