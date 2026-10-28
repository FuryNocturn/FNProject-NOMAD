import { useEffect, useRef, useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { COLS, type Dir, ROWS, type State, newGame, step } from './logic'

type Speed = 'slow' | 'normal' | 'fast'
const TICK_MS: Record<Speed, number> = { slow: 170, normal: 115, fast: 75 }
const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
}

export default function Snake() {
  const { t } = useI18n()
  const [prefs, setPrefs] = usePersistentState<{ speed: Speed; best: number }>('snake', () => ({ speed: 'normal', best: 0 }))
  const [game, setGame] = useState<State>(() => newGame(Math.random))
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  // Turns pressed between ticks, applied one per tick so quick double turns are not lost.
  const queue = useRef<Dir[]>([])

  useEffect(() => {
    if (!running || !game.alive) return
    const id = setInterval(() => {
      // Taken outside the updater: React may run updaters twice, which would drop a turn.
      const turn = queue.current.shift()
      setGame((g) => step(g, turn ?? g.dir, Math.random))
    }, TICK_MS[prefs.speed])
    return () => clearInterval(id)
  }, [running, game.alive, prefs.speed])

  useEffect(() => {
    if (!game.alive && game.score > prefs.best) setPrefs((p) => ({ ...p, best: game.score }))
  }, [game.alive, game.score, prefs.best, setPrefs])

  const press = (dir: Dir) => {
    if (!game.alive) return
    if (queue.current.length < 2) queue.current.push(dir)
    setRunning(true)
    setStarted(true)
  }

  const restart = () => {
    queue.current = []
    setGame(newGame(Math.random))
    setRunning(false)
    setStarted(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === ' ') {
        e.preventDefault()
        if (game.alive) setRunning((r) => !r)
        else restart()
        return
      }
      const dir = KEYS[e.key]
      if (!dir) return
      e.preventDefault()
      press(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const body = new Set(game.snake)
  const status = !game.alive ? t('snake.over') : running ? `${t('common.score')}: ${game.score}` : started ? t('snake.paused') : t('snake.start')

  return (
    <GameShell
      title={t('snake.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('snake.speed')}
            value={prefs.speed}
            onChange={(speed) => setPrefs((p) => ({ ...p, speed }))}
            options={[
              { value: 'slow', label: t('snake.slow') },
              { value: 'normal', label: t('snake.normal') },
              { value: 'fast', label: t('snake.fast') },
            ]}
          />
          <span className="pill">
            {t('common.score')}: <b>{game.score}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{prefs.best}</b>
          </span>
          <button type="button" className="secondary" onClick={() => setRunning((r) => !r)} disabled={!game.alive}>
            ⏯ {t('snake.pause')}
          </button>
          <button type="button" className="primary" onClick={restart}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className={`snake-board ${game.alive ? '' : 'dead'}`} style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <div
            key={i}
            className={i === game.snake[0] ? 'snake-head' : body.has(i) ? 'snake-body' : i === game.food ? 'snake-food' : ''}
          />
        ))}
      </div>
      <div className="dpad">
        <button type="button" className="up" onClick={() => press('up')} aria-label="↑">↑</button>
        <button type="button" className="left" onClick={() => press('left')} aria-label="←">←</button>
        <button type="button" className="right" onClick={() => press('right')} aria-label="→">→</button>
        <button type="button" className="down" onClick={() => press('down')} aria-label="↓">↓</button>
      </div>
    </GameShell>
  )
}
