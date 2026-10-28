import { useEffect, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Side, type State, type Tile, aiChoose, deal, ends, pass, play, playable, sidesFor } from './logic'

const HUMAN = 0
/** Dot positions on a 3x3 grid for 0-6 pips. */
const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]

function Half({ n }: { n: number }) {
  return (
    <span className="dom-half">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[n].includes(i) ? 'dot' : ''} />
      ))}
    </span>
  )
}

export function DominoTile({ tile, flipped, onClick, active }: { tile: Tile; flipped?: boolean; onClick?: () => void; active?: boolean }) {
  const [a, b] = flipped ? [tile[1], tile[0]] : tile
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`dom-tile ${active ? 'active' : ''}`} onClick={onClick} aria-label={`${a}-${b}`}>
      <Half n={a} />
      <Half n={b} />
    </Tag>
  )
}

type Saved = { game: State; matches: number; won: number; recorded: boolean }

export default function Domino() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('domino', () => ({ game: deal(Math.random), matches: 0, won: 0, recorded: false }))
  const [choice, setChoice] = useState<Tile | null>(null)
  const g = st.game
  const myTurn = !g.round && g.turn === HUMAN
  const canPlay = myTurn ? playable(g) : []

  useEffect(() => {
    if (g.round || g.turn === HUMAN) return
    const id = setTimeout(() => {
      setSt((s) => {
        const c = aiChoose(s.game)
        const game = c ? play(s.game, c.tile, c.side) : pass(s.game)
        return game ? { ...s, game } : s
      })
    }, 700)
    return () => clearTimeout(id)
  }, [g, setSt])

  useEffect(() => {
    if (g.matchWinner === null || st.recorded) return
    setSt((s) => ({ ...s, recorded: true, matches: s.matches + 1, won: s.won + (g.matchWinner === 0 ? 1 : 0) }))
  }, [g.matchWinner, st.recorded, setSt])

  const put = (tile: Tile, side: Side) => {
    const game = play(g, tile, side)
    if (game) setSt({ ...st, game })
    setChoice(null)
  }

  const pick = (tile: Tile) => {
    if (!myTurn) return
    const sides = sidesFor(g, tile)
    if (sides.length === 1) put(tile, sides[0])
    else if (sides.length === 2) setChoice(tile) // fits both ends: ask which
  }

  const nextRound = () => setSt((s) => ({ ...s, game: s.game.matchWinner !== null ? deal(Math.random) : deal(Math.random, s.game), recorded: s.game.matchWinner !== null ? false : s.recorded }))
  const newMatch = () => setSt((s) => ({ ...s, game: deal(Math.random), recorded: false }))

  const name = (p: number) => t(`domino.player${p}` as 'domino.player0')
  const e = ends(g.chain)
  const round = g.round
  const status = round
    ? round.winnerTeam === null
      ? t('domino.tie')
      : t(round.winnerTeam === 0 ? 'domino.weWin' : 'domino.theyWin', { n: round.points }) + (round.blocked ? ` (${t('domino.blocked')})` : '')
    : myTurn
      ? canPlay.length
        ? t('common.yourTurn')
        : t('domino.mustPass')
      : t('domino.turn', { name: name(g.turn) })

  return (
    <GameShell
      title={t('domino.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('domino.us')}: <b>{g.scores[0]}</b> · {t('domino.them')}: <b>{g.scores[1]}</b> / {g.target}
          </span>
          <span className="pill">
            {t('common.wins')}: <b>{st.won}</b> / {st.matches}
          </span>
          <button type="button" className="primary" onClick={newMatch}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="dom-table">
        <div className="dom-seat top">
          {name(2)} · {t('domino.tiles', { n: g.hands[2].length })}
        </div>
        <div className="dom-seat left">
          {name(3)} · {t('domino.tiles', { n: g.hands[3].length })}
        </div>
        <div className="dom-seat right">
          {name(1)} · {t('domino.tiles', { n: g.hands[1].length })}
        </div>
        <div className="dom-chain">
          {choice && e && (
            <button type="button" className="dom-end" onClick={() => put(choice, 'left')}>
              ← {e[0]}
            </button>
          )}
          {g.chain.map((p, i) => (
            <DominoTile key={i} tile={p.tile} flipped={p.flipped} />
          ))}
          {choice && e && (
            <button type="button" className="dom-end" onClick={() => put(choice, 'right')}>
              {e[1]} →
            </button>
          )}
          {!g.chain.length && <span className="hint">{t('domino.empty')}</span>}
        </div>
      </div>
      <div className="dom-hand">
        {g.hands[HUMAN].map((tile) => (
          <DominoTile
            key={tile.join()}
            tile={tile}
            active={canPlay.includes(tile)}
            onClick={canPlay.includes(tile) ? () => pick(tile) : undefined}
          />
        ))}
      </div>
      <div className="dom-actions">
        {myTurn && !canPlay.length && (
          <button type="button" className="primary" onClick={() => setSt({ ...st, game: pass(g)! })}>
            {t('domino.pass')}
          </button>
        )}
        {round && (
          <button type="button" className="primary" onClick={nextRound}>
            {g.matchWinner !== null ? t(g.matchWinner === 0 ? 'domino.matchWon' : 'domino.matchLost') + ' · ' + t('common.newGame') : t('domino.nextRound')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
