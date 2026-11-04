import { useEffect } from 'react'
import { GameShell, Scoreboard, Segmented, SpanishCard, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { useSpanishName } from '../../lib/spanishNames'
import { cardKey, sameCard, sortHand, trickStrength } from '../../lib/spanish'
import { usePersistentState } from '../../lib/storage'
import { type Difficulty, type State, aiChoose, canSwap, deal, play, result, stockSize, swap } from './logic'

const HUMAN = 0
type Saved = { game: State; difficulty: Difficulty; tally: Tally; recorded: boolean; starter: number }

export default function Brisca() {
  const { t } = useI18n()
  const name = useSpanishName()
  const [st, setSt] = usePersistentState<Saved>('brisca', () => ({ game: deal(Math.random), difficulty: 'medium', tally: emptyTally(), recorded: false, starter: 0 }))
  const g = st.game
  const res = result(g)

  useEffect(() => {
    if (g.over || g.turn === HUMAN) return
    const id = setTimeout(() => {
      setSt((s) => {
        const game = swap(s.game, 1) ?? s.game
        return { ...s, game: play(game, aiChoose(game, s.difficulty, Math.random)) ?? game }
      })
    }, 800)
    return () => clearTimeout(id)
  }, [g, setSt])

  useEffect(() => {
    if (res === null || st.recorded) return
    setSt((s) => ({
      ...s,
      recorded: true,
      tally: { wins: s.tally.wins + (res === 1 ? 1 : 0), losses: s.tally.losses + (res === -1 ? 1 : 0), draws: s.tally.draws + (res === 0 ? 1 : 0) },
    }))
  }, [res, st.recorded, setSt])

  const restart = (difficulty = st.difficulty) =>
    setSt((s) => ({ ...s, difficulty, game: deal(Math.random, 1 - s.starter), starter: 1 - s.starter, recorded: false }))
  const mine = g.turn === HUMAN && !g.over
  const swapCard = canSwap(g, HUMAN)
  const shown = g.table.length ? g.table : (g.last?.cards ?? [])

  const status =
    res !== null
      ? `${t(res === 1 ? 'common.youWin' : res === -1 ? 'common.youLose' : 'common.draw')} · ${g.points[0]}–${g.points[1]}`
      : mine
        ? t('common.yourTurn')
        : t('common.thinking')

  return (
    <GameShell
      title={t('brisca.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(d) => restart(d)}
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
      <Scoreboard tally={st.tally} />
      <div className="scard-table">
        <div className="scard-seat">
          {t('common.machine')} · {t('cards.points', { n: g.points[1] })}
          <div className="scard-row small">
            {g.hands[1].map((c) => (
              <SpanishCard key={cardKey(c)} hidden={!g.over} card={c} />
            ))}
          </div>
        </div>
        <div className="scard-center">
          <div className="scard-stock">
            {g.muestra && <SpanishCard card={g.muestra} label={name(g.muestra)} />}
            <span className="pill">{t('cards.stock', { n: stockSize(g) })}</span>
            <span className="pill">{t('cards.trump', { suit: t(`cards.suit${g.trump}` as 'cards.suit0') })}</span>
          </div>
          <div className={`scard-trick ${g.table.length ? '' : 'done'}`}>
            {shown.map((c) => (
              <SpanishCard key={cardKey(c)} card={c} label={name(c)} />
            ))}
          </div>
        </div>
        <div className="scard-seat">
          {t('common.you')} · {t('cards.points', { n: g.points[0] })}
        </div>
      </div>
      <div className="scard-row hand">
        {sortHand(g.hands[HUMAN], trickStrength).map((c) => (
          <SpanishCard
            key={cardKey(c)}
            card={c}
            label={name(c)}
            held={!!swapCard && sameCard(c, swapCard)}
            onClick={mine ? () => setSt((s) => ({ ...s, game: play(s.game, c) ?? s.game })) : undefined}
          />
        ))}
      </div>
      <div className="dom-actions">
        {swapCard && (
          <button type="button" className="secondary" onClick={() => setSt((s) => ({ ...s, game: swap(s.game, HUMAN) ?? s.game }))}>
            {t('cards.swap', { card: name(swapCard) })}
          </button>
        )}
        {g.over && (
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
