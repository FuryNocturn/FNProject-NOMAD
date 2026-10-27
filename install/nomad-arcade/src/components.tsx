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
