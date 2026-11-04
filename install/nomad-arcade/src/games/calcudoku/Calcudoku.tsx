import { useEffect } from 'react'
import { GameShell, Segmented, formatTime } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Puzzle, generate, isSolved, mistakes } from './logic'

type Size = '4' | '5' | '6'
type State = { size: Size; puzzle: Puzzle; grid: number[]; selected: number; seconds: number; check: boolean; solvedCount: number }

const fresh = (size: Size, s?: Partial<State>): State => {
  const puzzle = generate(Number(size), Math.random)
  return { size, puzzle, grid: Array(puzzle.n * puzzle.n).fill(0), selected: 0, seconds: 0, check: false, solvedCount: 0, ...s }
}

export default function Calcudoku() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('calcudoku', () => fresh('4'))
  const { puzzle, grid, selected } = st
  const n = puzzle.n
  const done = isSolved(puzzle, grid)
  const bad = st.check ? mistakes(puzzle, grid) : new Set<number>()

  const cageOf = new Array(n * n)
  puzzle.cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)))

  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      if (!document.hidden) setSt((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [done, setSt])

  const input = (v: number) =>
    setSt((s) => {
      if (isSolved(s.puzzle, s.grid)) return s
      const g = [...s.grid]
      g[s.selected] = g[s.selected] === v ? 0 : v
      return { ...s, grid: g, solvedCount: s.solvedCount + (isSolved(s.puzzle, g) ? 1 : 0) }
    })

  const move = (dr: number, dc: number) =>
    setSt((s) => {
      const m = s.puzzle.n
      const r = (Math.floor(s.selected / m) + dr + m) % m
      const c = ((s.selected % m) + dc + m) % m
      return { ...s, selected: r * m + c }
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return
      const d = Number(e.key)
      if (d >= 1 && d <= n) input(d)
      else if (['Backspace', 'Delete', '0'].includes(e.key)) input(0)
      else if (e.key === 'ArrowUp') move(-1, 0)
      else if (e.key === 'ArrowDown') move(1, 0)
      else if (e.key === 'ArrowLeft') move(0, -1)
      else if (e.key === 'ArrowRight') move(0, 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const border = (i: number, j: number) => (j < 0 || j >= n * n || cageOf[i] !== cageOf[j] ? 'thick' : '')

  return (
    <GameShell
      title={t('calcudoku.name')}
      status={done ? t('calcudoku.solved', { time: formatTime(st.seconds) }) : `${t('common.time')}: ${formatTime(st.seconds)}`}
      controls={
        <>
          <Segmented
            label={t('common.size')}
            value={st.size}
            onChange={(size) => setSt((s) => fresh(size, { check: s.check, solvedCount: s.solvedCount }))}
            options={(['4', '5', '6'] as Size[]).map((v) => ({ value: v, label: `${v}×${v}` }))}
          />
          <label className="toggle">
            <input type="checkbox" checked={st.check} onChange={(e) => setSt({ ...st, check: e.target.checked })} />
            {t('sudoku.check')}
          </label>
          <button type="button" className="primary" onClick={() => setSt((s) => fresh(s.size, { check: s.check, solvedCount: s.solvedCount }))}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('calcudoku.help', { n })}</p>
      <div className={`cd-board ${done ? 'solved' : ''}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} role="grid">
        {grid.map((v, i) => {
          const r = Math.floor(i / n)
          const c = i % n
          const cage = puzzle.cages[cageOf[i]]
          const cls = [
            'cd-cell',
            `t-${border(i, r > 0 ? i - n : -1)}`,
            `l-${border(i, c > 0 ? i - 1 : -1)}`,
            r === n - 1 ? 'b-thick' : '',
            c === n - 1 ? 'r-thick' : '',
            i === selected ? 'selected' : '',
            bad.has(i) ? 'bad' : '',
          ].join(' ')
          return (
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => setSt({ ...st, selected: i })}
              aria-label={t('sudoku.cell', { r: r + 1, c: c + 1 })}
            >
              {cage.cells[0] === i && (
                <span className="cd-clue">
                  {cage.target}
                  {cage.op}
                </span>
              )}
              <span className="cd-value">{v || ''}</span>
            </button>
          )
        })}
      </div>
      <div className="numpad" style={{ gridTemplateColumns: `repeat(${n + 1}, 1fr)` }}>
        {Array.from({ length: n }, (_, k) => (
          <button key={k} type="button" onClick={() => input(k + 1)}>
            {k + 1}
          </button>
        ))}
        <button type="button" onClick={() => input(0)}>
          {t('sudoku.erase')}
        </button>
      </div>
    </GameShell>
  )
}
