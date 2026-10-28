import { useEffect, useState } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Difficulty, type Move, type State as Game, aiMove, apply, initial, isDark, legalMoves, winner } from './logic'

type State = { game: Game; difficulty: Difficulty; last: number[]; tally: Tally; recorded: boolean }

const fresh = (s?: Partial<State>): State => ({
  game: initial(),
  difficulty: 'medium',
  last: [],
  tally: emptyTally(),
  recorded: false,
  ...s,
})

export default function Checkers() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('checkers', () => fresh())
  const [sel, setSel] = useState<number | null>(null)
  const win = winner(st.game)
  const humanToMove = !win && st.game.turn === 'w'
  const moves = humanToMove ? legalMoves(st.game) : []
  const movable = new Set(moves.map((m) => m.path[0]))
  const fromSel = sel === null ? [] : moves.filter((m) => m.path[0] === sel)
  const mustCapture = moves.some((m) => m.captured.length)

  useEffect(() => {
    if (win || humanToMove) return
    const id = setTimeout(() => {
      setSt((s) => {
        const m = aiMove(s.game, s.difficulty, Math.random)
        return { ...s, game: apply(s.game, m), last: m.path }
      })
    }, 500)
    return () => clearTimeout(id)
  }, [win, humanToMove, st.game, setSt])

  useEffect(() => {
    if (!win || st.recorded) return
    const key = win === 'draw' ? 'draws' : win === 'w' ? 'wins' : 'losses'
    setSt((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [win, st.recorded, setSt])

  const play = (m: Move) => {
    setSt({ ...st, game: apply(st.game, m), last: m.path })
    setSel(null)
  }

  const click = (i: number) => {
    if (!humanToMove) return
    // Several capture routes can end on the same square; any of them is equally legal.
    const m = fromSel.find((x) => x.path[x.path.length - 1] === i)
    if (m) return play(m)
    setSel(movable.has(i) && sel !== i ? i : null)
  }

  const restart = (changes: Partial<State> = {}) => {
    setSel(null)
    setSt((s) => fresh({ difficulty: s.difficulty, tally: s.tally, ...changes }))
  }

  const status = win
    ? win === 'draw'
      ? t('common.draw')
      : win === 'w'
        ? t('common.youWin')
        : t('common.youLose')
    : humanToMove
      ? mustCapture
        ? t('checkers.mustCapture')
        : t('common.yourTurn')
      : t('common.thinking')

  return (
    <GameShell
      title={t('checkers.name')}
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
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('checkers.help')}</p>
      <div className="ck-board">
        {st.game.board.map((p, i) => {
          const end = fromSel.some((m) => m.path[m.path.length - 1] === i)
          const classes = [
            'ck-sq',
            isDark(i) ? 'dark' : 'light',
            sel === i ? 'selected' : '',
            movable.has(i) && sel === null ? 'movable' : '',
            st.last.includes(i) ? 'last' : '',
            end ? 'target' : '',
          ]
          return (
            <button key={i} type="button" className={classes.filter(Boolean).join(' ')} onClick={() => click(i)} disabled={!isDark(i)}>
              {p && <span className={`ck-piece ${p.c} ${p.king ? 'king' : ''}`}>{p.king ? '♛' : ''}</span>}
            </button>
          )
        })}
      </div>
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
