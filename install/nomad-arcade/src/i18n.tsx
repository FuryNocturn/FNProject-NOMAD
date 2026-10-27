import { createContext, type ReactNode, useContext } from 'react'
import { usePersistentState } from './lib/storage'

const es = {
  'app.title': 'Arcade',
  'app.subtitle': 'Juegos para pasar el rato, sin conexión.',
  'app.back': 'Volver a los juegos',
  'app.language': 'Idioma',
  'common.newGame': 'Nueva partida',
  'common.difficulty': 'Dificultad',
  'common.easy': 'Fácil',
  'common.medium': 'Media',
  'common.hard': 'Difícil',
  'common.youWin': '¡Has ganado!',
  'common.youLose': 'Has perdido',
  'common.draw': 'Empate',
  'common.yourTurn': 'Tu turno',
  'common.thinking': 'Pensando…',
  'common.firstMove': 'Empieza',
  'common.you': 'Tú',
  'common.machine': 'Máquina',
  'common.score': 'Marcador',
  'common.wins': 'Victorias',
  'common.losses': 'Derrotas',
  'common.draws': 'Empates',
  'common.time': 'Tiempo',
  'tictactoe.name': 'Tres en raya',
  'tictactoe.blurb': 'Alinea tres antes que la máquina.',
  'connect4.name': 'Cuatro en raya',
  'connect4.blurb': 'Deja caer fichas y conecta cuatro.',
  'connect4.column': 'Columna {n}',
  'sudoku.name': 'Sudoku',
  'sudoku.blurb': 'Rellena la cuadrícula del 1 al 9.',
  'sudoku.notes': 'Notas',
  'sudoku.erase': 'Borrar',
  'sudoku.check': 'Marcar errores',
  'sudoku.solved': '¡Sudoku resuelto!',
  'sudoku.cell': 'Fila {r}, columna {c}',
  'minesweeper.name': 'Buscaminas',
  'minesweeper.blurb': 'Despeja el campo sin pisar una mina.',
  'minesweeper.size': 'Tamaño',
  'minesweeper.beginner': 'Principiante',
  'minesweeper.intermediate': 'Intermedio',
  'minesweeper.expert': 'Experto',
  'minesweeper.flagMode': 'Modo bandera',
  'minesweeper.help': 'Clic para abrir, clic derecho (o modo bandera) para marcar una mina.',
}

type Key = keyof typeof es

const en: Record<Key, string> = {
  'app.title': 'Arcade',
  'app.subtitle': 'Games to pass the time, offline.',
  'app.back': 'Back to games',
  'app.language': 'Language',
  'common.newGame': 'New game',
  'common.difficulty': 'Difficulty',
  'common.easy': 'Easy',
  'common.medium': 'Medium',
  'common.hard': 'Hard',
  'common.youWin': 'You win!',
  'common.youLose': 'You lose',
  'common.draw': 'Draw',
  'common.yourTurn': 'Your turn',
  'common.thinking': 'Thinking…',
  'common.firstMove': 'First move',
  'common.you': 'You',
  'common.machine': 'Computer',
  'common.score': 'Score',
  'common.wins': 'Wins',
  'common.losses': 'Losses',
  'common.draws': 'Draws',
  'common.time': 'Time',
  'tictactoe.name': 'Tic-tac-toe',
  'tictactoe.blurb': 'Get three in a row before the computer.',
  'connect4.name': 'Connect Four',
  'connect4.blurb': 'Drop discs and connect four.',
  'connect4.column': 'Column {n}',
  'sudoku.name': 'Sudoku',
  'sudoku.blurb': 'Fill the grid with 1 to 9.',
  'sudoku.notes': 'Notes',
  'sudoku.erase': 'Erase',
  'sudoku.check': 'Show mistakes',
  'sudoku.solved': 'Sudoku solved!',
  'sudoku.cell': 'Row {r}, column {c}',
  'minesweeper.name': 'Minesweeper',
  'minesweeper.blurb': 'Clear the field without hitting a mine.',
  'minesweeper.size': 'Size',
  'minesweeper.beginner': 'Beginner',
  'minesweeper.intermediate': 'Intermediate',
  'minesweeper.expert': 'Expert',
  'minesweeper.flagMode': 'Flag mode',
  'minesweeper.help': 'Click to open, right-click (or flag mode) to mark a mine.',
}

export const LANGUAGES = { es: 'Español', en: 'English' } as const
export type Lang = keyof typeof LANGUAGES
const DICTS: Record<Lang, Record<Key, string>> = { es, en }

export type T = (key: Key, vars?: Record<string, string | number>) => string

const detect = (): Lang => (navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en')

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T } | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePersistentState<Lang>('lang', detect)
  const dict = DICTS[lang] ?? en
  const t: T = (key, vars) =>
    (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, v) => String(vars?.[v] ?? ''))
  document.documentElement.lang = lang
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}
