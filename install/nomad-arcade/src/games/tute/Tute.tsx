import { useEffect } from 'react'
import { GameShell, Segmented, SpanishCard } from '../../components'
import { useI18n } from '../../i18n'
import { cardKey, sameCard, sortHand, trickStrength } from '../../lib/spanish'
import { useSpanishName } from '../../lib/spanishNames'
import { usePersistentState } from '../../lib/storage'
import { type Difficulty, type State, aiChoose, aiSing, canSwap, deal, hasTute, legal, play, result, sing, singTute, singable, stockSize, swap } from './logic'

const HUMAN = 0
/** Hands to win the match. */
const MATCH = 3
type Saved = { game: State; difficulty: Difficulty; hands: [number, number]; matches: number; won: number; recorded: boolean; starter: number }

export default function Tute() {
  const { t } = useI18n()
  const name = useSpanishName()
  const [st, setSt] = usePersistentState<Saved>('tute', () => ({
    game: deal(Math.random), difficulty: 'medium', hands: [0, 0], matches: 0, won: 0, recorded: false, starter: 0,
  }))
  const g = st.game
  const res = result(g)

  useEffect(() => {
    if (g.over || g.turn === HUMAN) return
    const id = setTimeout(() => {
      setSt((s) => {
        let game = swap(s.game, 1) ?? s.game
        const sung = aiSing(game)
        // Show the cante for a moment before leading.
        if (sung) return { ...s, game: sung }
        game = play(game, aiChoose(game, s.difficulty, Math.random)) ?? game
        return { ...s, game }
      })
    }, 850)
    return () => clearTimeout(id)
  }, [g, setSt])

  // Count the hand once when it ends.
  useEffect(() => {
    if (res === null || st.recorded) return
    setSt((s) => {
      const hands: [number, number] = [s.hands[0] + (res === 1 ? 1 : 0), s.hands[1] + (res === -1 ? 1 : 0)]
      const done = hands[0] >= MATCH || hands[1] >= MATCH
      return { ...s, hands, recorded: true, matches: s.matches + (done ? 1 : 0), won: s.won + (done && hands[0] >= MATCH ? 1 : 0) }
    })
  }, [res, st.recorded, setSt])

  const matchOver = st.hands[0] >= MATCH || st.hands[1] >= MATCH
  const nextHand = () =>
    setSt((s) => ({
      ...s,
      game: deal(Math.random, 1 - s.starter),
      starter: 1 - s.starter,
      recorded: false,
      hands: matchOver ? [0, 0] : s.hands,
    }))
  const newMatch = (difficulty = st.difficulty) =>
    setSt((s) => ({ ...s, difficulty, game: deal(Math.random, 1 - s.starter), starter: 1 - s.starter, recorded: false, hands: [0, 0] }))

  const mine = g.turn === HUMAN && !g.over
  const allowed = mine ? legal(g) : []
  const swapCard = canSwap(g, HUMAN)
  const suits = singable(g, HUMAN)
  const tute = mine && g.canSing && !g.table.length && hasTute(g.hands[HUMAN])
  const shown = g.table.length ? g.table : (g.last?.cards ?? [])
  const suitName = (s: number) => t(`cards.suit${s}` as 'cards.suit0')
  const update = (f: (game: State) => State | null) => setSt((s) => ({ ...s, game: f(s.game) ?? s.game }))

  const cante = g.cante && t(g.cante.player === HUMAN ? 'tute.youSing' : 'tute.theySing', { n: g.cante.points, suit: suitName(g.cante.suit) })
  const status =
    res !== null
      ? (g.tute !== null ? t('tute.tute') + ' · ' : '') +
        `${t(res === 1 ? 'tute.handWon' : res === -1 ? 'tute.handLost' : 'common.draw')} · ${g.points[0]}–${g.points[1]}`
      : (cante ? cante + ' · ' : '') + (mine ? t('common.yourTurn') : t('common.thinking'))

  return (
    <GameShell
      title={t('tute.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(d) => newMatch(d)}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <span className="pill">
            {t('tute.hands')}: <b>{st.hands[0]}</b>–<b>{st.hands[1]}</b> / {MATCH}
          </span>
          <span className="pill">
            {t('common.wins')}: <b>{st.won}</b> / {st.matches}
          </span>
          <button type="button" className="primary" onClick={() => newMatch()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
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
            <span className="pill">{t('cards.trump', { suit: suitName(g.trump) })}</span>
            {stockSize(g) === 0 && !g.over && <span className="pill">{t('tute.arrastre')}</span>}
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
        {sortHand(g.hands[HUMAN], trickStrength).map((c) => {
          const ok = allowed.some((a) => sameCard(a, c))
          return (
            <SpanishCard
              key={cardKey(c)}
              card={c}
              label={name(c)}
              dim={mine && !ok}
              held={!!swapCard && sameCard(c, swapCard)}
              onClick={ok ? () => update((game) => play(game, c)) : undefined}
            />
          )
        })}
      </div>
      <div className="dom-actions">
        {tute && (
          <button type="button" className="primary" onClick={() => update((game) => singTute(game, HUMAN))}>
            {t('tute.singTute')}
          </button>
        )}
        {suits.map((s) => (
          <button key={s} type="button" className="primary" onClick={() => update((game) => sing(game, HUMAN, s))}>
            {t('tute.sing', { n: s === g.trump ? 40 : 20, suit: suitName(s) })}
          </button>
        ))}
        {swapCard && (
          <button type="button" className="secondary" onClick={() => update((game) => swap(game, HUMAN))}>
            {t('cards.swap', { card: name(swapCard) })}
          </button>
        )}
        {g.over && (
          <button type="button" className="primary" onClick={nextHand}>
            {matchOver ? t(st.hands[0] >= MATCH ? 'tute.matchWon' : 'tute.matchLost') + ' · ' + t('common.newGame') : t('tute.nextHand')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
