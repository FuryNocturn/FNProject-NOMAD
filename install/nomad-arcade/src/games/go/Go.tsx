import { useEffect, useMemo } from 'react'
import { GameShell, Scoreboard, Segmented, StoneBoard, emptyTally, type Tally } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import { type Color, type Difficulty, type Game, KOMI, N, PASS, STARS, aiMove, areaScore, deadStones, group, legal, newGame, play } from './logic'

type State = {
  game: Game
  human: Color
  difficulty: Difficulty
  dead: number[] | null // set once both players pass: the scoring phase
  result: { winner: Color; margin: number; resigned?: boolean } | null
  tally: Tally
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

const fresh = (s?: Partial<State>): State => ({ game: newGame(), human: 1, difficulty: 'medium', dead: null, result: null, tally: emptyTally(), ...s })

export default function Go() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('go', () => fresh())
  const g = st.game
  const scoring = st.dead !== null && !st.result
  const humanToMove = !st.result && !scoring && g.toMove === st.human

  // Two passes end the game: guess the dead stones, then let the player check them.
  useEffect(() => {
    if (g.passes < 2 || st.dead !== null) return
    setSt((s) => ({ ...s, dead: [...deadStones(s.game, Math.random)] }))
  }, [g.passes, st.dead, setSt])

  useEffect(() => {
    if (st.result || st.dead !== null || g.passes >= 2 || g.toMove === st.human) return
    const id = setTimeout(() => {
      setSt((s) => ({ ...s, game: play(s.game, aiMove(s.game, s.difficulty, Math.random)) ?? play(s.game, PASS)! }))
    }, 120)
    return () => clearTimeout(id)
  }, [g, st.result, st.dead, st.human, setSt])

  const dead = useMemo(() => new Set(st.dead ?? []), [st.dead])
  const score = areaScore(g.board, dead)

  const finish = (winner: Color, margin: number, resigned = false) =>
    setSt((s) => {
      const key = winner === s.human ? 'wins' : 'losses'
      return { ...s, result: { winner, margin, resigned }, tally: { ...s.tally, [key]: s.tally[key] + 1 } }
    })

  const click = (i: number) => {
    if (scoring) {
      if (!g.board[i]) return
      const stones = group(g.board, i)
      const next = new Set(dead)
      for (const q of stones) {
        if (dead.has(i)) next.delete(q)
        else next.add(q)
      }
      setSt({ ...st, dead: [...next] })
      return
    }
    if (!humanToMove) return
    const next = play(g, i)
    if (next) setSt({ ...st, game: next })
  }

  const restart = (changes: Partial<State> = {}) =>
    setSt((s) => fresh({ human: s.human, difficulty: s.difficulty, tally: s.tally, ...changes }))

  const colour = (c: Color) => t(c === 1 ? 'board.black' : 'board.white')
  let status: string
  if (st.result)
    status = st.result.resigned
      ? t('go.resigned', { colour: colour(st.result.winner === 1 ? 2 : 1) })
      : t(st.result.winner === st.human ? 'go.won' : 'go.lost', { n: st.result.margin })
  else if (scoring) status = t('go.scoring')
  else if (g.last === PASS && humanToMove) status = t('go.machinePassed')
  else status = humanToMove ? t('common.yourTurn') : t('common.thinking')

  return (
    <GameShell
      title={t('go.name')}
      status={status}
      controls={
        <>
          <Segmented
            label={t('common.difficulty')}
            value={st.difficulty}
            onChange={(d) => restart({ difficulty: d })}
            options={[
              { value: 'easy', label: t('common.easy') },
              { value: 'medium', label: t('common.medium') },
              { value: 'hard', label: t('common.hard') },
            ]}
          />
          <Segmented
            label={t('go.youPlay')}
            value={String(st.human) as '1' | '2'}
            onChange={(v) => restart({ human: Number(v) as Color })}
            options={[
              { value: '1', label: cap(t('board.black')) },
              { value: '2', label: cap(t('board.white')) },
            ]}
          />
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">{scoring ? t('go.scoringHelp') : t('go.rules', { komi: KOMI })}</p>
      <div className="go-info">
        <span className="pill">
          ⚫ {t('go.captured')}: <b>{g.captures[0]}</b>
        </span>
        <span className="pill">
          ⚪ {t('go.captured')}: <b>{g.captures[1]}</b>
        </span>
        {(scoring || st.result) && (
          <span className="pill">
            ⚫ <b>{score.black}</b> · ⚪ <b>{score.white}</b>
          </span>
        )}
      </div>
      <StoneBoard
        size={N}
        stones={g.board}
        faded={dead}
        stars={STARS}
        last={g.last}
        marks={scoring || st.result ? score.owner.map((o, i) => (o && o !== g.board[i] ? o : 0) as 0 | 1 | 2) : undefined}
        playable={(i) => scoring || legal(g, i)}
        onPlay={humanToMove || scoring ? click : undefined}
        label={(i) => t('board.point', { r: Math.floor(i / N) + 1, c: (i % N) + 1 })}
      />
      <div className="dom-actions">
        {humanToMove && (
          <>
            <button type="button" className="secondary" onClick={() => setSt({ ...st, game: play(g, PASS)! })}>
              {t('go.pass')}
            </button>
            <button type="button" className="secondary" onClick={() => finish(st.human === 1 ? 2 : 1, 0, true)}>
              {t('go.resign')}
            </button>
          </>
        )}
        {scoring && (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => {
                const diff = score.black - score.white
                finish(diff > 0 ? 1 : 2, Math.abs(diff))
              }}
            >
              {t('go.accept')}
            </button>
            <button type="button" className="secondary" onClick={() => setSt({ ...st, dead: null, game: { ...g, passes: 0 } })}>
              {t('go.resume')}
            </button>
          </>
        )}
        {st.result && (
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        )}
      </div>
      <Scoreboard tally={st.tally} />
    </GameShell>
  )
}
