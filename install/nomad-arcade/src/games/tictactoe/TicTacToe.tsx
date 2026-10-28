import { useEffect } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Board, type Difficulty, aiMove, emptyBoard, outcome } from './logic'

const HUMAN = 'X'
const AI = 'O'

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

export default function TicTacToe() {
  const { t } = useI18n()
  const [state, setState] = usePersistentState<State>('tictactoe', () => fresh())
  const { board, difficulty, starter, tally } = state
  const result = outcome(board)
  const placed = board.filter(Boolean).length
  const humanToMove = !result && (placed % 2 === 0) === (starter === 'human')

  // The computer moves after a short pause, so the human sees their own move land first.
  useEffect(() => {
    if (result || humanToMove) return
    const id = setTimeout(() => {
      setState((s) => {
        const next = [...s.board]
        next[aiMove(s.board, AI, s.difficulty, Math.random)] = AI
        return { ...s, board: next }
      })
    }, 350)
    return () => clearTimeout(id)
  }, [board, result, humanToMove, setState])

  // Count each finished game once, even across reloads.
  useEffect(() => {
    if (!result || state.recorded) return
    const key = result.winner === 'draw' ? 'draws' : result.winner === HUMAN ? 'wins' : 'losses'
    setState((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [result, state.recorded, setState])

  const play = (i: number) => {
    if (!humanToMove || board[i]) return
    const next = [...board]
    next[i] = HUMAN
    setState({ ...state, board: next })
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
      title={t('tictactoe.name')}
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
      <div className="ttt-board">
        {board.map((cell, i) => (
          <button
            key={i}
            type="button"
            className={`ttt-cell ${cell ? `mark-${cell}` : ''} ${winLine.includes(i) ? 'win' : ''}`}
            onClick={() => play(i)}
            disabled={!humanToMove || cell !== null}
            aria-label={cell ?? String(i + 1)}
          >
            {cell}
          </button>
        ))}
      </div>
      <Scoreboard tally={tally} />
    </GameShell>
  )
}
