import { GOAL, LAST_TRACK, trackNumber } from './logic'

/**
 * Geometry of a 19x19 cross-shaped board: arms 3 cells wide and 8 long
 * around a 3x3 goal. Cells are [row, col].
 */
export type Cell = [number, number]

/** The 68 track cells in route order (index 0 is the cell before square 9). */
export const LOOP: Cell[] = (() => {
  const out: Cell[] = []
  for (let r = 7; r >= 0; r--) out.push([r, 8]) // top arm, left column, going up
  out.push([0, 9])
  for (let r = 0; r <= 7; r++) out.push([r, 10])
  for (let c = 11; c <= 18; c++) out.push([8, c]) // right arm
  out.push([9, 18])
  for (let c = 18; c >= 11; c--) out.push([10, c])
  for (let r = 11; r <= 18; r++) out.push([r, 10]) // bottom arm
  out.push([18, 9])
  for (let r = 18; r >= 11; r--) out.push([r, 8])
  for (let c = 7; c >= 0; c--) out.push([10, c]) // left arm
  out.push([9, 0])
  for (let c = 0; c <= 7; c++) out.push([8, c])
  return out
})()

/** Cell of track square number 1..68. */
export const trackCell = (num: number): Cell => LOOP[(num - 9 + 68) % 68]

/** Home column cells, outermost first, per player (yellow, blue, red, green). */
export const HOME: Cell[][] = [
  [1, 2, 3, 4, 5, 6, 7].map((c) => [9, c] as Cell),
  [1, 2, 3, 4, 5, 6, 7].map((r) => [r, 9] as Cell),
  [17, 16, 15, 14, 13, 12, 11].map((c) => [9, c] as Cell),
  [17, 16, 15, 14, 13, 12, 11].map((r) => [r, 9] as Cell),
]

/** Where each player's finished pieces gather in the centre. */
export const GOAL_CELL: Cell[] = [[9, 8], [8, 9], [9, 10], [10, 9]]

/** Corner base (top-left cell of an 8x8 square) per player. */
export const BASE: Cell[] = [[0, 0], [0, 11], [11, 11], [11, 0]]

export const COLORS = ['#e8b923', '#2f6db3', '#d63b30', '#2c8a3a']

/** Board cell (with fractional offsets for pieces at home) for a piece position. */
export function pieceCell(player: number, piece: number, pos: number): Cell {
  if (pos < 0) {
    const [r, c] = BASE[player]
    return [r + 2.2 + Math.floor(piece / 2) * 2.6, c + 2.2 + (piece % 2) * 2.6]
  }
  if (pos <= LAST_TRACK) return trackCell(trackNumber(player, pos))
  if (pos === GOAL) return GOAL_CELL[player]
  return HOME[player][pos - LAST_TRACK - 1]
}
