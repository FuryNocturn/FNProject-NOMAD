import { useRef, useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { CardFace } from '../solitaire/Solitaire'
import { type State, type Suits, canDeal, canMove, deal, dealRow, isWon, move, runStart } from './logic'

export default function Spider() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('spider', () => deal(Math.random, 1))
  const [sel, setSel] = useState<{ col: number; index: number } | null>(null)
  const history = useRef<State[]>([])
  const won = isWon(st)

  const commit = (next: State | null) => {
    if (!next) return false
    history.current = [...history.current.slice(-199), st]
    setSt(next)
    setSel(null)
    return true
  }

  const clickCard = (col: number, index: number) => {
    if (sel && sel.col !== col && commit(move(st, sel.col, sel.index, col))) return
    const card = st.columns[col][index]
    if (!card.up || index < runStart(st.columns[col])) return setSel(null)
    setSel(sel?.col === col && sel.index === index ? null : { col, index })
  }

  // A double click sends the run to the best column: a same-suit card above it, else any.
  const autoMove = (col: number, index: number) => {
    const run = st.columns[col][index]
    const targets = st.columns
      .map((c, i) => ({ i, top: c[c.length - 1] }))
      .filter(({ i }) => canMove(st, col, index, i))
      .sort((a, b) => Number(b.top?.s === run.s) - Number(a.top?.s === run.s) || Number(!!b.top) - Number(!!a.top))
    if (targets.length) commit(move(st, col, index, targets[0].i))
  }

  const restart = (suits: Suits = st.suits) => {
    history.current = []
    setSel(null)
    setSt(deal(Math.random, suits))
  }

  return (
    <GameShell
      title={t('spider.name')}
      status={won ? t('common.youWin') : `${t('common.score')}: ${st.score} · ${t('spider.done', { n: st.done })}`}
      controls={
        <>
          <Segmented
            label={t('spider.suits')}
            value={String(st.suits) as '1'}
            onChange={(v) => restart(Number(v) as Suits)}
            options={[
              { value: '1', label: '♠' },
              { value: '2' as '1', label: '♠♥' },
              { value: '4' as '1', label: '♠♥♦♣' },
            ]}
          />
          <button type="button" className="secondary" onClick={() => {
            const prev = history.current.pop()
            if (prev) (setSt(prev), setSel(null))
          }}>
            ↶ {t('common.undo')}
          </button>
          <button type="button" className="secondary" onClick={() => commit(dealRow(st))} disabled={!canDeal(st)}>
            🂠 {t('spider.deal', { n: st.stock.length / 10 })}
          </button>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('spider.help')}</p>
      <div className="sol-table spider">
        <div className="spider-cols">
          {st.columns.map((col, i) => (
            <div key={i} className="sol-pile">
              {col.length === 0 && (
                <button type="button" className="card empty" onClick={() => sel && commit(move(st, sel.col, sel.index, i))} aria-label="—" />
              )}
              {col.map((c, index) => (
                <div key={index} className={`sol-slot ${c.up ? 'up' : 'down'}`}>
                  <CardFace
                    card={c}
                    selected={sel?.col === i && index >= sel.index}
                    onClick={() => clickCard(i, index)}
                    onDoubleClick={() => autoMove(i, index)}
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
