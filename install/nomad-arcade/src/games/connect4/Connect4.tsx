import { useEffect } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Board, COLS, type Difficulty, aiMove, drop, emptyBoard, outcome } from './logic'

const HUMAN = 1
const AI = 2

type Starter = 'human' | 'ai'
type State = { board: Board; difficulty: Difficulty; starter: Starter; tally: Tally; recorded: boolean }

const fresh = (s?: Partial<State>): State => ({
  board: emptyBoard(),
  difficulty: 'medium',
  starter: 'human',
  tally: emptyTally(),
  recorded: false,
  ...s,
})

export default function Connect4() {
  const { t } = useI18n()
  const [state, setState] = usePersistentState<State>('connect4', () => fresh())
  const { board, difficulty, starter, tally } = state
  const result = outcome(board)
  const placed = board.filter(Boolean).length
  const humanToMove = !result && (placed % 2 === 0) === (starter === 'human')

  useEffect(() => {
    if (result || humanToMove) return
    // The pause lets the "thinking" message paint before the search blocks the thread.
    const id = setTimeout(() => {
      setState((s) => ({ ...s, board: drop(s.board, aiMove(s.board, AI, s.difficulty, Math.random), AI)! }))
    }, 300)
    return () => clearTimeout(id)
  }, [board, result, humanToMove, setState])

  useEffect(() => {
    if (!result || state.recorded) return
    const key = result.winner === 'draw' ? 'draws' : result.winner === HUMAN ? 'wins' : 'losses'
    setState((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [result, state.recorded, setState])

  const play = (col: number) => {
    if (!humanToMove) return
    const next = drop(board, col, HUMAN)
    if (next) setState({ ...state, board: next })
  }

  const restart = (changes: Partial<State> = {}) =>
    setState((s) => fresh({ difficulty: s.difficulty, starter: s.starter, tally: s.tally, ...changes }))

  const winLine = result && result.winner !== 'draw' ? result.line : []
  const status = result
    ? result.winner === 'draw'
      ? t('common.draw')
      : result.winner === HUMAN
        ? t('common.youWin')
        : t('common.youLose')
    : humanToMove
      ? t('common.yourTurn')
      : t('common.thinking')

  return (
    <GameShell
      title={t('connect4.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={difficulty}
            onChange={(d) => restart({ difficulty: d })}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <Segmented
            label={t('common.firstMove')}
            value={starter}
            onChange={(s) => restart({ starter: s })}
            options={[
              { value: 'human', label: t('common.you') },
              { value: 'ai', label: t('common.machine') },
            ]}
          />
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="c4-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            type="button"
            className="c4-column"
            style={{ gridColumn: c + 1 }}
            onClick={() => play(c)}
            disabled={!humanToMove || board[c] !== 0}
            aria-label={t('connect4.column', { n: c + 1 })}
          />
        ))}
        {board.map((cell, i) => (
          <div
            key={i}
            className={`c4-cell ${cell ? `disc-${cell}` : ''} ${winLine.includes(i) ? 'win' : ''}`}
            style={{ gridColumn: (i % COLS) + 1, gridRow: Math.floor(i / COLS) + 1 }}
          />
        ))}
      </div>
      <Scoreboard tally={tally} />
    </GameShell>
  )
}
