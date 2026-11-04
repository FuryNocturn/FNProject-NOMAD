import { useEffect, useRef, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { axis, canvasPoint, useGameLoop, useHeldKeys, usePauseWhenHidden } from '../../lib/loop'
import { usePersistentState } from '../../lib/storage'
import { ALIEN_H, ALIEN_W, BLOCK, H, SHIP_W, SHIP_Y, type State, W, alienX, alienY, newGame, step } from './logic'

// Our own sprites, 11×8: X filled.
const SPRITES = [
  ['...XXXXX...', '.XXXXXXXXX.', 'XX..XXX..XX', 'XXXXXXXXXXX', '..XX...XX..', '.XX.XXX.XX.', 'XX.......XX', '.X.......X.'],
  ['..X.....X..', '...XXXXX...', '..XX.X.XX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'X.X.....X.X', '...XX.XX...', '..X.....X..'],
  ['....XXX....', '..XXXXXXX..', '.XXX.X.XXX.', '.XXXXXXXXX.', '...X...X...', '..X.XXX.X..', '.X.......X.', 'X.........X'],
]
const SHIP = ['.....X.....', '....XXX....', '....XXX....', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XX.XXXXX.XX', 'X.........X']
const ROW_SPRITE = [2, 0, 0, 1, 1]
const ROW_COLOUR = ['#f06292', '#ffb74d', '#ffb74d', '#81c784', '#81c784']

function sprite(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, w: number, h: number, colour: string) {
  const px = w / rows[0].length
  const py = h / rows.length
  ctx.fillStyle = colour
  rows.forEach((row, r) => [...row].forEach((ch, c) => ch === 'X' && ctx.fillRect(x + c * px, y + r * py, px + 0.4, py + 0.4)))
}

export default function Invaders() {
  const { t } = useI18n()
  const [prefs, setPrefs] = usePersistentState<{ best: number }>('invaders', () => ({ best: 0 }))
  const game = useRef<State>(newGame())
  const [hud, setHud] = useState({ score: 0, lives: 3, wave: 1, over: false })
  const [running, setRunning] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const touch = useRef<{ x: number } | null>(null)
  const held = useHeldKeys(['arrowleft', 'arrowright', 'a', 'd', ' ', 'p'], (k) => k === 'p' && setRunning((r) => !r))
  usePauseWhenHidden(() => setRunning(false))

  const restart = () => {
    game.current = newGame()
    setHud({ score: 0, lives: 3, wave: 1, over: false })
    setRunning(true)
  }

  const draw = () => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const st = game.current
    ctx.fillStyle = '#0b1020'
    ctx.fillRect(0, 0, W, H)
    // A few fixed stars.
    ctx.fillStyle = '#ffffff55'
    for (let k = 0; k < 40; k++) ctx.fillRect((k * 97) % W, (k * 61) % (H - 80), 1.5, 1.5)
    for (const a of st.aliens) if (a.alive) sprite(ctx, SPRITES[ROW_SPRITE[a.row]], alienX(st, a), alienY(st, a), ALIEN_W, ALIEN_H, ROW_COLOUR[a.row])
    ctx.fillStyle = '#66bb6a'
    for (const b of st.shields) ctx.fillRect(b.x, b.y, BLOCK, BLOCK)
    if (!st.over && (st.hitTimer === 0 || Math.floor(st.hitTimer * 10) % 2 === 0))
      sprite(ctx, SHIP, st.ship - SHIP_W / 2, SHIP_Y, SHIP_W, 22, '#4fc3f7')
    ctx.fillStyle = '#fff'
    if (st.shot) ctx.fillRect(st.shot.x - 1.5, st.shot.y - 10, 3, 10)
    ctx.fillStyle = '#ff8a65'
    for (const b of st.bombs) ctx.fillRect(b.x - 2, b.y - 8, 4, 8)
    ctx.fillStyle = '#ffffff33'
    ctx.fillRect(0, SHIP_Y + 26, W, 2)
  }

  useGameLoop(running, (dt) => {
    const st = game.current
    let dir = axis(held.current!)
    if (touch.current) dir = Math.abs(touch.current.x - st.ship) < 4 ? 0 : Math.sign(touch.current.x - st.ship)
    const fire = held.current!.has(' ') || touch.current !== null
    const next = step(st, { dir, fire }, dt, Math.random)
    game.current = next
    if (next.score !== st.score || next.lives !== st.lives || next.wave !== st.wave || next.over !== st.over)
      setHud({ score: next.score, lives: next.lives, wave: next.wave, over: next.over })
    if (next.over) {
      setRunning(false)
      if (next.score > prefs.best) setPrefs({ best: next.score })
    }
    draw()
  })
  useEffect(draw, [])

  const status = hud.over ? t('invaders.over', { n: hud.score }) : running ? t('invaders.wave', { n: hud.wave }) : t('action.paused')

  return (
    <GameShell
      title={t('invaders.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('common.score')}: <b>{hud.score}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{Math.max(prefs.best, hud.score)}</b>
          </span>
          <span className="pill" aria-label={t('action.lives')}>
            {'♥'.repeat(Math.max(0, hud.lives))}
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
      <p className="hint">{t('invaders.help')}</p>
      <div className="act-wrap">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="act-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            touch.current = canvasPoint(e.currentTarget, e)
          }}
          onPointerMove={(e) => touch.current && (touch.current = canvasPoint(e.currentTarget, e))}
          onPointerUp={() => (touch.current = null)}
          onPointerCancel={() => (touch.current = null)}
        />
        {!running && (
          <button type="button" className="act-overlay" onClick={hud.over ? restart : () => setRunning(true)}>
            {hud.over ? t('common.newGame') : t('action.tapToPlay')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
