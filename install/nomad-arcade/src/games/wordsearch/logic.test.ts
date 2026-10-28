import { seededRng } from '../../lib/rng'
import { SETTINGS, findPlacement, generate, lineBetween, normalize } from './logic'
import { ALPHABET, THEMES } from './words'

test('normalize drops accents but keeps Ñ', () => {
  expect(normalize('Corazón')).toBe('CORAZON')
  expect(normalize('piña')).toBe('PIÑA')
})

test.each(['easy', 'medium', 'hard'] as const)('%s puzzles spell every placed word on the grid', (d) => {
  for (const [lang, themes] of Object.entries(THEMES) as [keyof typeof THEMES, Record<string, readonly string[]>][]) {
    for (const words of Object.values(themes)) {
      const p = generate(words, d, ALPHABET[lang], seededRng(words.length + d.length))
      expect(p.grid).toHaveLength(SETTINGS[d].size ** 2)
      expect(p.grid.every((ch) => ch.length === 1)).toBe(true)
      expect(p.placements.length).toBeGreaterThanOrEqual(SETTINGS[d].words - 1)
      for (const pl of p.placements) expect(pl.cells.map((c) => p.grid[c]).join('')).toBe(pl.word)
    }
  }
})

test('easy words only read forwards, across or down', () => {
  const p = generate(THEMES.es.animales, 'easy', ALPHABET.es, seededRng(9))
  for (const { cells } of p.placements) {
    const step = cells[1] - cells[0]
    expect([1, p.size]).toContain(step)
  }
})

test('a selected line matches a word in either direction', () => {
  const p = generate(THEMES.en.fruits, 'medium', ALPHABET.en, seededRng(4))
  const pl = p.placements[0]
  const first = pl.cells[0]
  const last = pl.cells[pl.cells.length - 1]
  expect(findPlacement(p, lineBetween(p.size, first, last)!)?.word).toBe(pl.word)
  expect(findPlacement(p, lineBetween(p.size, last, first)!)?.word).toBe(pl.word)
  expect(lineBetween(10, 0, 12)).toBeNull()
  expect(lineBetween(10, 0, 22)).toEqual([0, 11, 22])
})
