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
