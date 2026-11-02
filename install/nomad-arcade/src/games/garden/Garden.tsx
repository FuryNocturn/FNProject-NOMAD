import { useEffect, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { COLS, LANES, PLANTS, type PlantKind, type State, canPlant, collect, dig, newGame, plant, step } from './logic'

const ICON: Record<PlantKind, string> = { sunflower: '🌻', shooter: '🌱', walnut: '🌰', cherry: '🍒' }
const ZOMBIE_HAT = { normal: '', cone: '🔺', bucket: '🪣' }
const TICK = 0.1

type Saved = { level: number; best: number }

export default function Garden() {
  const { t } = useI18n()
  const [saved, setSaved] = usePersistentState<Saved>('garden', () => ({ level: 1, best: 0 }))
  const [st, setSt] = useState<State>(() => newGame(saved.level, Math.random))
  const [tool, setTool] = useState<PlantKind | 'shovel' | null>(null)
  const [paused, setPaused] = useState(false)

  // Real-time loop; it pauses with the tab hidden or the pause button.
  useEffect(() => {
    if (st.status !== 'playing' || paused) return
    const id = setInterval(() => {
      if (!document.hidden) setSt((s) => step(s, TICK, Math.random))
    }, TICK * 1000)
    return () => clearInterval(id)
  }, [st.status, paused])

  useEffect(() => {
    if (st.status === 'won') setSaved((s) => ({ level: s.level + 1, best: Math.max(s.best, st.level) }))
  }, [st.status, st.level, setSaved])

  const clickCell = (lane: number, col: number) => {
    if (tool === 'shovel') return setSt((s) => dig(s, lane, col))
    if (!tool) return
    setSt((s) => plant(s, tool, lane, col) ?? s)
    setTool(null)
  }

  const start = (level: number) => {
    setTool(null)
    setPaused(false)
    setSt(newGame(level, Math.random))
  }

  const status =
    st.status === 'won'
      ? t('garden.won', { n: st.level })
      : st.status === 'lost'
        ? t('garden.lost')
        : paused
          ? t('snake.paused')
          : tool
            ? t('garden.place')
            : t('garden.help')

  return (
    <GameShell
      title={t('garden.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('match3.level')} <b>{st.level}</b>
          </span>
          <span className="pill">
            ☀️ <b>{st.sun}</b>
          </span>
          <button type="button" className="secondary" onClick={() => setPaused((p) => !p)} disabled={st.status !== 'playing'}>
            ⏯ {t('snake.pause')}
          </button>
          {st.status === 'won' ? (
            <button type="button" className="primary" onClick={() => start(st.level + 1)}>
              {t('match3.next')}
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => start(st.status === 'lost' ? st.level : saved.level)}>
              {st.status === 'lost' ? t('garden.retry') : t('common.newGame')}
            </button>
          )}
        </>
      }
    >
      <div className="gd-cards">
        {(Object.keys(PLANTS) as PlantKind[]).map((k) => {
          const ready = st.recharge[k] <= 0
          const affordable = st.sun >= PLANTS[k].cost
          return (
            <button
              key={k}
              type="button"
              className={`gd-card ${tool === k ? 'active' : ''}`}
              disabled={!ready || !affordable || st.status !== 'playing'}
              onClick={() => setTool(tool === k ? null : k)}
              title={t(`garden.plant.${k}` as 'garden.plant.sunflower')}
            >
              <span className="gd-card-icon">{ICON[k]}</span>
              <small>{PLANTS[k].cost}</small>
              {!ready && <span className="gd-recharge" style={{ height: `${(st.recharge[k] / PLANTS[k].recharge) * 100}%` }} />}
            </button>
          )
        })}
        <button type="button" className={`gd-card ${tool === 'shovel' ? 'active' : ''}`} onClick={() => setTool(tool === 'shovel' ? null : 'shovel')} title={t('garden.shovel')}>
          <span className="gd-card-icon">⛏️</span>
          <small>{t('garden.shovel')}</small>
        </button>
      </div>
      <div className="gd-scroll">
        <div className="gd-lawn">
          {Array.from({ length: LANES }, (_, lane) =>
            Array.from({ length: COLS }, (_, col) => {
              const p = st.plants.find((x) => x.lane === lane && x.col === col)
              const can = tool && tool !== 'shovel' && canPlant(st, tool, lane, col)
              return (
                <button
                  key={`${lane}-${col}`}
                  type="button"
                  className={`gd-cell ${(lane + col) % 2 ? 'b' : ''} ${can ? 'can' : ''}`}
                  style={{ gridRow: lane + 1, gridColumn: col + 2 }}
                  onClick={() => clickCell(lane, col)}
                >
                  {p && <span className={`gd-plant ${p.kind}`}>{ICON[p.kind]}</span>}
                </button>
              )
            })
          )}
          {st.mowers.map((m, lane) => (
            <div key={`m${lane}`} className="gd-mower" style={{ gridRow: lane + 1, gridColumn: 1 }}>
              {m ? '🚜' : ''}
            </div>
          ))}
          <div className="gd-layer">
            {st.zombies.map((z) => (
              <span key={z.id} className="gd-zombie" style={{ left: `${((z.x + 1) / (COLS + 1)) * 100}%`, top: `${(z.lane / LANES) * 100}%` }}>
                {ZOMBIE_HAT[z.kind] && <i>{ZOMBIE_HAT[z.kind]}</i>}🧟
              </span>
            ))}
            {st.peas.map((p, k) => (
              <span key={k} className="gd-pea" style={{ left: `${((p.x + 1) / (COLS + 1)) * 100}%`, top: `${((p.lane + 0.4) / LANES) * 100}%` }} />
            ))}
            {st.suns.map((s) => (
              <button
                key={s.id}
                type="button"
                className="gd-sun"
                style={{ left: `${((s.col + 1.5) / (COLS + 1)) * 100}%`, top: `${((s.lane + 0.15) / LANES) * 100}%` }}
                onClick={() => setSt((x) => collect(x, s.id))}
                aria-label="+25"
              >
                ☀️
              </button>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  )
}
