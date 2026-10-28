import { useRef, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type State, freeTiles, hint, isWon, newGame, remaining, removePair, reshuffle } from './logic'

/** 36 faces: dots, bamboo and characters 1-9, four winds, three dragons, two flowers. */
const FACES: { label: string; cls: string }[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ label: `${i + 1}●`, cls: 'dots' })),
  ...Array.from({ length: 9 }, (_, i) => ({ label: `${i + 1}🎋`, cls: 'bamboo' })),
  ...Array.from({ length: 9 }, (_, i) => ({ label: `${i + 1}萬`, cls: 'chars' })),
  ...['東', '南', '西', '北'].map((l) => ({ label: l, cls: 'wind' })),
  { label: '中', cls: 'dragon red' },
  { label: '發', cls: 'dragon green' },
  { label: '▢', cls: 'dragon' },
  { label: '🌸', cls: 'flower' },
  { label: '❄', cls: 'flower' },
]

export default function Mahjong() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('mahjong', () => newGame(Math.random))
  const [sel, setSel] = useState<number | null>(null)
  const [glow, setGlow] = useState<number[]>([])
  const history = useRef<State[]>([])
  const free = new Set(freeTiles(st).map((x) => x.id))
  const left = remaining(st)
  const stuck = !isWon(st) && !hint(st)

  const click = (id: number) => {
    if (!free.has(id)) return
    if (sel === null || sel === id) return setSel(sel === id ? null : id)
    const next = removePair(st, sel, id)
    if (next) {
      history.current = [...history.current, st]
      setSt(next)
      setSel(null)
      setGlow([])
    } else setSel(id)
  }

  const restart = () => {
    history.current = []
    setSel(null)
    setGlow([])
    setSt(newGame(Math.random))
  }

  return (
    <GameShell
      title={t('mahjong.name')}
      status={isWon(st) ? t('common.youWin') : stuck ? t('mahjong.stuck') : t('mahjong.left', { n: left.length })}
      controls={
        <>
          <button type="button" className="secondary" onClick={() => setGlow(hint(st) ?? [])}>
            💡 {t('mahjong.hint')}
          </button>
          <button type="button" className="secondary" onClick={() => (setSt(reshuffle(st, Math.random)), setSel(null), setGlow([]))}>
            🔀 {t('mahjong.shuffle')}
          </button>
          <button type="button" className="secondary" onClick={() => {
            const prev = history.current.pop()
            if (prev) (setSt(prev), setSel(null))
          }}>
            ↶ {t('common.undo')}
          </button>
          <button type="button" className="primary" onClick={restart}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="mj-scroll">
        <div className="mj-board">
          {[...left]
            .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x)
            .map((tile) => {
              const f = FACES[tile.face]
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={`mj-tile ${f.cls} ${free.has(tile.id) ? 'free' : ''} ${sel === tile.id ? 'selected' : ''} ${glow.includes(tile.id) ? 'glow' : ''}`}
                  style={{
                    left: `calc(${tile.x} * var(--tw) + ${tile.z} * -4px)`,
                    top: `calc(${tile.y} * var(--th) + ${tile.z} * -4px)`,
                    zIndex: tile.z * 100 + tile.y * 10 + tile.x,
                  }}
                  onClick={() => click(tile.id)}
                >
                  {f.label}
                </button>
              )
            })}
        </div>
      </div>
    </GameShell>
  )
}
