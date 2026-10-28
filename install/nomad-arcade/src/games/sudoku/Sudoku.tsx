import { useEffect } from 'react'
import { GameShell, Segmented, formatTime } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Difficulty, type Grid, PEERS, conflicts, generate, isSolved } from './logic'

type State = {
  difficulty: Difficulty
  puzzle: Grid
  solution: Grid
  grid: Grid
  /** Pencil marks per cell, as a bitmask (bit n set = note n). */
  notes: number[]
  selected: number
  notesMode: boolean
  showMistakes: boolean
  seconds: number
}

function fresh(difficulty: Difficulty, keep?: Pick<State, 'notesMode' | 'showMistakes'>): State {
  const { puzzle, solution } = generate(difficulty, Math.random)
  return {
    difficulty,
    puzzle,
    solution,
    grid: [...puzzle],
    notes: Array(81).fill(0),
    selected: puzzle.findIndex((v) => v === 0),
    notesMode: keep?.notesMode ?? false,
    showMistakes: keep?.showMistakes ?? true,
    seconds: 0,
  }
}

export default function Sudoku() {
  const { t } = useI18n()
  const [state, setState] = usePersistentState<State>('sudoku', () => fresh('easy'))
  const { grid, puzzle, solution, notes, selected, notesMode, showMistakes, difficulty, seconds } = state
  const solved = isSolved(grid, solution)
  const bad = showMistakes ? conflicts(grid) : new Set<number>()
  const wrong = showMistakes ? new Set(grid.flatMap((v, i) => (v && v !== solution[i] ? [i] : []))) : new Set<number>()

  // Clock runs while the puzzle is unsolved and the tab is visible.
  useEffect(() => {
    if (solved) return
    const id = setInterval(() => {
      if (!document.hidden) setState((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [solved, setState])

  const input = (n: number) =>
    setState((s) => {
      const i = s.selected
      if (i < 0 || s.puzzle[i] || isSolved(s.grid, s.solution)) return s
      if (s.notesMode && n) {
        const notes = [...s.notes]
        notes[i] ^= 1 << n
        return { ...s, notes }
      }
      const grid = [...s.grid]
      grid[i] = grid[i] === n ? 0 : n
      const notes = [...s.notes]
      notes[i] = 0
      // A placed digit clears that note from its row, column and box.
      if (grid[i]) for (const j of PEERS[i]) notes[j] &= ~(1 << n)
      return { ...s, grid, notes }
    })

  const move = (dr: number, dc: number) =>
    setState((s) => {
      const r = (Math.floor(s.selected / 9) + dr + 9) % 9
      const c = ((s.selected % 9) + dc + 9) % 9
      return { ...s, selected: r * 9 + c }
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[1-9]$/.test(e.key)) input(Number(e.key))
      else if (['Backspace', 'Delete', '0'].includes(e.key)) input(0)
      else if (e.key === 'ArrowUp') move(-1, 0)
      else if (e.key === 'ArrowDown') move(1, 0)
      else if (e.key === 'ArrowLeft') move(0, -1)
      else if (e.key === 'ArrowRight') move(0, 1)
      else if (e.key.toLowerCase() === 'n') setState((s) => ({ ...s, notesMode: !s.notesMode }))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sel = selected >= 0 ? selected : -1
  const selValue = sel >= 0 ? grid[sel] : 0

  return (
    <GameShell
      title={t('sudoku.name')}
      status={solved ? t('sudoku.solved') : `${t('common.time')}: ${formatTime(seconds)}`}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={difficulty}
            onChange={(d) => setState((s) => fresh(d, s))}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={showMistakes}
              onChange={(e) => setState((s) => ({ ...s, showMistakes: e.target.checked }))}
            />
            {t('sudoku.check')}
          </label>
          <button type="button" className="primary" onClick={() => setState((s) => fresh(s.difficulty, s))}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className={`sudoku-board ${solved ? 'solved' : ''}`} role="grid">
        {grid.map((v, i) => {
          const r = Math.floor(i / 9)
          const c = i % 9
          const related = sel >= 0 && (PEERS[sel].includes(i) || i === sel)
          const classes = [
            'sudoku-cell',
            puzzle[i] ? 'given' : '',
            i === sel ? 'selected' : related ? 'related' : '',
            v && v === selValue && i !== sel ? 'same' : '',
            bad.has(i) || wrong.has(i) ? 'error' : '',
            c % 3 === 2 && c < 8 ? 'box-right' : '',
            r % 3 === 2 && r < 8 ? 'box-bottom' : '',
          ]
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={classes.filter(Boolean).join(' ')}
              onClick={() => setState((s) => ({ ...s, selected: i }))}
              aria-label={`${t('sudoku.cell', { r: r + 1, c: c + 1 })}: ${v || ''}`}
            >
              {v ? (
                v
              ) : notes[i] ? (
                <span className="notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n}>{notes[i] & (1 << n) ? n : ''}</span>
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" onClick={() => input(n)} disabled={solved}>
            {n}
          </button>
        ))}
      </div>
      <div className="numpad-actions">
        <button type="button" onClick={() => input(0)} disabled={solved}>
          ⌫ {t('sudoku.erase')}
        </button>
        <button
          type="button"
          className={notesMode ? 'active' : ''}
          aria-pressed={notesMode}
          onClick={() => setState((s) => ({ ...s, notesMode: !s.notesMode }))}
        >
          ✎ {t('sudoku.notes')}
        </button>
      </div>
    </GameShell>
  )
}
