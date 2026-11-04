import type { ReactNode } from 'react'
import { useI18n } from './i18n'

export function GameShell(props: { title: string; controls?: ReactNode; status?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <main className="game">
      <header className="game-header">
        <a className="back" href="#/">
          ← {t('app.back')}
        </a>
        <h1>{props.title}</h1>
      </header>
      {props.controls && <div className="controls">{props.controls}</div>}
      <div className="status" role="status" aria-live="polite">
        {props.status}
      </div>
      {props.children}
    </main>
  )
}

/** A row of mutually exclusive buttons (difficulty, size, who starts…). */
export function Segmented<V extends string>(props: {
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (v: V) => void
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      <span className="segmented-label">{props.label}</span>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          className={props.value === o.value ? 'active' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export type Tally = { wins: number; losses: number; draws: number }
export const emptyTally = (): Tally => ({ wins: 0, losses: 0, draws: 0 })

export function Scoreboard({ tally }: { tally: Tally }) {
  const { t } = useI18n()
  return (
    <dl className="scoreboard" aria-label={t('common.score')}>
      <div>
        <dt>{t('common.wins')}</dt>
        <dd>{tally.wins}</dd>
      </div>
      <div>
        <dt>{t('common.draws')}</dt>
        <dd>{tally.draws}</dd>
      </div>
      <div>
        <dt>{t('common.losses')}</dt>
        <dd>{tally.losses}</dd>
      </div>
    </dl>
  )
}

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const SPANISH_SUIT_CLASS = ['oros', 'copas', 'espadas', 'bastos']

/** Suit drawings (emoji for coins and clubs are missing on older systems). */
export function SuitIcon({ s }: { s: number }) {
  const paths = [
    // oros: a coin
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff8" strokeWidth="1.6" />
    </>,
    // copas: a cup
    <path d="M5 3h14c0 5-2.5 8.5-5.5 9.3V18H17v3H7v-3h3.5v-5.7C7.5 11.5 5 8 5 3z" fill="currentColor" />,
    // espadas: a sword
    <path d="M12 1l2 4v10h3v2h-3.5v5h-3v-5H7v-2h3V5z" fill="currentColor" />,
    // bastos: a club
    <path d="M10 2c3 0 5 2 5 4.5 0 1.6-.8 2.6-1.5 3.4L15 22h-5l.6-12.3C9 9 8 7.8 8 6c0-2.2.6-4 2-4z" fill="currentColor" />,
  ]
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      {paths[s]}
    </svg>
  )
}

/** A Spanish-deck card (oros, copas, espadas, bastos); rank 0 is a joker. */
export function SpanishCard({ card, hidden, held, dim, label, onClick }: {
  card?: { r: number; s: number }
  hidden?: boolean
  held?: boolean
  dim?: boolean
  label?: string
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  const button = onClick ? { type: 'button' as const, onClick } : {}
  if (!card || hidden) return <Tag className="pcard back" {...button} />
  const joker = card.r === 0
  const cls = joker ? 'joker' : SPANISH_SUIT_CLASS[card.s]
  return (
    <Tag
      className={`pcard scard ${cls} ${held ? 'held' : ''} ${dim ? 'dim' : ''}`}
      aria-label={label}
      title={label}
      {...button}
    >
      <span className="corner">{joker ? '★' : card.r}</span>
      <span className="pip">{joker ? '★' : <SuitIcon s={card.s} />}</span>
    </Tag>
  )
}

/** A face-up playing card (or its back when `hidden`). */
export function PlayingCard({ card, hidden, held, onClick }: {
  card?: { r: number; s: number }
  hidden?: boolean
  held?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  if (!card || hidden) return <Tag className="pcard back" onClick={onClick} />
  const red = card.s === 1 || card.s === 2
  const rank = card.r <= 10 ? String(card.r) : ['J', 'Q', 'K', 'A'][card.r - 11]
  const suit = ['♠', '♥', '♦', '♣'][card.s]
  return (
    <Tag className={`pcard ${red ? 'red' : 'black'} ${held ? 'held' : ''}`} onClick={onClick} {...(onClick ? { type: 'button' } : {})}>
      <span className="corner">
        {rank}
        {suit}
      </span>
      <span className="pip">{suit}</span>
    </Tag>
  )
}

/**
 * A board of lines with stones on the intersections (Go, gomoku). `stones[i]`
 * is 0, 1 (black) or 2 (white); `marks` draws small squares (dead stones, territory).
 */
export function StoneBoard({ size, stones, onPlay, playable, last, highlight, faded, marks, label, stars }: {
  size: number
  stones: number[]
  onPlay?: (i: number) => void
  playable?: (i: number) => boolean
  last?: number | null
  highlight?: number[]
  faded?: Set<number>
  marks?: (0 | 1 | 2)[]
  label: (i: number) => string
  stars: number[]
}) {
  const cell = 10
  const pad = 7
  const span = (size - 1) * cell
  const xy = (i: number) => [pad + (i % size) * cell, pad + Math.floor(i / size) * cell]
  return (
    <svg className="stone-board" viewBox={`0 0 ${span + 2 * pad} ${span + 2 * pad}`} role="grid">
      <rect width={span + 2 * pad} height={span + 2 * pad} rx="3" className="sb-wood" />
      {Array.from({ length: size }, (_, k) => (
        <g key={k} className="sb-line">
          <line x1={pad} y1={pad + k * cell} x2={pad + span} y2={pad + k * cell} />
          <line x1={pad + k * cell} y1={pad} x2={pad + k * cell} y2={pad + span} />
        </g>
      ))}
      {stars.map((i) => {
        const [x, y] = xy(i)
        return <circle key={i} cx={x} cy={y} r="1.2" className="sb-star" />
      })}
      {stones.map((v, i) => {
        const [x, y] = xy(i)
        const can = !v && !!onPlay && (!playable || playable(i))
        return (
          <g key={i}>
            {v ? <circle cx={x} cy={y} r="4.6" className={`sb-stone s${v} ${highlight?.includes(i) ? 'win' : ''} ${faded?.has(i) ? 'faded' : ''}`} /> : null}
            {last === i && v ? <circle cx={x} cy={y} r="1.6" className={`sb-last s${v}`} /> : null}
            {marks?.[i] ? <rect x={x - 2} y={y - 2} width="4" height="4" className={`sb-mark s${marks[i]}`} /> : null}
            {(can || (onPlay && marks)) && (
              <rect
                x={x - cell / 2}
                y={y - cell / 2}
                width={cell}
                height={cell}
                className={`sb-hit ${can ? 'can' : ''}`}
                role="button"
                aria-label={label(i)}
                onClick={() => onPlay!(i)}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
