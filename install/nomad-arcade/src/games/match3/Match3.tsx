import { useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type State, adjacent, levelGoal, newGame, status, swap } from './logic'

const GEMS = ['🍒', '🍋', '🍇', '🫐', '🍏', '🍊']
const SPECIAL = { row: '↔', col: '↕', bomb: '💥' }

type Saved = { game: State; best: number }

export default function Match3() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('match3', () => ({ game: newGame(Math.random), best: 0 }))
  const [sel, setSel] = useState<number | null>(null)
  const [shake, setShake] = useState<number | null>(null)
  const g = st.game
  const s = status(g)

  const click = (i: number) => {
    if (s !== 'playing') return
    if (sel === null || !adjacent(sel, i)) return setSel(sel === i ? null : i)
    const next = swap(g, sel, i, Math.random)
    setSel(null)
    if (!next) {
      setShake(i)
      setTimeout(() => setShake(null), 300)
      return
    }
    setSt({ game: next, best: Math.max(st.best, next.score) })
  }

  const goal = levelGoal(g.level).target
  const progress = Math.min(100, Math.round(((g.score - (g.target - goal)) / goal) * 100))

  return (
    <GameShell
      title={t('match3.name')}
      status={
        s === 'won'
          ? t('match3.levelDone', { n: g.level })
          : s === 'lost'
            ? t('match3.out')
            : g.combo > 1
              ? t('match3.combo', { n: g.combo })
              : t('match3.help')
      }
      controls={
        <>
          <span className="pill">
            {t('match3.level')} <b>{g.level}</b>
          </span>
          <span className="pill">
            {t('common.score')}: <b>{g.score}</b> / {g.target}
          </span>
          <span className="pill">
            {t('common.moves')}: <b>{g.moves}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{st.best}</b>
          </span>
          {s === 'won' ? (
            <button type="button" className="primary" onClick={() => setSt({ ...st, game: newGame(Math.random, g.level + 1, g.score) })}>
              {t('match3.next')}
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => setSt({ ...st, game: newGame(Math.random) })}>
              {t('common.newGame')}
            </button>
          )}
        </>
      }
    >
      <div className="m3-progress" aria-hidden="true">
        <span style={{ width: `${Math.max(0, progress)}%` }} />
      </div>
      <div className="m3-board">
        {g.grid.map((gem, i) => (
          <button
            key={i}
            type="button"
            className={`m3-cell ${sel === i ? 'selected' : ''} ${shake === i ? 'shake' : ''} ${gem?.sp ? 'special' : ''}`}
            onClick={() => click(i)}
          >
            {gem && GEMS[gem.k]}
            {gem?.sp && <small>{SPECIAL[gem.sp]}</small>}
          </button>
        ))}
      </div>
    </GameShell>
  )
}
