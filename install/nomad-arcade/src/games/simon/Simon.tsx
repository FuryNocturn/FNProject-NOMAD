import { useEffect, useRef, useState } from 'react'
import { GameShell } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type State, flashMs, newState, nextRound, press } from './logic'

const TONES = [329.63, 261.63, 220, 164.81] // E4 C4 A3 E3, the classic Simon notes

let audio: AudioContext | null = null
function beep(freq: number, ms: number) {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    osc.type = 'triangle'
    gain.gain.value = 0.15
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + ms / 1000)
  } catch {
    // No audio available: the game still works silently.
  }
}

export default function Simon() {
  const { t } = useI18n()
  const [best, setBest] = usePersistentState<number>('simon', () => 0)
  const [st, setSt] = useState<State>(() => newState(best))
  const [lit, setLit] = useState<number | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => setBest(st.best), [st.best, setBest])

  // Plays the sequence back, then hands over to the player.
  useEffect(() => {
    if (st.phase !== 'showing') return
    const ms = flashMs(st.sequence.length)
    st.sequence.forEach((c, k) => {
      timers.current.push(window.setTimeout(() => (setLit(c), beep(TONES[c], ms)), 500 + k * (ms + 150)))
      timers.current.push(window.setTimeout(() => setLit(null), 500 + k * (ms + 150) + ms))
    })
    timers.current.push(window.setTimeout(() => setSt((s) => ({ ...s, phase: 'input' })), 500 + st.sequence.length * (ms + 150)))
  }, [st.phase, st.sequence])

  const hit = (c: number) => {
    if (st.phase !== 'input') return
    const r = press(st, c)
    beep(r.result === 'wrong' ? 110 : TONES[c], r.result === 'wrong' ? 600 : 250)
    setLit(c)
    timers.current.push(window.setTimeout(() => setLit(null), 200))
    setSt(r.state)
    if (r.result === 'round') timers.current.push(window.setTimeout(() => setSt((s) => nextRound(s, Math.random)), 700))
  }

  const start = () => setSt(nextRound(newState(st.best), Math.random))
  const status =
    st.phase === 'over'
      ? t('simon.over', { n: st.sequence.length - 1 })
      : st.phase === 'showing'
        ? t('simon.watch')
        : st.phase === 'input'
          ? t('simon.repeat', { n: st.sequence.length - st.input })
          : st.sequence.length
            ? t('simon.good')
            : t('simon.start')

  return (
    <GameShell
      title={t('simon.name')}
      status={status}
      controls={
        <>
          <span className="pill">
            {t('common.score')}: <b>{Math.max(0, st.sequence.length - (st.phase === 'over' || st.phase === 'showing' ? 1 : 0))}</b>
          </span>
          <span className="pill">
            {t('common.best')}: <b>{st.best}</b>
          </span>
          <button type="button" className="primary" onClick={start} disabled={st.phase === 'showing' || st.phase === 'input'}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="simon">
        {[0, 1, 2, 3].map((c) => (
          <button
            key={c}
            type="button"
            className={`simon-pad p${c} ${lit === c ? 'lit' : ''}`}
            onClick={() => hit(c)}
            disabled={st.phase !== 'input'}
            aria-label={t(`simon.color${c}` as 'simon.color0')}
          />
        ))}
      </div>
    </GameShell>
  )
}
