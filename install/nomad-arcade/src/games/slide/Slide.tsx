import { useEffect } from 'react'
import { GameShell, Segmented, formatTime } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Grid, isSolved, neighbourFor, shuffle, slide } from './logic'

type Size = '3' | '4' | '5'
type State = { size: Size; grid: Grid; moves: number; seconds: number; best: Partial<Record<Size, number>> }

const fresh = (size: Size, best: State['best'] = {}): State => ({ size, grid: shuffle(Number(size), Math.random), moves: 0, seconds: 0, best })

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

export default function Slide() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('slide', () => fresh('4'))
  const n = Number(st.size)
  const done = isSolved(st.grid)

  // Clock runs while unsolved, the tab is visible and the first move was made.
  useEffect(() => {
    if (done || !st.moves) return
    const id = setInterval(() => {
      if (!document.hidden) setSt((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [done, st.moves > 0, setSt])

  const move = (i: number) =>
    setSt((s) => {
      if (i < 0 || isSolved(s.grid)) return s
      const grid = slide(s.grid, Number(s.size), i)
      if (!grid) return s
      const moves = s.moves + 1
      if (!isSolved(grid)) return { ...s, grid, moves }
      const prev = s.best[s.size]
      return { ...s, grid, moves, best: { ...s.best, [s.size]: prev === undefined ? moves : Math.min(prev, moves) } }
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key]
      if (!d || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      move(neighbourFor(st.grid, n, d))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const best = st.best[st.size]
  return (
    <GameShell
      title={t('slide.name')}
      status={done ? t('slide.solved', { n: st.moves, time: formatTime(st.seconds) }) : `${t('common.time')}: ${formatTime(st.seconds)}`}
      controls={
        <>
          <Segmented
            label={t('common.size')}
            value={st.size}
            onChange={(size) => setSt((s) => fresh(size, s.best))}
            options={(['3', '4', '5'] as Size[]).map((v) => ({ value: v, label: `${v}×${v}` }))}
          />
          <span className="pill">
            {t('common.moves')}: <b>{st.moves}</b>
            {best !== undefined && ` · ${t('common.best')}: ${best}`}
          </span>
          <button type="button" className="primary" onClick={() => setSt((s) => fresh(s.size, s.best))}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('slide.help')}</p>
      <div className={`sl-board ${done ? 'done' : ''}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {st.grid.map((v, i) =>
          v ? (
            <button
              key={v}
              type="button"
              className={`sl-tile ${v === i + 1 ? 'home' : ''}`}
              style={{ gridRow: Math.floor(i / n) + 1, gridColumn: (i % n) + 1 }}
              onClick={() => move(i)}
            >
              {v}
            </button>
          ) : null,
        )}
      </div>
    </GameShell>
  )
}
