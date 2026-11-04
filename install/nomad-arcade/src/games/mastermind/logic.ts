import { type Rng, randomInt, shuffled } from '../../lib/rng'

export type Level = 'easy' | 'medium' | 'hard'

/** Colours, pegs per row, tries and whether a colour may repeat. */
export const LEVELS: Record<Level, { colours: number; pegs: number; tries: number; repeats: boolean }> = {
  easy: { colours: 6, pegs: 4, tries: 12, repeats: false },
  medium: { colours: 6, pegs: 4, tries: 10, repeats: true },
  hard: { colours: 8, pegs: 5, tries: 10, repeats: true },
}

export function secret(level: Level, rng: Rng): number[] {
  const { colours, pegs, repeats } = LEVELS[level]
  if (!repeats) return shuffled(Array.from({ length: colours }, (_, i) => i), rng).slice(0, pegs)
  return Array.from({ length: pegs }, () => randomInt(rng, colours))
}

/** Black: right colour in the right place. White: right colour, wrong place. */
export function score(guess: number[], code: number[]): { black: number; white: number } {
  let black = 0
  const g: Record<number, number> = {}
  const c: Record<number, number> = {}
  guess.forEach((v, i) => {
    if (v === code[i]) black++
    else {
      g[v] = (g[v] ?? 0) + 1
      c[code[i]] = (c[code[i]] ?? 0) + 1
    }
  })
  let white = 0
  for (const v in g) white += Math.min(g[v], c[v] ?? 0)
  return { black, white }
}

export const isComplete = (guess: (number | null)[]): guess is number[] => guess.every((v) => v !== null)
