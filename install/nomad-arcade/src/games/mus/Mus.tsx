import { useEffect, useState } from 'react'
import { GameShell, Segmented, SpanishCard } from '../../components'
import { useI18n } from '../../i18n'
import { type SCard, cardKey, sameCard } from '../../lib/spanish'
import { useSpanishName } from '../../lib/spanishNames'
import { usePersistentState } from '../../lib/storage'
import {
  type Act,
  type Difficulty,
  type State,
  type Variant,
  act,
  aiAct,
  isHumanTurn,
  newGame,
  nextHand,
  options,
  sena,
  swapCards,
  team,
} from './logic'

const HUMAN = 0
const PARTNER = 2
type Saved = { game: State; variant: Variant; difficulty: Difficulty; matches: number; won: number; recorded: boolean }

export default function Mus() {
  const { t } = useI18n()
  const name = useSpanishName()
  const [st, setSt] = usePersistentState<Saved>('mus', () => ({
    game: newGame(Math.random, 'ocho', 'medium'), variant: 'ocho', difficulty: 'medium', matches: 0, won: 0, recorded: false,
  }))
  const [chosen, setChosen] = useState<SCard[]>([])
  const g = st.game

  useEffect(() => {
    if (g.winner !== null || g.phase === 'end' || isHumanTurn(g)) return
    const id = setTimeout(() => setSt((s) => ({ ...s, game: act(s.game, aiAct(s.game, Math.random)) ?? s.game })), 900)
    return () => clearTimeout(id)
  }, [g, setSt])

  useEffect(() => {
    if (g.winner === null || st.recorded) return
    setSt((s) => ({ ...s, recorded: true, matches: s.matches + 1, won: s.won + (g.winner === team(HUMAN) ? 1 : 0) }))
  }, [g.winner, st.recorded, setSt])

  const restart = (patch: Partial<Pick<Saved, 'variant' | 'difficulty'>> = {}) => {
    setChosen([])
    setSt((s) => {
      const next = { ...s, ...patch }
      return { ...next, game: newGame(Math.random, next.variant, next.difficulty, Math.floor(Math.random() * 4)), recorded: false }
    })
  }
  const say = (a: Act) => setSt((s) => ({ ...s, game: act(s.game, a) ?? s.game }))
  const throwCards = () => {
    setSt((s) => ({ ...s, game: swapCards(s.game, chosen, Math.random) ?? s.game }))
    setChosen([])
  }
  const toggle = (c: SCard) => setChosen((cur) => (cur.some((x) => sameCard(x, c)) ? cur.filter((x) => !sameCard(x, c)) : [...cur, c]))

  const mine = isHumanTurn(g)
  const opts = mine && g.phase !== 'discard' ? options(g) : []
  const lance = g.lances[0]
  const shown = g.phase === 'end'
  const seat = (p: number) => t(`mus.player${p}` as 'mus.player0')
  const saidLabel = (a: Act | null) => {
    if (!a) return ''
    if (a.t === 'envido') return t('mus.envido', { n: a.n })
    return t(`mus.${a.t}` as 'mus.mus')
  }

  let status: string
  if (g.winner !== null) status = t(g.winner === team(HUMAN) ? 'mus.gameWon' : 'mus.gameLost')
  else if (g.phase === 'end') status = t('mus.handOver')
  else if (g.phase === 'discard') status = t('mus.pickDiscard')
  else if (g.phase === 'mus') status = mine ? t('mus.musOrCut') : t('mus.speaking', { name: seat(g.speaker) })
  else {
    const where = t(`mus.lance.${lance}` as 'mus.lance.grande')
    const bet = g.bet ? (g.bet.ordago ? t('mus.ordagoOnTable') : t('mus.onTable', { n: g.bet.amount })) : ''
    status = `${where}${bet ? ' · ' + bet : ''} · ${mine ? t('common.yourTurn') : t('mus.speaking', { name: seat(g.speaker) })}`
  }

  const Seat = ({ p }: { p: number }) => (
    <div className={`mus-seat seat${p} ${g.speaker === p && !shown ? 'active' : ''}`}>
      <b>{seat(p)}</b>
      {p === PARTNER && g.phase === 'lance' && <span className="pill">{t('mus.sena')}: {t(`mus.sena.${sena(g, PARTNER)}` as 'mus.sena.nada')}</span>}
      <div className="scard-row small">
        {g.hands[p].map((c) => (
          <SpanishCard key={cardKey(c)} card={c} hidden={!shown} label={shown ? name(c) : undefined} />
        ))}
      </div>
      {g.said[p] && !shown && <span className="mus-said">{saidLabel(g.said[p])}</span>}
    </div>
  )

  return (
    <GameShell
      title={t('mus.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('cards.variant')}
            value={st.variant}
            onChange={(variant) => restart({ variant })}
            options={[
              { value: 'ocho', label: t('mus.ocho') },
              { value: 'cuatro', label: t('mus.cuatro') },
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
            {t('mus.us')}: <b>{g.scores[0]}</b> · {t('mus.them')}: <b>{g.scores[1]}</b> / {g.target}
          </span>
          <span className="pill">
            {t('common.wins')}: <b>{st.won}</b> / {st.matches}
          </span>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="mus-table">
        <Seat p={2} />
        <Seat p={3} />
        <div className="mus-center">
          <span className="pill">{t('mus.mano', { name: seat(g.mano) })}</span>
          {shown && g.breakdown && (
            <ul className="mus-breakdown">
              {g.breakdown.map((b, i) => (
                <li key={i}>
                  {t(`mus.lance.${b.lance}` as 'mus.lance.grande')}: {t(b.team === 0 ? 'mus.us' : 'mus.them')} +{b.points + b.bonus}
                </li>
              ))}
              {g.results
                .filter((r) => r.kind === 'noquiero')
                .map((r, i) => (
                  <li key={`n${i}`}>
                    {t(`mus.lance.${r.lance}` as 'mus.lance.grande')}: {t('mus.refused')} · {t(r.team === 0 ? 'mus.us' : 'mus.them')} +{r.amount}
                  </li>
                ))}
            </ul>
          )}
        </div>
        <Seat p={1} />
      </div>
      <div className="scard-seat">
        <b>{t('common.you')}</b>
        {g.said[HUMAN] && !shown && <span className="mus-said">{saidLabel(g.said[HUMAN])}</span>}
      </div>
      <div className="scard-row hand">
        {g.hands[HUMAN].map((c) => (
          <SpanishCard
            key={cardKey(c)}
            card={c}
            label={name(c)}
            held={chosen.some((x) => sameCard(x, c))}
            onClick={g.phase === 'discard' ? () => toggle(c) : undefined}
          />
        ))}
      </div>
      <div className="dom-actions">
        {g.phase === 'discard' && (
          <button type="button" className="primary" disabled={!chosen.length} onClick={throwCards}>
            {t('mus.discard', { n: chosen.length })}
          </button>
        )}
        {opts.includes('mus') && (
          <>
            <button type="button" className="primary" onClick={() => say({ t: 'mus' })}>{t('mus.mus')}</button>
            <button type="button" className="secondary" onClick={() => say({ t: 'corto' })}>{t('mus.corto')}</button>
          </>
        )}
        {opts.includes('paso') && <button type="button" className="secondary" onClick={() => say({ t: 'paso' })}>{t('mus.paso')}</button>}
        {opts.includes('quiero') && <button type="button" className="primary" onClick={() => say({ t: 'quiero' })}>{t('mus.quiero')}</button>}
        {opts.includes('noquiero') && <button type="button" className="secondary" onClick={() => say({ t: 'noquiero' })}>{t('mus.noquiero')}</button>}
        {opts.includes('envido') &&
          [2, 5].map((n) => (
            <button key={n} type="button" className="secondary" onClick={() => say({ t: 'envido', n })}>
              {t(g.bet ? 'mus.raise' : 'mus.envido', { n })}
            </button>
          ))}
        {opts.includes('ordago') && <button type="button" className="danger" onClick={() => say({ t: 'ordago' })}>{t('mus.ordago')}</button>}
        {g.phase === 'end' && g.winner === null && (
          <button type="button" className="primary" onClick={() => setSt((s) => ({ ...s, game: nextHand(s.game, Math.random) }))}>
            {t('mus.nextHand')}
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
