import { useEffect } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { randomInt } from '../../lib/rng'
import { usePersistentState } from '../../lib/storage'
import { BRIDGES, DEATH, DICE, GEESE, GOAL, INN, JAIL, MAZE, type State, WELL, newGame, play } from './logic'

const COLORS = ['#e8b923', '#2f6db3', '#d63b30', '#2c8a3a']
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const COLS = 9

/** Squares 1..63 snaking up the board from the bottom-left. */
const cellOf = (n: number) => {
  const row = Math.floor((n - 1) / COLS)
  const k = (n - 1) % COLS
  return { row: 6 - row, col: row % 2 ? COLS - 1 - k : k }
}

const icon = (n: number) =>
  n === GOAL ? '🏁' : GEESE.includes(n) ? '🪿' : BRIDGES[n] ? '🌉' : DICE[n] ? '🎲' : n === INN ? '🏨' : n === WELL ? '🕳️' : n === MAZE ? '🌀' : n === JAIL ? '⛓️' : n === DEATH ? '💀' : ''

type Saved = { game: State; players: '2' | '3' | '4'; wins: number }

export default function Oca() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('oca', () => ({ game: newGame(4), players: '4', wins: 0 }))
  const g = st.game

  // Computer players roll by themselves.
  useEffect(() => {
    if (g.winner !== null || g.turn === 0) return
    const id = setTimeout(() => setSt((s) => ({ ...s, game: play(s.game, randomInt(Math.random, 6) + 1) })), 900)
    return () => clearTimeout(id)
  }, [g, setSt])

  const roll = () => {
    if (g.winner !== null || g.turn !== 0) return
    const game = play(g, randomInt(Math.random, 6) + 1)
    setSt({ ...st, game, wins: st.wins + (game.winner === 0 ? 1 : 0) })
  }

  const name = (p: number) => t(`oca.player${p}` as 'oca.player0')
  const last = g.last
  const what = last ? (last.event ? t(`oca.event.${last.event}` as 'oca.event.goose') : '') : ''
  const status =
    g.winner !== null
      ? g.winner === 0
        ? t('common.youWin')
        : t('parchis.winner', { name: name(g.winner) })
      : last
        ? `${name(last.player)}: ${last.roll ? `${DIE[last.roll]} → ${last.to}` : ''} ${what}`.trim()
        : t('oca.start')

  return (
    <GameShell
      title={t('oca.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('oca.players')}
            value={st.players}
            onChange={(p) => setSt({ ...st, players: p, game: newGame(Number(p)) })}
            options={[
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
            ]}
          />
          <span className="pill">
            {t('common.wins')}: <b>{st.wins}</b>
          </span>
          <button type="button" className="primary" onClick={() => setSt({ ...st, game: newGame(Number(st.players)) })}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="oca-board">
        {Array.from({ length: GOAL }, (_, k) => {
          const n = k + 1
          const { row, col } = cellOf(n)
          return (
            <div key={n} className={`oca-sq ${icon(n) ? 'special' : ''}`} style={{ gridRow: row + 1, gridColumn: col + 1 }}>
              <small>{n}</small>
              <span className="oca-icon">{icon(n)}</span>
              <span className="oca-tokens">
                {g.pos.map((p, i) => (p === n ? <i key={i} style={{ background: COLORS[i] }} title={name(i)} /> : null))}
              </span>
            </div>
          )
        })}
      </div>
      <div className="poker-actions">
        <button type="button" className="die" onClick={roll} disabled={g.turn !== 0 || g.winner !== null} aria-label={t('parchis.rollButton')}>
          {last?.player === 0 && last.roll ? DIE[last.roll] : '🎲'}
        </button>
        <button type="button" className="primary" onClick={roll} disabled={g.turn !== 0 || g.winner !== null}>
          {g.turn === 0 ? t('parchis.rollButton') : t('parchis.turn', { name: name(g.turn) })}
        </button>
      </div>
    </GameShell>
  )
}
