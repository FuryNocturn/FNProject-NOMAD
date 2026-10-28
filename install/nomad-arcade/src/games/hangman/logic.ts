import { normalize } from '../wordsearch/logic'

/** Hangman. Accents count as the plain letter (Á is A); Ñ is its own letter. */
export const MAX_MISSES = 7
export type State = { word: string; guessed: string[]; theme: string }

export const newGame = (word: string, theme: string): State => ({ word: normalize(word), guessed: [], theme })

export const misses = (st: State) => st.guessed.filter((l) => !st.word.includes(l)).length

export function guess(st: State, letter: string): State {
  const l = normalize(letter)
  if (st.guessed.includes(l) || status(st) !== 'playing') return st
  return { ...st, guessed: [...st.guessed, l] }
}

/** The word with unknown letters as underscores; spaces and hyphens show as they are. */
export const masked = (st: State) =>
  [...st.word].map((ch) => (/[A-ZÑ]/.test(ch) && !st.guessed.includes(ch) ? '_' : ch)).join('')

export function status(st: State): 'playing' | 'won' | 'lost' {
  if (misses(st) >= MAX_MISSES) return 'lost'
  return masked(st).includes('_') ? 'playing' : 'won'
}
