import { type Rng, randomInt, shuffled } from '../../lib/rng'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Placement = { word: string; cells: number[] }
export type Puzzle = { size: number; grid: string[]; placements: Placement[] }

/** [dRow, dCol]. Easy reads left-to-right and top-down; medium adds diagonals; hard also backwards. */
const DIRECTIONS: Record<Difficulty, [number, number][]> = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [-1, 1]],
  hard: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
}

export const SETTINGS: Record<Difficulty, { size: number; words: number }> = {
  easy: { size: 10, words: 8 },
  medium: { size: 12, words: 10 },
  hard: { size: 14, words: 12 },
}

/** Uppercase without accents, keeping Ñ (a different letter in Spanish). */
export const normalize = (w: string) =>
  w
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ')

function tryPlace(grid: string[], size: number, word: string, dirs: [number, number][], rng: Rng): number[] | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    const [dr, dc] = dirs[randomInt(rng, dirs.length)]
    const r0 = randomInt(rng, size)
    const c0 = randomInt(rng, size)
    const cells: number[] = []
    let ok = true
    for (let k = 0; k < word.length && ok; k++) {
      const r = r0 + dr * k
      const c = c0 + dc * k
      if (r < 0 || r >= size || c < 0 || c >= size) ok = false
      else if (grid[r * size + c] && grid[r * size + c] !== word[k]) ok = false
      else cells.push(r * size + c)
    }
    if (ok) return cells
  }
  return null
}

/**
 * Places up to the difficulty's word count (longest first, crossings allowed
 * when letters match), then fills the rest with random letters.
 */
export function generate(words: readonly string[], difficulty: Difficulty, alphabet: string, rng: Rng): Puzzle {
  const { size, words: wanted } = SETTINGS[difficulty]
  const pool = shuffled(words.map(normalize).filter((w) => w.length <= size), rng)
    .slice(0, wanted)
    .sort((a, b) => b.length - a.length)
  const grid: string[] = Array(size * size).fill('')
  const placements: Placement[] = []
  for (const word of pool) {
    const cells = tryPlace(grid, size, word, DIRECTIONS[difficulty], rng)
    if (!cells) continue
    cells.forEach((cell, k) => (grid[cell] = word[k]))
    placements.push({ word, cells })
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = alphabet[randomInt(rng, alphabet.length)]
  return { size, grid, placements }
}

/** Cells on the straight line from `a` to `b` (row, column or diagonal), or null if not aligned. */
export function lineBetween(size: number, a: number, b: number): number[] | null {
  const [r1, c1, r2, c2] = [Math.floor(a / size), a % size, Math.floor(b / size), b % size]
  const dr = Math.sign(r2 - r1)
  const dc = Math.sign(c2 - c1)
  const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1))
  if (r1 !== r2 && c1 !== c2 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return null
  return Array.from({ length: len + 1 }, (_, k) => (r1 + dr * k) * size + (c1 + dc * k))
}

/** The placement a selected line spells, in either direction. */
export function findPlacement(puzzle: Puzzle, cells: number[]): Placement | undefined {
  const key = cells.join(',')
  const rev = [...cells].reverse().join(',')
  return puzzle.placements.find((p) => {
    const k = p.cells.join(',')
    return k === key || k === rev
  })
}
