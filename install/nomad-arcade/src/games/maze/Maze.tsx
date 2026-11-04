import { useEffect, useRef, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { useGameLoop, useHeldKeys, usePauseWhenHidden } from '../../lib/loop'
import { usePersistentState } from '../../lib/storage'
import { type Dir, type State, newLevel, posOf, step } from './logic'

const SIDE = 480
const KEY_DIR: Record<string, Dir> = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
const GUARD_COLOURS = ['#ef5350', '#ab47bc', '#ff7043']

export default function Maze() {
  const { t } = useI18n()
  const [prefs, setPrefs] = usePersistentState<{ best: number }>('maze', () => ({ best: 0 }))
  const game = useRef<State>(newLevel(1, Math.random))
  const want = useRef<Dir | null>(null)
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1, gems: game.current.gems.length, over: false, cleared: false })
  const [running, setRunning] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  useHeldKeys([...Object.keys(KEY_DIR), 'p', ' '], (k) => {
    if (KEY_DIR[k]) press(KEY_DIR[k])
    else setRunning((r) => !r)
  })
  usePauseWhenHidden(() => setRunning(false))

  const press = (d: Dir) => {
    want.current = d
    if (!game.current.over && !game.current.cleared) setRunning(true)
  }
  const sync = () => {
    const st = game.current
    setHud({ score: st.score, lives: st.lives, level: st.level, gems: st.gems.length, over: st.over, cleared: st.cleared })
    if (st.over && st.score > prefs.best) setPrefs({ best: st.score })
  }
  const load = (st: State) => {
    game.current = st
    want.current = null
    sync()
    setRunning(false)
    draw()
  }

  const draw = () => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const st = game.current
    const tile = SIDE / st.size
    ctx.fillStyle = '#10151f'
    ctx.fillRect(0, 0, SIDE, SIDE)
    ctx.fillStyle = '#3949ab'
    st.walls.forEach((w, i) => w && ctx.fillRect((i % st.size) * tile, Math.floor(i / st.size) * tile, tile + 0.5, tile + 0.5))
    ctx.fillStyle = '#4dd0e1'
    for (const g of st.gems) {
      const x = (g % st.size) * tile + tile / 2
      const y = Math.floor(g / st.size) * tile + tile / 2
      ctx.beginPath()
      ctx.moveTo(x, y - tile * 0.28)
      ctx.lineTo(x + tile * 0.22, y)
      ctx.lineTo(x, y + tile * 0.28)
      ctx.lineTo(x - tile * 0.22, y)
      ctx.fill()
    }
    st.guards.forEach((g, k) => {
      const p = posOf(g)
      ctx.fillStyle = GUARD_COLOURS[k % 3]
      ctx.beginPath()
      ctx.arc(p.x * tile + tile / 2, p.y * tile + tile / 2, tile * 0.4, Math.PI, 0)
      ctx.lineTo(p.x * tile + tile * 0.9, p.y * tile + tile * 0.9)
      ctx.lineTo(p.x * tile + tile * 0.1, p.y * tile + tile * 0.9)
      ctx.fill()
    })
    const p = posOf(st.player)
    if (st.hitTimer === 0 || Math.floor(st.hitTimer * 10) % 2 === 0) {
      ctx.fillStyle = '#ffd54f'
      ctx.beginPath()
      ctx.arc(p.x * tile + tile / 2, p.y * tile + tile / 2, tile * 0.38, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  useGameLoop(running, (dt) => {
    const before = game.current
    game.current = step(before, want.current, dt, Math.random)
    const st = game.current
    if (st.score !== before.score || st.lives !== before.lives || st.over || st.cleared) sync()
    if (st.over || st.cleared) setRunning(false)
    draw()
  })
  useEffect(draw, [])

  // Swipe on the board.
  const start = useRef<{ x: number; y: number } | null>(null)
  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    start.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
    press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const status = hud.over
    ? t('maze.over', { n: hud.score })
    : hud.cleared
      ? t('maze.cleared', { n: hud.level })
      : running
        ? t('maze.left', { n: hud.gems })
        : t('maze.start')

  return (
    <GameShell
      title={t('maze.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('maze.levelN', { n: hud.level })} · {t('common.score')}: <b>{hud.score}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{Math.max(prefs.best, hud.score)}</b>
          </span>
          <span className="pill" aria-label={t('action.lives')}>
            {'♥'.repeat(Math.max(0, hud.lives))}
          </span>
          <button type="button" className="primary" onClick={() => load(newLevel(1, Math.random))}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('maze.help')}</p>
      <div className="act-wrap square">
        <canvas
          ref={canvas}
          width={SIDE}
          height={SIDE}
          className="act-canvas square"
          onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={onUp}
        />
        {(hud.over || hud.cleared) && (
          <button
            type="button"
            className="act-overlay"
            onClick={() =>
              load(hud.over ? newLevel(1, Math.random) : newLevel(hud.level + 1, Math.random, { score: hud.score, lives: Math.min(5, hud.lives + 1) }))
            }
          >
            {hud.over ? t('common.newGame') : t('maze.next')}
          </button>
        )}
      </div>
      <div className="dpad">
        {(['up', 'left', 'right', 'down'] as Dir[]).map((d) => (
          <button key={d} type="button" className={d} onClick={() => press(d)} aria-label={t(`sokoban.${d}`)}>
            {{ up: '↑', left: '←', right: '→', down: '↓' }[d]}
          </button>
        ))}
      </div>
    </GameShell>
  )
}
