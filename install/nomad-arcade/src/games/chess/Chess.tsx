import { useEffect, useRef, useState } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import {
  type Color,
  type Difficulty,
  type Kind,
  type Move,
  type Position,
  aiMove,
  inCheck,
  initial,
  kingSquare,
  legalMoves,
  makeMove,
  result,
} from './logic'

const GLYPH: Record<Color, Record<Kind, string>> = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
}

type State = {
  pos: Position
  human: Color
  difficulty: Difficulty
  last: Move | null
  tally: Tally
  recorded: boolean
}

const fresh = (s?: Partial<State>): State => ({
  pos: initial(),
  human: 'w',
  difficulty: 'medium',
  last: null,
  tally: emptyTally(),
  recorded: false,
  ...s,
})

export default function Chess() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('chess', () => fresh())
  const [sel, setSel] = useState<number | null>(null)
  const [promo, setPromo] = useState<Move[] | null>(null)
  const history = useRef<State[]>([])
  const res = result(st.pos)
  const humanToMove = !res && st.pos.turn === st.human
  const moves = humanToMove ? legalMoves(st.pos) : []
  const targets = sel === null ? [] : moves.filter((m) => m.from === sel)

  useEffect(() => {
    if (res || humanToMove) return
    // The pause lets "thinking" paint before the search blocks the page.
    const id = setTimeout(() => {
      setSt((s) => {
        const m = aiMove(s.pos, s.difficulty, Math.random)
        return { ...s, pos: makeMove(s.pos, m), last: m }
      })
    }, 250)
    return () => clearTimeout(id)
  }, [res, humanToMove, st.pos, setSt])

  useEffect(() => {
    if (!res || st.recorded) return
    const key = res === 'checkmate' ? (st.pos.turn === st.human ? 'losses' : 'wins') : 'draws'
    setSt((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [res, st.recorded, st.pos.turn, st.human, setSt])

  const play = (m: Move) => {
    history.current = [...history.current.slice(-100), st]
    setSt({ ...st, pos: makeMove(st.pos, m), last: m })
    setSel(null)
    setPromo(null)
  }

  const click = (i: number) => {
    if (!humanToMove) return
    const options = targets.filter((m) => m.to === i)
    if (options.length > 1) return setPromo(options) // promotion: ask which piece
    if (options.length === 1) return play(options[0])
    setSel(st.pos.board[i]?.c === st.human && sel !== i ? i : null)
  }

  // Undo takes back the computer's reply as well, back to the human's last turn.
  const undo = () => {
    const prev = history.current.pop()
    if (prev) {
      setSt({ ...prev, tally: st.tally, recorded: false })
      setSel(null)
    }
  }

  const restart = (changes: Partial<State> = {}) => {
    history.current = []
    setSel(null)
    setPromo(null)
    setSt((s) => fresh({ difficulty: s.difficulty, human: s.human, tally: s.tally, ...changes }))
  }

  const checkSq = inCheck(st.pos) ? kingSquare(st.pos.board, st.pos.turn) : -1
  const status = res
    ? res === 'checkmate'
      ? st.pos.turn === st.human
        ? `${t('chess.checkmate')} ${t('common.youLose')}`
        : `${t('chess.checkmate')} ${t('common.youWin')}`
      : `${t('common.draw')}: ${t(`chess.${res}`)}`
    : humanToMove
      ? checkSq >= 0
        ? `${t('chess.check')} ${t('common.yourTurn')}`
        : t('common.yourTurn')
      : t('common.thinking')
  // Seen from the human's side.
  const order = st.human === 'w' ? [...Array(64).keys()] : [...Array(64).keys()].reverse()

  return (
    <GameShell
      title={t('chess.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(d) => restart({ difficulty: d })}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <Segmented
            label={t('chess.youPlay')}
            value={st.human}
            onChange={(c) => restart({ human: c })}
            options={[
              { value: 'w', label: t('chess.white') },
              { value: 'b', label: t('chess.black') },
            ]}
          />
          <button type="button" className="secondary" onClick={undo} disabled={!history.current.length}>
            ↶ {t('common.undo')}
          </button>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="chess-board">
        {order.map((i) => {
          const p = st.pos.board[i]
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1
          const isTarget = targets.some((m) => m.to === i)
          const classes = [
            'chess-sq',
            dark ? 'dark' : 'light',
            sel === i ? 'selected' : '',
            st.last && (st.last.from === i || st.last.to === i) ? 'last' : '',
            i === checkSq ? 'check' : '',
            isTarget ? (p ? 'capture' : 'target') : '',
          ]
          return (
            <button key={i} type="button" className={classes.filter(Boolean).join(' ')} onClick={() => click(i)}>
              {p && <span className={`chess-piece ${p.c}`}>{GLYPH[p.c][p.k]}</span>}
            </button>
          )
        })}
      </div>
      {promo && (
        <div className="promo" role="dialog" aria-label={t('chess.promote')}>
          <span>{t('chess.promote')}</span>
          {promo.map((m) => (
            <button key={m.promo} type="button" onClick={() => play(m)}>
              {GLYPH[st.human][m.promo!]}
            </button>
          ))}
        </div>
      )}
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
