import { useEffect, useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { LEVELS, type Level, isComplete, score, secret } from './logic'

type Row = { guess: number[]; black: number; white: number }
type State = { level: Level; code: number[]; rows: Row[]; played: number; won: number; recorded: boolean }

const fresh = (level: Level, s?: Partial<State>): State => ({
  level, code: secret(level, Math.random), rows: [], played: 0, won: 0, recorded: false, ...s,
})

export default function Mastermind() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('mastermind', () => fresh('medium'))
  const { colours, pegs, tries, repeats } = LEVELS[st.level]
  const [guess, setGuess] = useState<(number | null)[]>(() => Array(pegs).fill(null))
  const [slot, setSlot] = useState(0)
  const solved = st.rows.at(-1)?.black === pegs
  const over = solved || st.rows.length >= tries

  useEffect(() => {
    setGuess(Array(pegs).fill(null))
    setSlot(0)
  }, [pegs, st.code])

  useEffect(() => {
    if (!over || st.recorded) return
    setSt((s) => ({ ...s, recorded: true, played: s.played + 1, won: s.won + (solved ? 1 : 0) }))
  }, [over, solved, st.recorded, setSt])

  const restart = (level = st.level) => setSt((s) => fresh(level, { played: s.played, won: s.won }))

  const pick = (colour: number) => {
    if (over) return
    if (!repeats && guess.some((v, i) => v === colour && i !== slot)) return
    const next = [...guess]
    next[slot] = colour
    setGuess(next)
    const after = next.findIndex((v, i) => v === null && i > slot)
    const first = next.indexOf(null)
    setSlot(after >= 0 ? after : first >= 0 ? first : slot)
  }

  const submit = () => {
    if (!isComplete(guess) || over) return
    setSt((s) => ({ ...s, rows: [...s.rows, { guess, ...score(guess, s.code) }] }))
    setGuess(Array(pegs).fill(null))
    setSlot(0)
  }

  // Numbers inside the pegs, so the colours never have to be told apart by hue alone.
  const peg = (v: number | null) => (
    <span className={`mm-peg ${v === null ? 'empty' : `c${v}`}`}>{v === null ? '' : v + 1}</span>
  )

  const status = solved
    ? t('mastermind.solved', { n: st.rows.length })
    : over
      ? t('mastermind.failed')
      : t('mastermind.left', { n: tries - st.rows.length })

  return (
    <GameShell
      title={t('mastermind.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={st.level}
            onChange={(l) => restart(l)}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <span className="pill">
            {t('common.wins')}: <b>{st.won}</b> / {st.played}
          </span>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t(repeats ? 'mastermind.rulesRepeat' : 'mastermind.rules', { pegs, colours })}</p>
      <div className="mm-board">
        <div className="mm-row secret">
          {st.code.map((v, i) =>
            over ? <span key={i}>{peg(v)}</span> : <span key={i} className="mm-peg hidden">?</span>,
          )}
        </div>
        {st.rows.map((r, k) => (
          <div key={k} className="mm-row">
            <span className="mm-num">{k + 1}</span>
            {r.guess.map((v, i) => (
              <span key={i}>{peg(v)}</span>
            ))}
            <span className="mm-keys" role="img" aria-label={t('mastermind.keys', { b: r.black, w: r.white })}>
              {Array.from({ length: pegs }, (_, i) => (
                <i key={i} className={i < r.black ? 'b' : i < r.black + r.white ? 'w' : ''} />
              ))}
            </span>
          </div>
        ))}
        {!over && (
          <div className="mm-row current">
            <span className="mm-num">{st.rows.length + 1}</span>
            {guess.map((v, i) => (
              <button
                key={i}
                type="button"
                className={`mm-slot ${i === slot ? 'active' : ''}`}
                // Tapping the selected slot again empties it.
                onClick={() => (v !== null && i === slot ? setGuess(guess.map((g, j) => (j === i ? null : g))) : setSlot(i))}
                aria-label={t('mastermind.slot', { n: i + 1 })}
              >
                {peg(v)}
              </button>
            ))}
            <button type="button" className="primary" disabled={!isComplete(guess)} onClick={submit}>
              {t('mastermind.try')}
            </button>
          </div>
        )}
      </div>
      {!over && (
        <div className="mm-palette">
          {Array.from({ length: colours }, (_, c) => (
            <button key={c} type="button" onClick={() => pick(c)} aria-label={t('mastermind.colour', { n: c + 1 })}>
              {peg(c)}
            </button>
          ))}
        </div>
      )}
    </GameShell>
  )
}
