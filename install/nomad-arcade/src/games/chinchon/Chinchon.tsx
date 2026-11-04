import { useEffect, useState } from 'react'
import { GameShell, Segmented, SpanishCard } from '../../components'
import { useI18n } from '../../i18n'
import { type SCard, cardKey, sameCard } from '../../lib/spanish'
import { useSpanishName } from '../../lib/spanishNames'
import { usePersistentState } from '../../lib/storage'
import {
  CLOSE_LIMIT,
  type Difficulty,
  OUT_OVER,
  type State,
  type Variant,
  aiDiscard,
  aiDraw,
  arrange,
  canClose,
  canDiscard,
  close,
  discard,
  drawDiscard,
  drawStock,
  newMatch,
  nextRound,
} from './logic'

const HUMAN = 0
type Saved = { game: State; players: number; variant: Variant; difficulty: Difficulty; matches: number; won: number; recorded: boolean }

/** Cards laid out as the best melds, then what is left unmatched. */
function Arranged({ cards, onPick, isActive, name }: {
  cards: SCard[]
  onPick?: (c: SCard) => void
  isActive?: (c: SCard) => boolean
  name: (c: SCard) => string
}) {
  const a = arrange(cards)
  const card = (c: SCard) => (
    <SpanishCard
      key={cardKey(c)}
      card={c}
      label={name(c)}
      dim={!!isActive && !isActive(c)}
      onClick={onPick && (!isActive || isActive(c)) ? () => onPick(c) : undefined}
    />
  )
  return (
    <div className="scard-row hand">
      {a.melds.map((m, i) => (
        <div key={i} className="scard-meld">
          {m.map(card)}
        </div>
      ))}
      {a.loose.length > 0 && <div className="scard-loose">{a.loose.map(card)}</div>}
    </div>
  )
}

