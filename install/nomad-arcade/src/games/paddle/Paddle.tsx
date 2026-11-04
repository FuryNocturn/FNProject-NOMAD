import { useEffect, useRef, useState } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { axis, canvasPoint, useGameLoop, useHeldKeys, usePauseWhenHidden } from '../../lib/loop'
import { usePersistentState } from '../../lib/storage'
import { BALL, type Difficulty, H, PADDLES, PADDLE_H, PADDLE_W, type State, W, newGame, step, winner } from './logic'

export default function Paddle() {
  const { t } = useI18n()
  const [prefs, setPrefs] = usePersistentState<{ difficulty: Difficulty; tally: Tally }>('paddle', () => ({ difficulty: 'medium', tally: emptyTally() }))
  const game = useRef<State>(newGame(Math.random))
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState<0 | 1 | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = useRef<number | null>(null)
  const held = useHeldKeys(['arrowleft', 'arrowright', 'a', 'd', ' '], (k) => k === ' ' && toggle())

  const toggle = () => {
    if (winner(game.current) !== null) restart()
    else setRunning((r) => !r)
  }
  const restart = () => {
    game.current = newGame(Math.random)
    setScore([0, 0])
    setOver(null)
    setRunning(true)
  }
  usePauseWhenHidden(() => setRunning(false))

  const draw = () => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const st = game.current
    ctx.fillStyle = '#14281d'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#ffffff33'
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ffffff22'
    ctx.font = 'bold 72px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(st.score[1]), W / 2, H / 2 - 40)
    ctx.fillText(String(st.score[0]), W / 2, H / 2 + 100)
    ctx.fillStyle = '#ef6c00'
    ctx.fillRect(st.ai - PADDLE_W / 2, PADDLES.aiY, PADDLE_W, PADDLE_H)
    ctx.fillStyle = '#4fc3f7'
    ctx.fillRect(st.player - PADDLE_W / 2, PADDLES.playerY, PADDLE_W, PADDLE_H)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(st.ball.x, st.ball.y, BALL / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  useGameLoop(running, (dt) => {
    const before = game.current.score
    game.current = step(game.current, { dir: axis(held.current!), target: target.current }, dt, prefs.difficulty, Math.random)
    const st = game.current
    if (st.score !== before) setScore(st.score)
    const w = winner(st)
    if (w !== null) {
      setRunning(false)
      setOver(w)
      setPrefs((p) => ({ ...p, tally: { ...p.tally, [w === 0 ? 'wins' : 'losses']: p.tally[w === 0 ? 'wins' : 'losses'] + 1 } }))
    }
    draw()
  })
  useEffect(draw, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    target.current = canvasPoint(e.currentTarget, e).x
  }

  const status =
    over !== null ? t(over === 0 ? 'common.youWin' : 'common.youLose') : running ? `${score[0]} – ${score[1]}` : t('action.paused')

  return (
    <GameShell
      title={t('paddle.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={prefs.difficulty}
            onChange={(difficulty) => {
              setPrefs((p) => ({ ...p, difficulty }))
              restart()
            }}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <button type="button" className="secondary" onClick={toggle}>
            ⏯ {t(running ? 'action.pause' : 'action.play')}
          </button>
          <button type="button" className="primary" onClick={restart}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('paddle.help', { n: 7 })}</p>
      <div className="act-wrap">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="act-canvas"
          onPointerDown={(e) => {
            point(e)
            if (!running && over === null) setRunning(true)
          }}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && point(e)}
          onPointerUp={(e) => e.pointerType !== 'mouse' && (target.current = null)}
          onPointerLeave={() => (target.current = null)}
        />
        {!running && (
          <button type="button" className="act-overlay" onClick={over !== null ? restart : () => setRunning(true)}>
            {over !== null ? t('common.newGame') : t('action.tapToPlay')}
          </button>
        )}
      </div>
      <Scoreboard tally={prefs.tally} />
    </GameShell>
  )
}
