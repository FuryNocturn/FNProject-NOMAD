import { useEffect, useState } from 'react'
import { GameShell, PlayingCard, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import type { Category } from './hands'
import { type Table, type Variant, act, botAction, legalActions, newTable, startHand } from './table'
import { PAYTABLE, type Round, dealRound, draw, payline, payout } from './video'

type Mode = Variant | 'video'
const HUMAN = 0

function TableGame({ variant }: { variant: Variant }) {
  const { t } = useI18n()
  const [table, setTable] = usePersistentState<Table>(`poker-${variant}`, () => newTable(variant))
  const [raise, setRaise] = useState(0)
  const busy = !table.awards && table.toAct >= 0
  const myTurn = busy && table.toAct === HUMAN
  const la = myTurn ? legalActions(table) : null
  const pot = table.seats.reduce((s, x) => s + x.total, 0)
  const broke = table.seats[HUMAN].stack <= 0 && !!table.awards
  const alone = table.seats.filter((s, i) => i !== HUMAN && s.stack > 0).length === 0

  useEffect(() => setRaise(la?.minTo ?? 0), [la?.minTo])

  // Computer seats act one after another with a short pause.
  useEffect(() => {
    if (!busy || table.toAct === HUMAN) return
    const id = setTimeout(() => setTable((tb) => (tb.toAct > 0 && !tb.awards ? act(tb, botAction(tb, Math.random)) : tb)), 700)
    return () => clearTimeout(id)
  }, [table, busy, setTable])

  const handName = (c: Category) => t(`poker.hand.${c}` as 'poker.hand.pair')
  const seatName = (i: number) => (i === HUMAN ? t('common.you') : t('poker.bot', { n: i }))
  const showCards = (i: number) => i === HUMAN || (table.street === 'showdown' && !table.seats[i].folded)

  const status = table.awards
    ? table.awards
        .map((a) => `${seatName(a.seat)} +${a.amount}${a.hand ? ` (${handName(a.hand.category)})` : ''}`)
        .join(' · ')
    : myTurn
      ? t('common.yourTurn')
      : t('poker.waiting', { name: seatName(table.toAct) })

  return (
    <>
      <div className="poker-status" role="status">
        {status}
      </div>
      <div className="poker-table">
        <div className="poker-board">
          {Array.from({ length: 5 }, (_, i) => (table.board[i] ? <PlayingCard key={i} card={table.board[i]} /> : <div key={i} className="pcard slot" />))}
          <div className="poker-pot">
            {t('poker.pot')}: <b>{pot}</b>
          </div>
        </div>
        <div className="poker-seats">
          {table.seats.map((s, i) => (
            <div
              key={i}
              className={`poker-seat ${i === table.toAct ? 'acting' : ''} ${s.folded || s.out ? 'folded' : ''} ${i === HUMAN ? 'me' : ''}`}
            >
              <div className="poker-seat-head">
                <b>{seatName(i)}</b>
                {i === table.dealer && <span className="dealer">D</span>}
                <span>{s.stack}</span>
              </div>
              <div className="poker-hole">
                {s.hole.map((c, k) => (
                  <PlayingCard key={k} card={c} hidden={!showCards(i)} />
                ))}
              </div>
              <div className="poker-seat-foot">
                {s.bet > 0 && <span className="chip">{s.bet}</span>}
                {table.lastActions[i] && <small>{t(`poker.act.${table.lastActions[i]}` as 'poker.act.fold')}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="poker-actions">
        {la && (
          <>
            <button type="button" className="secondary" onClick={() => setTable(act(table, { type: 'fold' }))}>
              {t('poker.fold')}
            </button>
            <button type="button" className="secondary" onClick={() => setTable(act(table, { type: la.canCheck ? 'check' : 'call' }))}>
              {la.canCheck ? t('poker.check') : `${t('poker.call')} ${la.toCall}`}
            </button>
            {la.canRaise && (
              <>
                <input
                  type="range"
                  min={la.minTo}
                  max={la.maxTo}
                  step={10}
                  value={raise}
                  onChange={(e) => setRaise(Number(e.target.value))}
                  aria-label={t('poker.raise')}
                />
                <button type="button" className="primary" onClick={() => setTable(act(table, { type: 'raise', to: raise }))}>
                  {raise >= la.maxTo ? t('poker.allIn') : `${t('poker.raiseTo')} ${raise}`}
                </button>
              </>
            )}
          </>
        )}
        {!busy && !broke && !alone && (
          <button type="button" className="primary" onClick={() => setTable(startHand(table, Math.random))}>
            {t('poker.nextHand')}
          </button>
        )}
        {(broke || alone) && (
          <>
            <span className="pill">{alone ? t('common.youWin') : t('common.youLose')}</span>
            <button type="button" className="primary" onClick={() => setTable(startHand(newTable(variant), Math.random))}>
              {t('poker.newTable')}
            </button>
          </>
        )}
      </div>
    </>
  )
}

type VideoState = { credits: number; bet: number; round: Round | null }

function VideoPoker() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<VideoState>('poker-video', () => ({ credits: 100, bet: 1, round: null }))
  const r = st.round
  const done = !r || r.phase === 'done'
  const line = r && r.phase === 'done' ? payline(r.hand) : null
  const won = r && r.phase === 'done' ? payout(r.hand, r.bet) : 0

  const dealOrDraw = () => {
    if (done) {
      if (st.credits < st.bet) return
      setSt({ ...st, credits: st.credits - st.bet, round: dealRound(Math.random, st.bet) })
    } else {
      const finished = draw(r!)
      setSt({ ...st, round: finished, credits: st.credits + payout(finished.hand, finished.bet) })
    }
  }

  return (
    <>
      <div className="poker-status" role="status">
        {r?.phase === 'done' ? (won ? `${t(`poker.pay.${line}` as 'poker.pay.flush')}: +${won}` : t('poker.noWin')) : r ? t('poker.hold') : t('poker.videoHelp')}
      </div>
      <table className="paytable">
        <tbody>
          {PAYTABLE.map((p) => (
            <tr key={p.id} className={line === p.id ? 'hit' : ''}>
              <td>{t(`poker.pay.${p.id}` as 'poker.pay.flush')}</td>
              {[1, 2, 3, 4, 5].map((b) => (
                <td key={b} className={b === st.bet ? 'bet' : ''}>
                  {p.id === 'royalFlush' && b === 5 ? 4000 : p.pays * b}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="video-hand">
        {(r?.hand ?? Array(5).fill(undefined)).map((c, i) => (
          <div key={i} className="video-slot">
            <PlayingCard
              card={c}
              hidden={!c}
              held={r?.held[i]}
              onClick={r?.phase === 'draw' ? () => setSt({ ...st, round: { ...r, held: r.held.map((h, k) => (k === i ? !h : h)) } }) : undefined}
            />
            <small>{r?.held[i] ? t('poker.held') : ''}</small>
          </div>
        ))}
      </div>
      <div className="poker-actions">
        <span className="pill">
          {t('poker.credits')}: <b>{st.credits}</b>
        </span>
        <Segmented
          label={t('poker.bet')}
          value={String(st.bet) as '1'}
          onChange={(b) => done && setSt({ ...st, bet: Number(b) })}
          options={[1, 2, 3, 4, 5].map((b) => ({ value: String(b) as '1', label: String(b) }))}
        />
        <button type="button" className="primary" onClick={dealOrDraw} disabled={done && st.credits < st.bet}>
          {done ? t('poker.deal') : t('poker.draw')}
        </button>
        {st.credits < 1 && done && (
          <button type="button" className="secondary" onClick={() => setSt({ credits: 100, bet: 1, round: null })}>
            {t('poker.refill')}
          </button>
        )}
      </div>
    </>
  )
}

export default function Poker() {
  const { t } = useI18n()
  const [mode, setMode] = usePersistentState<Mode>('poker-mode', () => 'holdem')
  return (
    <GameShell
      title={t('poker.name')}
      controls={
        <Segmented
          label={t('poker.variant')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'holdem', label: "Texas Hold'em" },
            { value: 'omaha', label: 'Omaha' },
            { value: 'video', label: t('poker.video') },
          ]}
        />
      }
    >
      {mode === 'video' ? <VideoPoker /> : <TableGame key={mode} variant={mode} />}
    </GameShell>
  )
}
