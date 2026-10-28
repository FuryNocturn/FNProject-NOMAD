import { useEffect } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { randomInt } from '../../lib/rng'
import { usePersistentState } from '../../lib/storage'
import { BASE, COLORS, GOAL_CELL, HOME, LOOP, pieceCell, trackCell } from './board'
import { type Move, type State, SAFE, aiChoose, currentMoves, move, newGame, roll } from './logic'

const HUMAN = 0
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const CELL = 20 // SVG units per board cell

type Saved = { game: State; wins: number; played: number; recorded: boolean }

export default function Parchis() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('parchis', () => ({ game: newGame(), wins: 0, played: 0, recorded: false }))
  const g = st.game
  const moves = currentMoves(g)
  const humanMove = g.phase === 'move' && g.turn === HUMAN
  const humanRoll = g.phase === 'roll' && g.turn === HUMAN

  // Computer players roll and move on their own, a beat apart so it can be followed.
  useEffect(() => {
    if (g.phase === 'over' || g.turn === HUMAN) return
    const id = setTimeout(() => {
      setSt((s) => {
        const game = s.game
        if (game.phase === 'roll') return { ...s, game: roll(game, randomInt(Math.random, 6) + 1) }
        const options = currentMoves(game)
        return options.length ? { ...s, game: move(game, aiChoose(game, options)) } : s
      })
    }, 650)
    return () => clearTimeout(id)
  }, [g, setSt])

  useEffect(() => {
    if (g.phase !== 'over' || st.recorded) return
    setSt((s) => ({ ...s, recorded: true, played: s.played + 1, wins: s.wins + (g.winner === HUMAN ? 1 : 0) }))
  }, [g.phase, g.winner, st.recorded, setSt])

  const doRoll = () => humanRoll && setSt({ ...st, game: roll(g, randomInt(Math.random, 6) + 1) })
  const doMove = (m: Move) => humanMove && setSt({ ...st, game: move(g, m) })
  const restart = () => setSt((s) => ({ ...s, game: newGame(), recorded: false }))

  const name = (p: number) => t(`parchis.player${p}` as 'parchis.player0')
  const bonus = g.bonuses[0]
  const status =
    g.phase === 'over'
      ? g.winner === HUMAN
        ? t('common.youWin')
        : t('parchis.winner', { name: name(g.winner!) })
      : g.turn === HUMAN
        ? humanRoll
          ? t('parchis.roll')
          : bonus
            ? t('parchis.bonus', { n: bonus })
            : t('parchis.pick', { n: g.steps })
        : t('parchis.turn', { name: name(g.turn) })

  // Pieces sharing a cell are drawn side by side.
  const stacks = new Map<string, number>()
  const drawn = g.pieces.flatMap((ps, p) =>
    ps.map((pos, k) => {
      const [r, c] = pieceCell(p, k, pos)
      const key = `${r},${c}`
      const n = pos < 0 ? 0 : (stacks.get(key) ?? 0)
      stacks.set(key, n + 1)
      const m = p === HUMAN && humanMove ? moves.find((x) => x.piece === k) : undefined
      return { p, k, x: (c + 0.5) * CELL + n * 8, y: (r + 0.5) * CELL, m }
    })
  )

  return (
    <GameShell
      title={t('parchis.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('common.wins')}: <b>{st.wins}</b> / {st.played}
          </span>
          <button type="button" className="primary" onClick={restart}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="parchis-wrap">
        <svg className="parchis" viewBox={`0 0 ${19 * CELL} ${19 * CELL}`} role="img" aria-label={t('parchis.name')}>
          <rect width={19 * CELL} height={19 * CELL} fill="var(--surface)" />
          {BASE.map(([r, c], p) => (
            <rect key={p} x={c * CELL + 4} y={r * CELL + 4} width={8 * CELL - 8} height={8 * CELL - 8} rx="14" fill={COLORS[p]} opacity="0.85" />
          ))}
          {LOOP.map(([r, c], idx) => {
            const num = ((idx + 8) % 68) + 1
            return (
              <g key={idx}>
                <rect x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill={SAFE.has(num) ? 'var(--accent-soft)' : 'var(--bg)'} stroke="var(--border)" />
                {SAFE.has(num) && <circle cx={(c + 0.5) * CELL} cy={(r + 0.5) * CELL} r="3" fill="var(--muted)" />}
              </g>
            )
          })}
          {HOME.map((cells, p) =>
            cells.map(([r, c], k) => <rect key={`${p}-${k}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill={COLORS[p]} opacity="0.55" stroke="var(--border)" />)
          )}
          {/* Goal: four triangles meeting in the centre. */}
          {GOAL_CELL.map((_, p) => {
            const cx = 9.5 * CELL
            const cy = 9.5 * CELL
            const corners = [
              [[8, 8], [8, 11]],
              [[8, 11], [11, 11]],
              [[11, 11], [11, 8]],
              [[11, 8], [8, 8]],
            ][[3, 0, 1, 2][p]]
            const pts = [[cx, cy], ...corners.map(([r, c]) => [c * CELL, r * CELL])].map((xy) => xy.join(',')).join(' ')
            return <polygon key={p} points={pts} fill={COLORS[p]} opacity="0.8" />
          })}
          {[5, 22, 39, 56].map((num, p) => {
            const [r, c] = trackCell(num)
            return <rect key={`exit${p}`} x={c * CELL + 2} y={r * CELL + 2} width={CELL - 4} height={CELL - 4} fill="none" stroke={COLORS[p]} strokeWidth="3" />
          })}
          {drawn.map(({ p, k, x, y, m }) => (
            <g key={`${p}-${k}`} className={m ? 'parchis-piece movable' : 'parchis-piece'} onClick={m ? () => doMove(m) : undefined}>
              <circle cx={x} cy={y} r="7.5" fill={COLORS[p]} stroke="#000" strokeWidth={m ? 2.5 : 1} />
              {m && <circle cx={x} cy={y} r="11" fill="none" stroke="#000" strokeDasharray="3 2" />}
            </g>
          ))}
        </svg>
        <div className="parchis-side">
          <button type="button" className="die" onClick={doRoll} disabled={!humanRoll} aria-label={t('parchis.rollButton')}>
            {g.die ? DIE[g.die] : '🎲'}
          </button>
          <button type="button" className="primary" onClick={doRoll} disabled={!humanRoll}>
            {t('parchis.rollButton')}
          </button>
          <ol className="parchis-players">
            {[0, 1, 2, 3].map((p) => (
              <li key={p} className={g.turn === p && g.phase !== 'over' ? 'active' : ''}>
                <span className="swatch" style={{ background: COLORS[p] }} />
                {name(p)}
                <small>{g.pieces[p].filter((x) => x === 71).length}/4</small>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GameShell>
  )
}
