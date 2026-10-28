import { useEffect } from 'react'
import { GameShell, Scoreboard, Segmented, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Board, type Difficulty, type Mark, aiShot, allSunk, fire, newBoard, shipsLeft } from './logic'

type State = {
  mine: Board // the human's fleet, shot at by the computer
  theirs: Board // the computer's fleet, shot at by the human
  turn: 'human' | 'ai'
  started: boolean
  difficulty: Difficulty
  last: { who: 'human' | 'ai'; result: Mark } | null
  tally: Tally
  recorded: boolean
}

const fresh = (s?: Partial<State>): State => ({
  mine: newBoard(Math.random),
  theirs: newBoard(Math.random),
  turn: 'human',
  started: false,
  difficulty: 'medium',
  last: null,
  tally: emptyTally(),
  recorded: false,
  ...s,
})

function Grid({ board, showShips, onShot }: { board: Board; showShips: boolean; onShot?: (i: number) => void }) {
  const ships = new Set(board.ships.flatMap((s) => s.cells))
  return (
    <div className="bs-grid">
      {board.marks.map((m, i) => (
        <button
          key={i}
          type="button"
          className={`bs-cell ${m ?? ''} ${showShips && ships.has(i) ? 'ship' : ''}`}
          onClick={onShot ? () => onShot(i) : undefined}
          disabled={!onShot || !!m}
          aria-label={`${'ABCDEFGHIJ'[i % 10]}${Math.floor(i / 10) + 1}`}
        >
          {m === 'miss' ? '•' : m === 'hit' ? '✕' : m === 'sunk' ? '✕' : ''}
        </button>
      ))}
    </div>
  )
}

export default function Battleship() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('battleship', () => fresh())
  const over = allSunk(st.mine) ? 'lost' : allSunk(st.theirs) ? 'won' : null

  // The computer fires after a short pause; a hit lets it fire again.
  useEffect(() => {
    if (over || st.turn !== 'ai') return
    const id = setTimeout(() => {
      setSt((s) => {
        const r = fire(s.mine, aiShot(s.mine, s.difficulty, Math.random))
        return { ...s, mine: r.board, turn: r.result === 'miss' ? 'human' : 'ai', last: { who: 'ai', result: r.result } }
      })
    }, 650)
    return () => clearTimeout(id)
  }, [over, st.turn, st.mine, setSt])

  useEffect(() => {
    if (!over || st.recorded) return
    const key = over === 'won' ? 'wins' : 'losses'
    setSt((s) => ({ ...s, recorded: true, tally: { ...s.tally, [key]: s.tally[key] + 1 } }))
  }, [over, st.recorded, setSt])

  const shoot = (i: number) => {
    if (over || st.turn !== 'human') return
    const r = fire(st.theirs, i)
    if (!r.result) return
    // Hitting a ship earns another shot.
    setSt({ ...st, theirs: r.board, started: true, turn: r.result === 'miss' ? 'ai' : 'human', last: { who: 'human', result: r.result } })
  }

  const restart = (changes: Partial<State> = {}) => setSt((s) => fresh({ difficulty: s.difficulty, tally: s.tally, ...changes }))

  const lastMsg = st.last?.result ? t(`battleship.${st.last.who}.${st.last.result}` as 'battleship.human.miss') : ''
  const status = over ? (over === 'won' ? t('common.youWin') : t('common.youLose')) : `${lastMsg} ${st.turn === 'human' ? t('common.yourTurn') : t('common.thinking')}`.trim()

  return (
    <GameShell
      title={t('battleship.name')}
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
          {!st.started && (
            <button type="button" className="secondary" onClick={() => setSt({ ...st, mine: newBoard(Math.random) })}>
              🔀 {t('battleship.rearrange')}
            </button>
          )}
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="bs-boards">
        <section>
          <h2>
            {t('battleship.enemy')} · {t('battleship.left', { n: shipsLeft(st.theirs) })}
          </h2>
          <Grid board={st.theirs} showShips={!!over} onShot={st.turn === 'human' && !over ? shoot : undefined} />
        </section>
        <section>
          <h2>
            {t('battleship.yours')} · {t('battleship.left', { n: shipsLeft(st.mine) })}
          </h2>
          <Grid board={st.mine} showShips />
        </section>
      </div>
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
