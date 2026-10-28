import { useEffect } from 'react'
import { GameShell, Scoreboard, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { randomInt } from '../../lib/rng'
import { usePersistentState } from '../../lib/storage'
import { ALPHABET, THEMES, THEME_LABELS } from '../wordsearch/words'
import { MAX_MISSES, type State, guess, masked, misses, newGame, status } from './logic'

type Saved = { game: State; tally: Tally; recorded: boolean }

function pickWord(lang: 'es' | 'en'): State {
  const themes = THEMES[lang] as Record<string, readonly string[]>
  const ids = Object.keys(themes)
  const theme = ids[randomInt(Math.random, ids.length)]
  const words = themes[theme]
  return newGame(words[randomInt(Math.random, words.length)], theme)
}

/** The gallows drawn in stages, one per miss. */
function Gallows({ n }: { n: number }) {
  const parts = [
    <line key="h" x1="70" y1="20" x2="70" y2="40" />,
    <circle key="head" cx="70" cy="52" r="12" />,
    <line key="b" x1="70" y1="64" x2="70" y2="105" />,
    <line key="la" x1="70" y1="75" x2="52" y2="92" />,
    <line key="ra" x1="70" y1="75" x2="88" y2="92" />,
    <line key="ll" x1="70" y1="105" x2="55" y2="130" />,
    <line key="rl" x1="70" y1="105" x2="85" y2="130" />,
  ]
  return (
    <svg className="gallows" viewBox="0 0 140 160" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round">
        <line x1="10" y1="150" x2="120" y2="150" />
        <line x1="30" y1="150" x2="30" y2="20" />
        <line x1="30" y1="20" x2="70" y2="20" />
        {parts.slice(0, n)}
      </g>
    </svg>
  )
}

export default function Hangman() {
  const { t, lang } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('hangman', () => ({ game: pickWord(lang), tally: emptyTally(), recorded: false }))
  const g = st.game
  const s = status(g)

  useEffect(() => {
    if (s === 'playing' || st.recorded) return
    setSt((x) => ({ ...x, recorded: true, tally: { ...x.tally, [s === 'won' ? 'wins' : 'losses']: x.tally[s === 'won' ? 'wins' : 'losses'] + 1 } }))
  }, [s, st.recorded, setSt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return
      if (/^[a-zñ]$/i.test(e.key)) setSt((x) => ({ ...x, game: guess(x.game, e.key) }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSt])

  const restart = () => setSt((x) => ({ ...x, game: pickWord(lang), recorded: false }))

  return (
    <GameShell
      title={t('hangman.name')}
      status={s === 'won' ? t('common.youWin') : s === 'lost' ? t('hangman.was', { word: g.word }) : t('hangman.left', { n: MAX_MISSES - misses(g) })}
      controls={
        <>
          <span className="pill">
            {t('wordsearch.theme')}: <b>{THEME_LABELS[g.theme]}</b>
          </span>
          <button type="button" className="primary" onClick={restart}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="hm-layout">
        <Gallows n={misses(g)} />
        <div className="hm-word" aria-label={masked(g)}>
          {[...(s === 'lost' ? g.word : masked(g))].map((ch, i) => (
            <span key={i} className={ch === '_' ? 'blank' : s === 'lost' && !g.guessed.includes(ch) ? 'reveal' : ''}>
              {ch === '_' ? '' : ch}
            </span>
          ))}
        </div>
      </div>
      <div className="hm-keys">
        {[...ALPHABET[lang]].map((l) => {
          const used = g.guessed.includes(l)
          return (
            <button
              key={l}
              type="button"
              className={used ? (g.word.includes(l) ? 'good' : 'bad') : ''}
              disabled={used || s !== 'playing'}
              onClick={() => setSt({ ...st, game: guess(g, l) })}
            >
              {l}
            </button>
          )
        })}
      </div>
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
