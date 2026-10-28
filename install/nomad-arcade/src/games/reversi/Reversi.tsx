import { useEffect } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Board, type Difficulty, type Player, aiMove, count, isOver, legalMoves, newBoard, play } from './logic'

const HUMAN: Player = 1
const AI: Player = 2

type Notice = 'youPass' | 'aiPass' | null
type State = { board: Board; turn: Player; difficulty: Difficulty; tally: Tally; recorded: boolean; notice: Notice }

const fresh = (s?: Partial<State>): State => ({
  board: newBoard(),
  turn: HUMAN,
  difficulty: 'medium',
  tally: emptyTally(),
  recorded: false,
  notice: null,
  ...s,
})

export default function Reversi() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('reversi', () => fresh())
  const over = isOver(st.board)
  const moves = !over && st.turn === HUMAN ? legalMoves(st.board, HUMAN) : []

  useEffect(() => {
    if (over || st.turn !== AI) return
    const id = setTimeout(() => {
      setSt((s) => {
        const m = aiMove(s.board, AI, s.difficulty, Math.random)
        if (m < 0) return { ...s, turn: HUMAN, notice: 'aiPass' }
        const board = play(s.board, m, AI)!
        // If the human now has no move but the game goes on, the computer plays again.
        const humanStuck = !isOver(board) && legalMoves(board, HUMAN).length === 0
        return { ...s, board, turn: humanStuck ? AI : HUMAN, notice: humanStuck ? 'youPass' : null }
      })
    }, 450)
    return () => clearTimeout(id)
  }, [over, st.turn, st.board, setSt])

  useEffect(() => {
    if (!over || st.recorded) return
    const diff = count(st.board, HUMAN) - count(st.board, AI)
    const key = diff > 0 ? 'wins' : diff < 0 ? 'losses' : 'draws'
    setSt((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [over, st.recorded, st.board, setSt])

  const click = (i: number) => {
    if (st.turn !== HUMAN || !moves.includes(i)) return
    setSt({ ...st, board: play(st.board, i, HUMAN)!, turn: AI, notice: null })
  }

  const restart = (changes: Partial<State> = {}) =>
    setSt((s) => fresh({ difficulty: s.difficulty, tally: s.tally, ...changes }))

  const mine = count(st.board, HUMAN)
  const theirs = count(st.board, AI)
  const status = over
    ? mine > theirs
      ? t('common.youWin')
      : mine < theirs
        ? t('common.youLose')
        : t('common.draw')
    : st.notice
      ? t(`reversi.${st.notice}`)
      : st.turn === HUMAN
        ? t('common.yourTurn')
        : t('common.thinking')

  return (
    <GameShell
      title={t('reversi.name')}
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
          <span className="pill">
            ⚫ {t('common.you')}: <b>{mine}</b>
          </span>
          <span className="pill">
            ⚪ {t('common.machine')}: <b>{theirs}</b>
          </span>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="rv-board">
        {st.board.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`rv-cell ${moves.includes(i) ? 'hint' : ''}`}
            onClick={() => click(i)}
            disabled={!moves.includes(i)}
            aria-label={`${Math.floor(i / 8) + 1}-${(i % 8) + 1}`}
          >
            {v ? <span className={`rv-disc p${v}`} /> : null}
          </button>
        ))}
      </div>
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