export default function Chinchon() {
  const { t } = useI18n()
  const name = useSpanishName()
  const [st, setSt] = usePersistentState<Saved>('chinchon', () => ({
    game: newMatch(Math.random, 2, 'classic'), players: 2, variant: 'classic', difficulty: 'medium', matches: 0, won: 0, recorded: false,
  }))
  const [closing, setClosing] = useState(false)
  const g = st.game
  const mine = !g.round && g.turn === HUMAN && !g.out[HUMAN]

  useEffect(() => {
    if (g.round || g.turn === HUMAN) return
    const id = setTimeout(() => {
      setSt((s) => {
        const game = s.game.phase === 'draw' ? aiDraw(s.game, s.difficulty, Math.random) : aiDiscard(s.game, s.difficulty, Math.random)
        return { ...s, game }
      })
    }, 700)
    return () => clearTimeout(id)
  }, [g, setSt])

  // When you are out, the bots finish the match between themselves.
  useEffect(() => {
    if (!g.round || g.winner !== null || !g.out[HUMAN]) return
    const id = setTimeout(() => setSt((s) => ({ ...s, game: nextRound(s.game, Math.random) })), 2500)
    return () => clearTimeout(id)
  }, [g, setSt])

  useEffect(() => {
    if (g.winner === null || st.recorded) return
    setSt((s) => ({ ...s, recorded: true, matches: s.matches + 1, won: s.won + (g.winner === HUMAN ? 1 : 0) }))
  }, [g.winner, st.recorded, setSt])

  const restart = (patch: Partial<Pick<Saved, 'players' | 'variant' | 'difficulty'>> = {}) => {
    setClosing(false)
    setSt((s) => {
      const next = { ...s, ...patch }
      return { ...next, game: newMatch(Math.random, next.players, next.variant), recorded: false }
    })
  }
  const update = (f: (game: State) => State | null) => setSt((s) => ({ ...s, game: f(s.game) ?? s.game }))

  const hand = g.hands[HUMAN]
  const closable = mine && g.phase === 'discard' ? hand.filter((c) => canClose(g, c)) : []
  const pick = (c: SCard) => {
    if (closing && closable.some((x) => sameCard(x, c))) update((game) => close(game, c))
    else update((game) => discard(game, c))
    setClosing(false)
  }
  const top = g.discard.at(-1)
  const seatName = (p: number) => (p === HUMAN ? t('common.you') : t('chinchon.bot', { n: p }))

  let status: string
  if (g.winner !== null) status = g.winner === HUMAN ? t('chinchon.matchWon') : t('chinchon.matchLost', { name: seatName(g.winner) })
  else if (g.round)
    status =
      g.round.closer === HUMAN
        ? t(g.round.chinchon ? 'chinchon.youChinchon' : 'chinchon.youClosed')
        : t(g.round.chinchon ? 'chinchon.chinchon' : 'chinchon.closed', { name: seatName(g.round.closer) })
  else if (g.out[HUMAN]) status = t('chinchon.youAreOut')
  else if (!mine) status = t('chinchon.turn', { name: seatName(g.turn) })
  else status = g.phase === 'draw' ? t('chinchon.draw') : closing ? t('chinchon.pickClose') : t('chinchon.discard')

  return (
    <GameShell
      title={t('chinchon.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('chinchon.players')}
            value={String(st.players) as '2' | '3' | '4'}
            onChange={(v) => restart({ players: Number(v) })}
            options={['2', '3', '4'].map((v) => ({ value: v as '2' | '3' | '4', label: v }))}
          />
          <Segmented
            label={t('cards.variant')}
            value={st.variant}
            onChange={(variant) => restart({ variant })}
            options={[
              { value: 'classic', label: t('chinchon.classic') },
              { value: 'jokers', label: t('chinchon.jokers') },
            ]}
          />
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(difficulty) => restart({ difficulty })}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <span className="pill">
            {t('common.wins')}: <b>{st.won}</b> / {st.matches}
          </span>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('chinchon.rules', { n: CLOSE_LIMIT, out: OUT_OVER })}</p>
      <div className="scard-table">
        <div className="scard-opponents">
          {g.hands.map((h, p) =>
            p === HUMAN ? null : (
              <div key={p} className={`scard-seat ${g.turn === p && !g.round ? 'active' : ''} ${g.out[p] ? 'out' : ''}`}>
                <b>{seatName(p)}</b> · {g.scores[p]} {t('cards.pts')}
                {g.out[p] ? ` · ${t('chinchon.out')}` : g.round ? '' : ` · ${t('cards.count', { n: h.length })}`}
                {g.round && !g.out[p] && (
                  <>
                    <Arranged cards={h} name={name} />
                    <span className="pill">+{g.round.added[p]}</span>
                  </>
                )}
              </div>
            ),
          )}
        </div>
        <div className="scard-stock">
          <button type="button" className="pcard back" aria-label={t('chinchon.takeStock')} disabled={!mine || g.phase !== 'draw'} onClick={() => update(drawStock)} />
          <span className="pill">{t('cards.stock', { n: g.deck.length })}</span>
          {top ? (
            <SpanishCard card={top} label={name(top)} held={mine && g.phase === 'draw'} onClick={mine && g.phase === 'draw' ? () => update(drawDiscard) : undefined} />
          ) : (
            <div className="pcard slot" />
          )}
        </div>
      </div>
      <div className="scard-seat">
        <b>{t('common.you')}</b> · {g.scores[HUMAN]} {t('cards.pts')}
        {g.round && !g.out[HUMAN] && <span className="pill">+{g.round.added[HUMAN]}</span>}
        {!g.round && hand.length === 7 && <span className="pill">{t('chinchon.loose', { n: arrange(hand).points })}</span>}
      </div>
      {!g.out[HUMAN] && (
        <Arranged
          cards={hand}
          name={name}
          onPick={mine && g.phase === 'discard' ? pick : undefined}
          isActive={mine && g.phase === 'discard' ? (c) => (closing ? closable.some((x) => sameCard(x, c)) : canDiscard(g, c)) : undefined}
        />
      )}
      <div className="dom-actions">
        {closable.length > 0 && (
          <button type="button" className={closing ? 'secondary' : 'primary'} onClick={() => setClosing(!closing)}>
            {closing ? t('chinchon.cancelClose') : t('chinchon.close')}
          </button>
        )}
        {g.round && g.winner === null && !g.out[HUMAN] && (
          <button type="button" className="primary" onClick={() => update((game) => nextRound(game, Math.random))}>
            {t('chinchon.nextRound')}
          </button>
        )}
        {g.winner !== null && (
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
