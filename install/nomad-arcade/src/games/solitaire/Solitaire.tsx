import { useEffect, useRef, useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import {
  type Card,
  type DrawCount,
  type Loc,
  RANKS,
  SUITS,
  type State,
  autoStep,
  canAutoFinish,
  deal,
  drawCards,
  isRed,
  isWon,
  move,
  toFoundation,
} from './logic'

export function CardFace({ card, selected, onClick, onDoubleClick }: {
  card: Card
  selected?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
}) {
  if (!card.up) return <div className="card back" onClick={onClick} />
  return (
    <button
      type="button"
      className={`card ${isRed(card) ? 'red' : 'black'} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span className="corner">
        {RANKS[card.r]}
        {SUITS[card.s]}
      </span>
      <span className="pip">{SUITS[card.s]}</span>
    </button>
  )
}

const sameLoc = (a: Loc | null, b: Loc) =>
  !!a && a.k === b.k && (a.k === 'waste' || (a as { i: number }).i === (b as { i: number }).i)

export default function Solitaire() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('solitaire', () => deal(Math.random, 1))
  const [sel, setSel] = useState<Loc | null>(null)
  const history = useRef<State[]>([])
  const won = isWon(st)

  const commit = (next: State | null) => {
    if (!next) return false
    history.current = [...history.current.slice(-199), st]
    setSt(next)
    setSel(null)
    return true
  }

  // "Finish" plays the remaining cards to the foundations one by one.
  const [finishing, setFinishing] = useState(false)
  useEffect(() => {
    if (!finishing) return
    const id = setTimeout(() => {
      const next = autoStep(st)
      if (next) setSt(next)
      else setFinishing(false)
    }, 90)
    return () => clearTimeout(id)
  }, [finishing, st, setSt])

  const restart = (draw: DrawCount = st.draw) => {
    history.current = []
    setSel(null)
    setFinishing(false)
    setSt(deal(Math.random, draw))
  }

  const target = (to: Loc) => {
    if (sel && !sameLoc(sel, to) && commit(move(st, sel, to))) return true
    return false
  }

  const clickTableau = (i: number, index: number) => {
    const card = st.tableau[i][index]
    if (!card?.up) return
    if (target({ k: 'tab', i })) return
    setSel(sameLoc(sel, { k: 'tab', i }) && (sel as { index?: number }).index === index ? null : { k: 'tab', i, index })
  }

  const status = won ? t('common.youWin') : `${t('common.moves')}: ${st.moves}`
  const wasteShown = st.waste.slice(-st.draw)

  return (
    <GameShell
      title={t('solitaire.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('solitaire.draw')}
            value={String(st.draw) as '1' | '3'}
            onChange={(d) => restart(Number(d) as DrawCount)}
            options={[
              { value: '1', label: t('solitaire.draw1') },
              { value: '3', label: t('solitaire.draw3') },
            ]}
          />
          <button
            type="button"
            onClick={() => {
              const prev = history.current.pop()
              if (prev) {
                setSt(prev)
                setSel(null)
              }
            }}
            className="secondary"
          >
            ↶ {t('common.undo')}
          </button>
          {canAutoFinish(st) && !won && (
            <button type="button" className="secondary" onClick={() => setFinishing(true)}>
              ⏩ {t('solitaire.finish')}
            </button>
          )}
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('solitaire.help')}</p>
      <div className="sol-table">
        <div className="sol-top">
          <button
            type="button"
            className={`card ${st.stock.length ? 'back' : 'empty'}`}
            aria-label={t('solitaire.stock')}
            onClick={() => commit(drawCards(st))}
          >
            {st.stock.length ? '' : '↻'}
          </button>
          <div className="sol-waste">
            {wasteShown.length === 0 && <div className="card empty" />}
            {wasteShown.map((c, k) => (
              <CardFace
                key={`${c.s}-${c.r}`}
                card={c}
                selected={k === wasteShown.length - 1 && sameLoc(sel, { k: 'waste' })}
                onClick={k === wasteShown.length - 1 ? () => setSel(sameLoc(sel, { k: 'waste' }) ? null : { k: 'waste' }) : undefined}
                onDoubleClick={() => commit(toFoundation(st, { k: 'waste' }))}
              />
            ))}
          </div>
          <div className="sol-spacer" />
          {st.foundations.map((pile, i) => {
            const top = pile[pile.length - 1]
            const loc: Loc = { k: 'found', i }
            return top ? (
              <CardFace
                key={i}
                card={top}
                selected={sameLoc(sel, loc)}
                onClick={() => target(loc) || setSel(sameLoc(sel, loc) ? null : loc)}
              />
            ) : (
              <button key={i} type="button" className="card empty" onClick={() => target(loc)}>
                {SUITS[i]}
              </button>
            )
          })}
        </div>
        <div className="sol-tableau">
          {st.tableau.map((pile, i) => (
            <div key={i} className="sol-pile">
              {pile.length === 0 && (
                <button type="button" className="card empty" onClick={() => target({ k: 'tab', i })} aria-label="K" />
              )}
              {pile.map((c, index) => (
                <div key={`${c.s}-${c.r}`} className={`sol-slot ${c.up ? 'up' : 'down'}`}>
                  <CardFace
                    card={c}
                    selected={
                      sel?.k === 'tab' && sel.i === i && (sel.index ?? pile.length - 1) <= index
                    }
                    onClick={() => clickTableau(i, index)}
                    onDoubleClick={index === pile.length - 1 ? () => commit(toFoundation(st, { k: 'tab', i })) : undefined}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </GameShell>
  )
}
