import { useEffect } from 'react'
import { GameShell, Segmented, formatTime } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Game, type Size, chord, flagsLeft, newGame, reveal, toggleFlag } from './logic'

type State = { size: Size; game: Game; seconds: number; flagMode: boolean; best: Partial<Record<Size, number>> }

export default function Minesweeper() {
  const { t } = useI18n()
  const [state, setState] = usePersistentState<State>('minesweeper', () => ({
    size: 'beginner',
    game: newGame('beginner'),
    seconds: 0,
    flagMode: false,
    best: {},
  }))
  const { size, game, seconds, flagMode, best } = state

  useEffect(() => {
    if (game.status !== 'playing') return
    const id = setInterval(() => {
      if (!document.hidden) setState((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [game.status, setState])

  const update = (next: Game) =>
    setState((s) => {
      const won = next.status === 'won' && s.game.status !== 'won'
      const prev = s.best[s.size]
      return {
        ...s,
        game: next,
        best: won && (prev === undefined || s.seconds < prev) ? { ...s.best, [s.size]: s.seconds } : s.best,
      }
    })

  const open = (i: number) => {
    const cell = game.cells[i]
    if (flagMode && !cell.open) return update(toggleFlag(game, i))
    update(cell.open ? chord(game, i, Math.random) : reveal(game, i, Math.random))
  }

  const restart = (s: Size = size) => setState((st) => ({ ...st, size: s, game: newGame(s), seconds: 0 }))

  const face = game.status === 'won' ? '😎' : game.status === 'lost' ? '😵' : '🙂'
  const status =
    game.status === 'won'
      ? t('common.youWin')
      : game.status === 'lost'
        ? t('common.youLose')
        : t('minesweeper.help')

  return (
    <GameShell
      title={t('minesweeper.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('minesweeper.size')}
            value={size}
            onChange={restart}
            options={[
              { value: 'beginner', label: t('minesweeper.beginner') },
              { value: 'intermediate', label: t('minesweeper.intermediate') },
              { value: 'expert', label: t('minesweeper.expert') },
            ]}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={flagMode}
              onChange={(e) => setState((s) => ({ ...s, flagMode: e.target.checked }))}
            />
            🚩 {t('minesweeper.flagMode')}
          </label>
        </>
      }
    >
      <div className="ms-bar">
        <span>
          💣 {flagsLeft(game)}
        </span>
        <button type="button" className="ms-face" onClick={() => restart()} aria-label={t('common.newGame')}>
          {face}
        </button>
        <span>
          ⏱ {formatTime(seconds)}
          {best[size] !== undefined && <small> ({formatTime(best[size]!)})</small>}
        </span>
      </div>
      <div className="ms-scroll">
        <div className="ms-board" style={{ gridTemplateColumns: `repeat(${game.cols}, var(--ms-cell))` }}>
          {game.cells.map((c, i) => (
            <button
              key={i}
              type="button"
              className={[
                'ms-cell',
                c.open ? 'open' : '',
                c.open && c.mine ? 'mine' : '',
                game.exploded === i ? 'exploded' : '',
                c.open && !c.mine && c.adjacent ? `n${c.adjacent}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => open(i)}
              onContextMenu={(e) => {
                e.preventDefault()
                update(toggleFlag(game, i))
              }}
              disabled={game.status === 'won' || game.status === 'lost'}
            >
              {c.open ? (c.mine ? '💣' : c.adjacent || '') : c.flagged ? '🚩' : ''}
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  )
}
