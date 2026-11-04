import { useEffect } from 'react'
import { GameShell, Segmented, formatTime } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Board, DOWN, LEFT, RIGHT, UP, isSolved, newBoard, rotate, watered } from './logic'

type Size = '5' | '7' | '9'
type State = { size: Size; board: Board; moves: number; seconds: number; best: Partial<Record<Size, number>> }

const fresh = (size: Size, best: State['best'] = {}): State => ({ size, board: newBoard(Number(size), Math.random), moves: 0, seconds: 0, best })

const ARMS: [number, string][] = [
  [UP, 'M50 50 V0'],
  [RIGHT, 'M50 50 H100'],
  [DOWN, 'M50 50 V100'],
  [LEFT, 'M50 50 H0'],
]

export default function Pipes() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('pipes', () => fresh('5'))
  const { board } = st
  const done = isSolved(board)
  const wet = watered(board)

  useEffect(() => {
    if (done || !st.moves) return
    const id = setInterval(() => {
      if (!document.hidden) setSt((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [done, st.moves > 0, setSt])

  const turn = (i: number, dir: 1 | -1) =>
    setSt((s) => {
      if (isSolved(s.board)) return s
      const tiles = [...s.board.tiles]
      tiles[i] = rotate(tiles[i], dir)
      const b = { ...s.board, tiles }
      const moves = s.moves + 1
      if (!isSolved(b)) return { ...s, board: b, moves }
      const prev = s.best[s.size]
      return { ...s, board: b, moves, best: { ...s.best, [s.size]: prev === undefined ? s.seconds : Math.min(prev, s.seconds) } }
    })

  const best = st.best[st.size]
  return (
    <GameShell
      title={t('pipes.name')}
      status={done ? t('pipes.solved', { n: st.moves, time: formatTime(st.seconds) }) : `${t('common.time')}: ${formatTime(st.seconds)}`}
      controls={
        <>
          <Segmented
            label={t('common.size')}
            value={st.size}
            onChange={(size) => setSt((s) => fresh(size, s.best))}
            options={(['5', '7', '9'] as Size[]).map((v) => ({ value: v, label: `${v}×${v}` }))}
          />
          <span className="pill">
            {t('common.moves')}: <b>{st.moves}</b>
            {best !== undefined && ` · ${t('common.best')}: ${formatTime(best)}`}
          </span>
          <button type="button" className="primary" onClick={() => setSt((s) => fresh(s.size, s.best))}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('pipes.help')}</p>
      <div className={`pp-board ${done ? 'done' : ''}`} style={{ gridTemplateColumns: `repeat(${board.n}, 1fr)` }}>
        {board.tiles.map((m, i) => (
          <button
            key={i}
            type="button"
            className={`pp-tile ${wet.has(i) ? 'wet' : ''} ${i === board.source ? 'source' : ''}`}
            onClick={() => turn(i, 1)}
            onContextMenu={(e) => {
              e.preventDefault()
              turn(i, -1)
            }}
            aria-label={t('sudoku.cell', { r: Math.floor(i / board.n) + 1, c: (i % board.n) + 1 })}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              {ARMS.filter(([bit]) => m & bit).map(([bit, d]) => (
                <path key={bit} d={d} />
              ))}
              {i === board.source ? <rect x="28" y="28" width="44" height="44" rx="8" /> : <circle cx="50" cy="50" r="11" />}
            </svg>
          </button>
        ))}
      </div>
    </GameShell>
  )
}
