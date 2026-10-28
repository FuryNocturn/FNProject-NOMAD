import { useEffect } from 'react'
import { GameShell, Segmented, formatTime } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { SIZES, type Size, type State as Game, closeUnmatched, flip, isWon, newGame } from './logic'

type State = { size: Size; game: Game; seconds: number; best: Partial<Record<Size, number>> }

export default function Memory() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('memory', () => ({
    size: 'small',
    game: newGame('small', Math.random),
    seconds: 0,
    best: {},
  }))
  const won = isWon(st.game)
  const started = st.game.moves > 0 || st.game.open.length > 0

  // A missed pair stays visible for a moment, then turns back over.
  useEffect(() => {
    if (st.game.open.length !== 2) return
    const id = setTimeout(() => setSt((s) => ({ ...s, game: closeUnmatched(s.game) })), 800)
    return () => clearTimeout(id)
  }, [st.game.open, setSt])

  useEffect(() => {
    if (won || !started) return
    const id = setInterval(() => {
      if (!document.hidden) setSt((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [won, started, setSt])

  useEffect(() => {
    if (!won) return
    setSt((s) => {
      const prev = s.best[s.size]
      return prev !== undefined && prev <= s.game.moves ? s : { ...s, best: { ...s.best, [s.size]: s.game.moves } }
    })
  }, [won, setSt])

  const restart = (size: Size = st.size) => setSt((s) => ({ ...s, size, game: newGame(size, Math.random), seconds: 0 }))

  return (
    <GameShell
      title={t('memory.name')}
      status={won ? t('common.youWin') : `${t('common.moves')}: ${st.game.moves} · ${t('common.time')}: ${formatTime(st.seconds)}`}
      controls={
        <>
          <Segmented
            label={t('common.size')}
            value={st.size}
            onChange={restart}
            options={[
              { value: 'small', label: t('common.small') },
              { value: 'medium', label: t('common.mediumSize') },
              { value: 'large', label: t('common.large') },
            ]}
          />
          {st.best[st.size] !== undefined && (
            <span className="pill">
              {t('common.best')}: <b>{st.best[st.size]}</b>
            </span>
          )}
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="mem-board" style={{ gridTemplateColumns: `repeat(${SIZES[st.size].cols}, minmax(0, 1fr))` }}>
        {st.game.cards.map((c, i) => {
          const shown = c.matched || st.game.open.includes(i)
          return (
            <button
              key={i}
              type="button"
              className={`mem-card ${shown ? 'shown' : ''} ${c.matched ? 'matched' : ''}`}
              onClick={() => setSt((s) => ({ ...s, game: flip(s.game, i) }))}
              disabled={c.matched}
              aria-label={shown ? c.face : '?'}
            >
              {shown ? c.face : ''}
            </button>
          )
        })}
      </div>
    </GameShell>
  )
}
