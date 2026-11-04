import { useEffect, useMemo, useRef } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Dir, type Pos, generate, solved, walk } from './logic'

type State = { n: number; unlocked: number; pos: Pos | null; history: Pos[]; moves: number; best: Record<number, number> }

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
}

export default function Sokoban() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('sokoban', () => ({ n: 1, unlocked: 1, pos: null, history: [], moves: 0, best: {} }))
  // Same number, same level: only the progress is saved.
  const gen = useMemo(() => generate(st.n), [st.n])
  const { level } = gen
  const pos = st.pos ?? gen.start
  const done = solved(level, pos)

  useEffect(() => {
    if (!done) return
    setSt((s) => {
      const prev = s.best[s.n]
      if (s.unlocked > s.n && prev !== undefined && prev <= s.moves) return s
      return { ...s, unlocked: Math.max(s.unlocked, s.n + 1), best: { ...s.best, [s.n]: prev === undefined ? s.moves : Math.min(prev, s.moves) } }
    })
  }, [done, setSt])

  const go = (d: Dir) =>
    setSt((s) => {
      const cur = s.pos ?? gen.start
      if (solved(level, cur)) return s
      const r = walk(level, cur, d)
      if (!r) return s
      // shortcut: undo keeps the last 300 steps, enough for these levels.
      return { ...s, pos: r.pos, history: [...s.history.slice(-299), cur], moves: s.moves + 1 }
    })

  const undo = () =>
    setSt((s) => (s.history.length ? { ...s, pos: s.history.at(-1)!, history: s.history.slice(0, -1), moves: s.moves + 1 } : s))
  const restart = () => setSt((s) => ({ ...s, pos: null, history: [], moves: 0 }))
  const open = (n: number) => setSt((s) => ({ ...s, n, pos: null, history: [], moves: 0 }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLSelectElement) return
      const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
      if (d) go(d)
      else if (e.key.toLowerCase() === 'z' || e.key === 'Backspace') undo()
      else if (e.key.toLowerCase() === 'r') restart()
      else return
      e.preventDefault()
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

  const best = st.best[st.n]
  return (
    <GameShell
      title={t('sokoban.name')}
      status={done ? t('sokoban.solved', { n: st.moves }) : t('sokoban.level', { n: st.n, p: gen.pushes })}
      controls={
        <>
          <label className="pill">
            {t('sokoban.levelLabel')}{' '}
            <select value={st.n} onChange={(e) => open(Number(e.target.value))}>
              {Array.from({ length: st.unlocked }, (_, k) => (
                <option key={k} value={k + 1}>
                  {k + 1}
                  {st.best[k + 1] !== undefined ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </label>
          <span className="pill">
            {t('common.moves')}: <b>{st.moves}</b>
            {best !== undefined && ` · ${t('common.best')}: ${best}`}
          </span>
          <button type="button" className="secondary" onClick={undo} disabled={!st.history.length}>
            {t('common.undo')}
          </button>
          <button type="button" className="secondary" onClick={restart}>
            {t('sokoban.restart')}
          </button>
          {done && (
            <button type="button" className="primary" onClick={() => open(st.n + 1)}>
              {t('sokoban.next')}
            </button>
          )}
        </>
      }
    >
      <p className="hint">{t('sokoban.help')}</p>
      <div
        className={`sk-board ${done ? 'done' : ''}`}
        style={{ gridTemplateColumns: `repeat(${level.w}, 1fr)`, gridTemplateRows: `repeat(${level.h}, 1fr)`, aspectRatio: `${level.w} / ${level.h}` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {level.walls.map((wall, i) => {
          const box = pos.boxes.includes(i)
          const cls = wall ? 'wall' : ['floor', level.goals[i] ? 'goal' : '', box ? 'box' : '', pos.player === i ? 'player' : ''].join(' ')
          return <div key={i} className={`sk-cell ${cls}`} />
        })}
      </div>
      <div className="sk-pad" aria-label={t('sokoban.pad')}>
        {(['up', 'left', 'down', 'right'] as Dir[]).map((d) => (
          <button key={d} type="button" className={`sk-${d}`} onClick={() => go(d)} aria-label={t(`sokoban.${d}`)}>
            {{ up: '▲', left: '◀', down: '▼', right: '▶' }[d]}
          </button>
        ))}
      </div>
    </GameShell>
  )
}
