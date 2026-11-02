import { useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Cell, type Puzzle, generate, isSolved } from './logic'

type Size = '5' | '10' | '15'
type State = { puzzle: Puzzle; cells: Cell[]; size: Size; solved: number }

const fresh = (size: Size, solved = 0): State => {
  const puzzle = generate(Number(size), Math.random)
  return { puzzle, cells: Array(puzzle.size * puzzle.size).fill(0), size, solved }
}

export default function Nonogram() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('nonogram', () => fresh('10'))
  const [mode, setMode] = useState<'fill' | 'cross'>('fill')
  const { puzzle, cells } = st
  const n = puzzle.size
  const done = isSolved(puzzle, cells)

  // Built on the latest state, so quick successive clicks all count.
  const mark = (i: number, as: 'fill' | 'cross') =>
    setSt((s) => {
      if (isSolved(s.puzzle, s.cells)) return s
      const want: Cell = as === 'fill' ? 1 : 2
      const next = [...s.cells]
      next[i] = s.cells[i] === want ? 0 : want
      return { ...s, cells: next, solved: s.solved + (isSolved(s.puzzle, next) ? 1 : 0) }
    })

  return (
    <GameShell
      title={t('nonogram.name')}
      status={done ? t('nonogram.solved') : t('nonogram.help')}
      controls={
        <>
          <Segmented
            label={t('common.size')}
            value={st.size}
            onChange={(s) => setSt(fresh(s, st.solved))}
            options={[
              { value: '5', label: '5×5' },
              { value: '10', label: '10×10' },
              { value: '15', label: '15×15' },
            ]}
          />
          <Segmented
            label={t('nonogram.tool')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'fill', label: '■' },
              { value: 'cross', label: '✕' },
            ]}
          />
          <span className="pill">
            {t('nonogram.count')}: <b>{st.solved}</b>
          </span>
          <button type="button" className="primary" onClick={() => setSt(fresh(st.size, st.solved))}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="ng-scroll">
        <div className="ng" style={{ gridTemplateColumns: `auto repeat(${n}, var(--ng-cell))` }} data-size={n}>
          <div />
          {puzzle.cols.map((clue, c) => (
            <div key={`c${c}`} className="ng-clue col">
              {clue.map((x, k) => (
                <span key={k}>{x}</span>
              ))}
            </div>
          ))}
          {Array.from({ length: n }, (_, r) => [
            <div key={`r${r}`} className="ng-clue row">
              {puzzle.rows[r].join(' ')}
            </div>,
            ...Array.from({ length: n }, (_, c) => {
              const i = r * n + c
              return (
                <button
                  key={i}
                  type="button"
                  className={`ng-cell s${cells[i]} ${c % 5 === 4 && c < n - 1 ? 'gr' : ''} ${r % 5 === 4 && r < n - 1 ? 'gb' : ''}`}
                  onClick={() => mark(i, mode)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    mark(i, 'cross')
                  }}
                  aria-label={`${r + 1}-${c + 1}`}
                />
              )
            }),
          ])}
        </div>
      </div>
    </GameShell>
  )
}
