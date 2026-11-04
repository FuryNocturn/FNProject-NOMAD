import { useEffect, useRef, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { axis, canvasPoint, useGameLoop, useHeldKeys, usePauseWhenHidden } from '../../lib/loop'
import { usePersistentState } from '../../lib/storage'
import { H, LOSE_ROW, R, ROW_H, SHOOTER, type State, W, centre, newLevel, shoot, step } from './logic'

const COLOURS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00']
// A mark per colour, so they can be told apart without colour.
const MARKS = ['●', '■', '▲', '◆', '★', '✚']

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, colour: number, r = R - 1) {
  ctx.fillStyle = COLOURS[colour]
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff55'
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0006'
  ctx.font = `${Math.round(r * 0.8)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(MARKS[colour], x, y + 1)
}

export default function Bubbles() {
  const { t } = useI18n()
  const [prefs, setPrefs] = usePersistentState<{ best: number }>('bubbles', () => ({ best: 0 }))
  const game = useRef<State>(newLevel(1, Math.random))
  const aim = useRef(Math.PI / 2)
  const [hud, setHud] = useState({ score: 0, level: 1, over: false, cleared: false })
  const [running, setRunning] = useState(true)
  const canvas = useRef<HTMLCanvasElement>(null)
  const held = useHeldKeys(['arrowleft', 'arrowright', 'a', 'd', ' ', 'p'], (k) => {
    if (k === ' ') fire()
    if (k === 'p') setRunning((r) => !r)
  })
  usePauseWhenHidden(() => setRunning(false))

  const sync = () => {
    const st = game.current
    setHud({ score: st.score, level: st.level, over: st.over, cleared: st.cleared })
    if (st.over && st.score > prefs.best) setPrefs({ best: st.score })
  }
  const fire = () => {
    if (!running) return setRunning(true)
    game.current = shoot(game.current, aim.current, Math.random)
  }
  const restart = () => {
    game.current = newLevel(1, Math.random)
    sync()
    setRunning(true)
  }
  const nextLevel = () => {
    game.current = newLevel(game.current.level + 1, Math.random, game.current.score)
    sync()
    setRunning(true)
  }

  const draw = () => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const st = game.current
    ctx.fillStyle = '#1a2233'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#e5393533'
    ctx.fillRect(0, R + LOSE_ROW * ROW_H - R, W, 2)
    st.rows.forEach((row, r) => row.forEach((v, c) => v !== null && bubble(ctx, centre(st, r, c).x, centre(st, r, c).y, v)))
    // Aiming line.
    ctx.strokeStyle = '#ffffff55'
    ctx.setLineDash([6, 8])
    ctx.beginPath()
    ctx.moveTo(SHOOTER.x, SHOOTER.y)
    ctx.lineTo(SHOOTER.x + Math.cos(aim.current) * 150, SHOOTER.y - Math.sin(aim.current) * 150)
    ctx.stroke()
    ctx.setLineDash([])
    if (st.shot) bubble(ctx, st.shot.x, st.shot.y, st.shot.colour)
    else bubble(ctx, SHOOTER.x, SHOOTER.y, st.next)
    bubble(ctx, SHOOTER.x - 70, SHOOTER.y + 8, st.after, R * 0.65)
  }

  useGameLoop(running && !hud.over && !hud.cleared, (dt) => {
    const turn = axis(held.current!)
    if (turn) aim.current = Math.max(0.15, Math.min(Math.PI - 0.15, aim.current - turn * 1.8 * dt))
    const before = game.current
    game.current = step(before, dt, Math.random)
    if (game.current.score !== before.score || game.current.over || game.current.cleared) sync()
    draw()
  })
  useEffect(draw, [])

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPoint(e.currentTarget, e)
    aim.current = Math.max(0.15, Math.min(Math.PI - 0.15, Math.atan2(SHOOTER.y - p.y, p.x - SHOOTER.x)))
    if (!running) draw()
  }

  const status = hud.over
    ? t('bubbles.over', { n: hud.score })
    : hud.cleared
      ? t('bubbles.cleared', { n: hud.level })
      : running
        ? t('bubbles.level', { n: hud.level })
        : t('action.paused')

  return (
    <GameShell
      title={t('bubbles.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('common.score')}: <b>{hud.score}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{Math.max(prefs.best, hud.score)}</b>
          </span>
          <button type="button" className="secondary" onClick={() => setRunning((r) => !r)} disabled={hud.over}>
            ⏯ {t(running ? 'action.pause' : 'action.play')}
          </button>
          <button type="button" className="primary" onClick={restart}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('bubbles.help')}</p>
      <div className="act-wrap">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="act-canvas"
          onPointerMove={pointAt}
          onPointerUp={(e) => {
            pointAt(e)
            fire()
          }}
        />
        {(!running || hud.over || hud.cleared) && (
          <button type="button" className="act-overlay" onClick={hud.over ? restart : hud.cleared ? nextLevel : () => setRunning(true)}>
            {hud.over ? t('common.newGame') : hud.cleared ? t('bubbles.next') : t('action.tapToPlay')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
