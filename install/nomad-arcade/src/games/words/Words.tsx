import { useEffect, useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import {
  CENTER,
  type Difficulty,
  Dictionary,
  type Lang,
  PREMIUMS,
  type Placement,
  type State,
  aiChoose,
  applyPlay,
  evaluate,
  newGame,
  pass,
  swap,
  value,
} from './logic'

/** Word lists load on first use and stay in memory (~7 MB of text for Spanish). */
const cache: Partial<Record<Lang, Promise<Dictionary>>> = {}
function loadDictionary(lang: Lang) {
  cache[lang] ??= fetch(`./words/${lang}.txt`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.text()
    })
    .then((txt) => new Dictionary(txt.split('\n')))
  return cache[lang]!
}

type Saved = { game: State; difficulty: Difficulty; won: number; played: number; recorded: boolean }

export default function Words() {
  const { t, lang: uiLang } = useI18n()
  const [st, setSt] = usePersistentState<Saved>('words', () => ({ game: newGame(uiLang, Math.random), difficulty: 'medium', won: 0, played: 0, recorded: false }))
  const g = st.game
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [failed, setFailed] = useState(false)
  const [placed, setPlaced] = useState<Placement[]>([])
  const [pick, setPick] = useState<number | null>(null) // index in the rack
  const [swapping, setSwapping] = useState<number[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDict(null)
    loadDictionary(g.lang).then(setDict, () => setFailed(true))
  }, [g.lang])

  // The computer's turn.
  useEffect(() => {
    if (!dict || g.over || g.turn !== 1) return
    const id = setTimeout(() => {
      setSt((s) => {
        const choice = aiChoose(s.game, dict, s.difficulty, Math.random)
        const game = choice ? applyPlay(s.game, choice.placed, dict)! : swap(s.game, s.game.racks[1].slice(0, 3), Math.random) ?? pass(s.game)
        return { ...s, game }
      })
    }, 400)
    return () => clearTimeout(id)
  }, [dict, g, setSt])

  useEffect(() => {
    if (!g.over || st.recorded) return
    setSt((s) => ({ ...s, recorded: true, played: s.played + 1, won: s.won + (s.game.scores[0] > s.game.scores[1] ? 1 : 0) }))
  }, [g.over, st.recorded, setSt])

  // Rack letters not yet put on the board this turn.
  const usedIdx = new Set<number>()
  for (const p of placed) {
    const i = g.racks[0].findIndex((l, k) => l === p.letter && !usedIdx.has(k))
    usedIdx.add(i)
  }
  const myTurn = g.turn === 0 && !g.over && !!dict
  const preview = dict && placed.length ? evaluate(g, placed, dict) : null

  const clickCell = (cell: number) => {
    if (!myTurn) return
    const mine = placed.findIndex((p) => p.cell === cell)
    if (mine >= 0) return setPlaced(placed.filter((_, k) => k !== mine))
    if (pick === null || g.board[cell]) return
    setPlaced([...placed, { cell, letter: g.racks[0][pick] }])
    setPick(null)
    setError(null)
  }

  const submit = () => {
    if (!dict) return
    const res = evaluate(g, placed, dict)
    if (!res.ok) return setError(res.reason === 'word' ? t('words.badWord', { w: res.bad!.join(', ') }) : t(`words.err.${res.reason}` as 'words.err.line'))
    setSt({ ...st, game: applyPlay(g, placed, dict)! })
    setPlaced([])
    setError(null)
  }

  const restart = (lang: Lang = g.lang) => {
    setPlaced([])
    setPick(null)
    setSwapping(null)
    setError(null)
    setSt({ ...st, game: newGame(lang, Math.random), recorded: false })
  }

  const last = g.last
  const status = failed
    ? t('words.noDict')
    : !dict
      ? t('words.loading')
      : g.over
        ? g.scores[0] > g.scores[1]
          ? t('common.youWin')
          : g.scores[0] < g.scores[1]
            ? t('common.youLose')
            : t('common.draw')
        : error ??
          (g.turn === 1
            ? t('common.thinking')
            : last && last.player === 1
              ? last.kind === 'play'
                ? t('words.aiPlayed', { w: last.words.join(', '), n: last.points })
                : t(`words.ai.${last.kind}` as 'words.ai.pass')
              : t('words.help'))

  return (
    <GameShell
      title={t('words.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('app.language')}
            value={g.lang}
            onChange={(l) => restart(l)}
            options={[
              { value: 'es', label: 'ES' },
              { value: 'en', label: 'EN' },
            ]}
          />
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(d) => setSt({ ...st, difficulty: d })}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <span className="pill">
            {t('common.you')}: <b>{g.scores[0]}</b> · {t('common.machine')}: <b>{g.scores[1]}</b>
          </span>
          <span className="pill">
            {t('words.bag')}: <b>{g.bag.length}</b>
          </span>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <div className="wd-scroll">
        <div className="wd-board">
          {g.board.map((l, i) => {
            const temp = placed.find((p) => p.cell === i)
            const letter = l || temp?.letter
            const prem = PREMIUMS[i]
            return (
              <button
                key={i}
                type="button"
                className={`wd-sq ${prem ? prem.toLowerCase() : ''} ${letter ? 'tile' : ''} ${temp ? 'temp' : ''} ${i === CENTER && !letter ? 'star' : ''}`}
                onClick={() => clickCell(i)}
              >
                {letter ? (
                  <>
                    {letter}
                    <sub>{value(g.lang, letter)}</sub>
                  </>
                ) : i === CENTER ? (
                  '★'
                ) : (
                  prem ?? ''
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="wd-rack">
        {g.racks[0].map((l, i) => (
          <button
            key={i}
            type="button"
            className={`wd-tile ${pick === i ? 'picked' : ''} ${swapping?.includes(i) ? 'swap' : ''}`}
            disabled={usedIdx.has(i) || !myTurn}
            onClick={() =>
              swapping ? setSwapping(swapping.includes(i) ? swapping.filter((x) => x !== i) : [...swapping, i]) : setPick(pick === i ? null : i)
            }
          >
            {l}
            <sub>{value(g.lang, l)}</sub>
          </button>
        ))}
      </div>
      <div className="poker-actions">
        {swapping ? (
          <>
            <button
              type="button"
              className="primary"
              disabled={!swapping.length}
              onClick={() => {
                const next = swap(g, swapping.map((i) => g.racks[0][i]), Math.random)
                if (next) setSt({ ...st, game: next })
                else setError(t('words.cantSwap'))
                setSwapping(null)
              }}
            >
              {t('words.swapThese')}
            </button>
            <button type="button" className="secondary" onClick={() => setSwapping(null)}>
              {t('words.cancel')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary" onClick={submit} disabled={!myTurn || !placed.length}>
              {t('words.play')} {preview?.ok ? `(+${preview.points})` : ''}
            </button>
            <button type="button" className="secondary" onClick={() => (setPlaced([]), setPick(null), setError(null))} disabled={!placed.length}>
              {t('words.recall')}
            </button>
            <button type="button" className="secondary" onClick={() => (setPlaced([]), setSwapping([]))} disabled={!myTurn || g.bag.length < 7}>
              {t('words.swap')}
            </button>
            <button type="button" className="secondary" onClick={() => (setPlaced([]), setSt({ ...st, game: pass(g) }))} disabled={!myTurn}>
              {t('domino.pass')}
            </button>
          </>
        )}
      </div>
    </GameShell>
  )
}
