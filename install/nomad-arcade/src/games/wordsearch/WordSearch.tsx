import { useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { type Lang, useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Difficulty, type Puzzle, findPlacement, generate, lineBetween } from './logic'
import { ALPHABET, THEMES, THEME_LABELS } from './words'

type State = { lang: Lang; theme: string; difficulty: Difficulty; puzzle: Puzzle; found: string[] }

function fresh(lang: Lang, theme: string, difficulty: Difficulty): State {
  const themes = THEMES[lang] as Record<string, readonly string[]>
  const id = theme in themes ? theme : Object.keys(themes)[0]
  return { lang, theme: id, difficulty, puzzle: generate(themes[id], difficulty, ALPHABET[lang], Math.random), found: [] }
}

/** Colour per found word, cycling through a small palette. */
const HUES = [40, 140, 200, 280, 330, 90, 20, 250]

export default function WordSearch() {
  const { t, lang } = useI18n()
  const [st, setSt] = usePersistentState<State>('wordsearch', () => fresh(lang, '', 'easy'))
  const [start, setStart] = useState<number | null>(null)
  const { puzzle, found } = st
  const done = found.length === puzzle.placements.length

  // Which found word (if any) covers each cell, for colouring.
  const owner = new Map<number, number>()
  puzzle.placements.forEach((p, k) => found.includes(p.word) && p.cells.forEach((c) => owner.set(c, k)))

  const click = (i: number) => {
    if (done) return
    if (start === null) return setStart(i)
    if (start === i) return setStart(null)
    const line = lineBetween(puzzle.size, start, i)
    const hit = line && findPlacement(puzzle, line)
    setStart(null)
    if (hit && !found.includes(hit.word)) setSt((s) => ({ ...s, found: [...s.found, hit.word] }))
  }

  // New games use the interface language's word lists.
  const restart = (changes: Partial<Pick<State, 'theme' | 'difficulty'>> = {}) => {
    setStart(null)
    setSt((s) => fresh(lang, changes.theme ?? s.theme, changes.difficulty ?? s.difficulty))
  }

  const themes = Object.keys(THEMES[lang])

  return (
    <GameShell
      title={t('wordsearch.name')}
      status={done ? t('wordsearch.done') : t('wordsearch.found', { n: found.length, total: puzzle.placements.length })}
      controls={
        <>
          <label className="select">
            <span>{t('wordsearch.theme')}</span>
            <select value={themes.includes(st.theme) ? st.theme : ''} onChange={(e) => restart({ theme: e.target.value })}>
              {!themes.includes(st.theme) && <option value="">{THEME_LABELS[st.theme]}</option>}
              {themes.map((id) => (
                <option key={id} value={id}>
                  {THEME_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(difficulty) => restart({ difficulty })}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{t('wordsearch.help')}</p>
      <div className="ws-layout">
        <div className="ws-grid" style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}>
          {puzzle.grid.map((ch, i) => {
            const k = owner.get(i)
            return (
              <button
                key={i}
                type="button"
                className={`ws-cell ${start === i ? 'start' : ''} ${k !== undefined ? 'found' : ''}`}
                style={k !== undefined ? { background: `hsl(${HUES[k % HUES.length]} 70% 70% / 0.55)` } : undefined}
                onClick={() => click(i)}
              >
                {ch}
              </button>
            )
          })}
        </div>
        <ul className="ws-words">
          {puzzle.placements.map((p) => (
            <li key={p.word} className={found.includes(p.word) ? 'found' : ''}>
              {p.word}
            </li>
          ))}
        </ul>
      </div>
    </GameShell>
  )
}
