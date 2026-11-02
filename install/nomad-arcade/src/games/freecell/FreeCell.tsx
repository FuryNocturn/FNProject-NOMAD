import { useRef, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { randomInt } from '../../lib/rng'
import { usePersistentState } from '../../lib/storage'
import { CardFace } from '../solitaire/Solitaire'
import { SUITS } from '../solitaire/logic'
import { type Loc, type State, autoPlay, isWon, move, newGame, runStart } from './logic'

const same = (a: Loc | null, b: Loc) => !!a && a.k === b.k && a.i === b.i

export default function FreeCell() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('freecell', () => autoPlay(newGame(randomInt(Math.random, 32000) + 1)))
  const [sel, setSel] = useState<Loc | null>(null)
  const [dealInput, setDealInput] = useState('')
  const history = useRef<State[]>([])
  const won = isWon(st)

  const commit = (next: State | null) => {
    if (!next) return false
    history.current = [...history.current.slice(-199), st]
    setSt(autoPlay(next))
    setSel(null)
    return true
  }

  const target = (to: Loc) => !!sel && !same(sel, to) && commit(move(st, sel, to))

  // Double click: to a foundation if possible, otherwise to a free cell.
  const quick = (from: Loc) => {
    for (let i = 0; i < 4; i++) if (commit(move(st, from, { k: 'found', i }))) return
    const cell = st.cells.findIndex((c) => !c)
    if (cell >= 0) commit(move(st, from, { k: 'cell', i: cell }))
  }

  const start = (n: number) => {
    history.current = []
    setSel(null)
    setSt(autoPlay(newGame(n)))
  }

  return (
    <GameShell
      title={t('freecell.name')}
      status={won ? t('common.youWin') : `${t('freecell.deal')} #${st.deal} · ${t('common.moves')}: ${st.moves}`}
      controls={
        <>
          <button type="button" className="secondary" onClick={() => {
            const prev = history.current.pop()
            if (prev) (setSt(prev), setSel(null))
          }}>
            ↶ {t('common.undo')}
          </button>
          <form
            className="deal-form"
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(dealInput)
              if (n >= 1 && n <= 32000) start(n)
            }}
          >
            <input type="number" min={1} max={32000} placeholder="#" value={dealInput} onChange={(e) => setDealInput(e.target.value)} aria-label={t('freecell.deal')} />
            <button type="submit" className="secondary">{t('freecell.play')}</button>
          </form>
          <button type="button" className="primary" onClick={() => start(randomInt(Math.random, 32000) + 1)}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('freecell.help')}</p>
      <div className="sol-table freecell">
        <div className="fc-top">
          {st.cells.map((c, i) =>
            c ? (
              <CardFace key={`c${i}`} card={c} selected={same(sel, { k: 'cell', i })} onClick={() => target({ k: 'cell', i }) || setSel(same(sel, { k: 'cell', i }) ? null : { k: 'cell', i })} onDoubleClick={() => quick({ k: 'cell', i })} />
            ) : (
              <button key={`c${i}`} type="button" className="card empty" onClick={() => target({ k: 'cell', i })} />
            )
          )}
          {st.foundations.map((f, i) =>
            f.length ? (
              <CardFace key={`f${i}`} card={f[f.length - 1]} onClick={() => target({ k: 'found', i })} />
            ) : (
              <button key={`f${i}`} type="button" className="card empty" onClick={() => target({ k: 'found', i })}>
                {SUITS[i]}
              </button>
            )
          )}
        </div>
        <div className="fc-cols">
          {st.columns.map((col, i) => (
            <div key={i} className="sol-pile">
              {col.length === 0 && <button type="button" className="card empty" onClick={() => target({ k: 'col', i })} />}
              {col.map((c, index) => (
                <div key={index} className="sol-slot up">
                  <CardFace
                    card={c}
                    selected={sel?.k === 'col' && sel.i === i && index >= (sel.index ?? col.length - 1)}
                    onClick={() => {
                      if (target({ k: 'col', i })) return
                      if (index < runStart(col)) return setSel(null)
                      setSel(same(sel, { k: 'col', i }) && sel?.k === 'col' && sel.index === index ? null : { k: 'col', i, index })
                    }}
                    onDoubleClick={index === col.length - 1 ? () => quick({ k: 'col', i }) : undefined}
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
