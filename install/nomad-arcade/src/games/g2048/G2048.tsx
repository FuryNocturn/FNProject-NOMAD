import { useEffect, useRef } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Dir, type Grid, canMove, newGrid, slide, spawn } from './logic'

type State = { grid: Grid; score: number; best: number; reached: boolean }

const KEYS: Record<string, Dir> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
}

export default function G2048() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('g2048', () => ({ grid: newGrid(Math.random), score: 0, best: 0, reached: false }))
  const stuck = !canMove(st.grid)

  const go = (dir: Dir) =>
    setSt((s) => {
      const res = slide(s.grid, dir)
      if (!res.moved) return s
      const score = s.score + res.gained
      return {
        grid: spawn(res.grid, Math.random),
        score,
        best: Math.max(s.best, score),
        reached: s.reached || res.grid.includes(2048),
      }
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key]
      if (!dir || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      go(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Swipe: the dominant axis of a drag longer than 24 px picks the direction.
  const start = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => (start.current = { x: e.clientX, y: e.clientY })
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    start.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const status = stuck ? t('g2048.over') : st.reached ? t('g2048.reached') : t('g2048.help')

  return (
    <GameShell
      title={t('g2048.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('common.score')}: <b>{st.score}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{st.best}</b>
          </span>
          <button
            type="button"
            className="primary"
            onClick={() => setSt((s) => ({ grid: newGrid(Math.random), score: 0, best: s.best, reached: false }))}
          >
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="g2048-board" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {st.grid.map((v, i) => (
          <div key={i} className={`g2048-tile ${v ? `v${Math.min(v, 4096)}` : ''}`}>
            {v || ''}
          </div>
        ))}
      </div>
    </GameShell>
  )
}
