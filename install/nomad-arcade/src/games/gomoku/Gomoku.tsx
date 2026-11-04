import { useEffect } from 'react'
import { GameShell, Scoreboard, Segmented, StoneBoard, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Board, type Difficulty, SIZE, aiMove, emptyBoard, outcome } from './logic'

type Starter = 'human' | 'ai'
type State = { board: Board; last: number | null; difficulty: Difficulty; starter: Starter; tally: Tally; recorded: boolean }

// Black (1) always moves first; the human is black when they start.
const fresh = (s?: Partial<State>): State => ({
  board: emptyBoard(),
  last: null,
  difficulty: 'medium',
  starter: 'human',
  tally: emptyTally(),
  recorded: false,
  ...s,
})

const STARS = [3 * SIZE + 3, 3 * SIZE + 11, 7 * SIZE + 7, 11 * SIZE + 3, 11 * SIZE + 11]

export default function Gomoku() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('gomoku', () => fresh())
  const human = st.starter === 'human' ? 1 : 2
  const ai = human === 1 ? 2 : 1
  const result = outcome(st.board, st.last)
  const placed = st.board.filter(Boolean).length
  const toMove = placed % 2 === 0 ? 1 : 2
  const humanToMove = !result && toMove === human

  useEffect(() => {
    if (result || humanToMove) return
    const id = setTimeout(() => {
      setSt((s) => {
        const i = aiMove(s.board, ai, s.difficulty, Math.random)
        const board = [...s.board]
        board[i] = ai
        return { ...s, board, last: i }
      })
    }, 250)
    return () => clearTimeout(id)
  }, [st.board, result, humanToMove, ai, setSt])

  useEffect(() => {
    if (!result || st.recorded) return
    const key = result.winner === 'draw' ? 'draws' : result.winner === human ? 'wins' : 'losses'
    setSt((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [result, st.recorded, human, setSt])

  const play = (i: number) => {
    if (!humanToMove || st.board[i]) return
    const board = [...st.board]
    board[i] = human
    setSt({ ...st, board, last: i })
  }

  const restart = (changes: Partial<State> = {}) =>
    setSt((s) => fresh({ difficulty: s.difficulty, starter: s.starter, tally: s.tally, ...changes }))

  const status = result
    ? result.winner === 'draw'
      ? t('common.draw')
      : result.winner === human
        ? t('common.youWin')
        : t('common.youLose')
    : humanToMove
      ? t('common.yourTurn')
      : t('common.thinking')

  return (
    <GameShell
      title={t('gomoku.name')}
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
            label={t('common.firstMove')}
            value={st.starter}
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
      <p className="hint">{t('gomoku.rules', { colour: t(human === 1 ? 'board.black' : 'board.white') })}</p>
      <StoneBoard
        size={SIZE}
        stones={st.board}
        stars={STARS}
        last={st.last}
        highlight={result && result.winner !== 'draw' ? result.line : undefined}
        onPlay={humanToMove ? play : undefined}
        label={(i) => t('board.point', { r: Math.floor(i / SIZE) + 1, c: (i % SIZE) + 1 })}
      />
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
