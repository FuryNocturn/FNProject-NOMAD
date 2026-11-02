import { GameShell, PlayingCard } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type State, canDouble, canSplit, deal, double, hit, newState, split, stand, total } from './logic'

const BETS = [10, 25, 50, 100]

type Saved = { game: State; bet: number }

export default function Blackjack() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('blackjack', () => ({ game: newState(Math.random), bet: 25 }))
  const g = st.game
  const playing = g.phase === 'play'
  const set = (game: State) => setSt({ ...st, game })

  const dealerShown = playing ? [g.dealer[0]] : g.dealer
  const status = playing
    ? t('blackjack.yourMove')
    : g.results.length
      ? g.results.map((r) => `${t(`blackjack.${r.outcome}`)} (${r.delta >= 0 ? '+' : ''}${r.delta})`).join(' · ')
      : t('blackjack.placeBet')

  return (
    <GameShell
      title={t('blackjack.name')}
      status={status}
      controls={
        <span className="pill">
          {t('poker.credits')}: <b>{g.chips}</b>
        </span>
      }
    >
      <div className="bj-table">
        <div className="bj-row">
          <span className="bj-label">
            {t('blackjack.dealer')} {g.dealer.length ? `· ${total(dealerShown).value}` : ''}
          </span>
          <div className="bj-cards">
            {g.dealer.map((c, i) => (
              <PlayingCard key={i} card={c} hidden={playing && i === 1} />
            ))}
          </div>
        </div>
        {g.hands.map((h, i) => (
          <div key={i} className={`bj-row ${playing && i === g.active ? 'active' : ''}`}>
            <span className="bj-label">
              {g.hands.length > 1 ? `${t('blackjack.hand')} ${i + 1}` : t('common.you')} · {total(h.cards).value} · {h.bet}
            </span>
            <div className="bj-cards">
              {h.cards.map((c, k) => (
                <PlayingCard key={k} card={c} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="poker-actions">
        {playing ? (
          <>
            <button type="button" className="primary" onClick={() => set(hit(g))}>
              {t('blackjack.hit')}
            </button>
            <button type="button" className="secondary" onClick={() => set(stand(g))}>
              {t('blackjack.stand')}
            </button>
            <button type="button" className="secondary" onClick={() => set(double(g))} disabled={!canDouble(g)}>
              {t('blackjack.double')}
            </button>
            <button type="button" className="secondary" onClick={() => set(split(g))} disabled={!canSplit(g)}>
              {t('blackjack.split')}
            </button>
          </>
        ) : (
          <>
            <span className="segmented-label">{t('poker.bet')}</span>
            {BETS.map((b) => (
              <button
                key={b}
                type="button"
                className={`chip-btn ${st.bet === b ? 'active' : ''}`}
                onClick={() => setSt({ ...st, bet: b })}
                disabled={b > g.chips}
              >
                {b}
              </button>
            ))}
            <button type="button" className="primary" onClick={() => set(deal(g, Math.min(st.bet, g.chips), Math.random))} disabled={g.chips <= 0}>
              {t('poker.deal')}
            </button>
            {g.chips <= 0 && (
              <button type="button" className="secondary" onClick={() => set(newState(Math.random))}>
                {t('poker.refill')}
              </button>
            )}
          </>
        )}
      </div>
    </GameShell>
  )
}
