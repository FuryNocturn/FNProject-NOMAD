import { useEffect, useMemo, useState } from 'react'
import { GameShell, Segmented } from '../../components'
import { useI18n } from '../../i18n'
import { usePersistentState } from '../../lib/storage'
import {
  BAR,
  type Board,
  type Difficulty,
  type Move,
  OFF,
  type Player,
  aiPlay,
  initialBoard,
  legalPlays,
  move,
  nextMoves,
  openingRoll,
  pips,
  roll,
  toBoardPoint,
  winValue,
} from './logic'

const HUMAN: Player = 0
const AI: Player = 1

type State = {
  board: Board
  start: Board // board when the human's turn began, for undo
  turn: Player
  dice: number[] | null
  done: Move[]
  lastAi: { from: number; to: number }[]
  aiDice: number[] | null
  winner: { p: Player; value: number } | null
  difficulty: Difficulty
  points: [number, number]
}

function newGame(s?: Partial<State>): State {
  const { first, dice } = openingRoll(Math.random)
  const board = initialBoard()
  return { board, start: board, turn: first, dice, done: [], lastAi: [], aiDice: null, winner: null, difficulty: 'medium', points: [0, 0], ...s }
}

function Die({ n, used }: { n: number; used?: boolean }) {
  const spots: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
  }
  return (
    <svg className={`bg-die ${used ? 'used' : ''}`} viewBox="0 0 40 40" role="img" aria-label={String(n)}>
      <rect x="1" y="1" width="38" height="38" rx="7" />
      {spots[n].map(([r, c], i) => (
        <circle key={i} cx={c * 10} cy={r * 10} r="3.6" />
      ))}
    </svg>
  )
}

// Board columns, left to right: top row 13-18 | bar | 19-24, bottom row 12-7 | bar | 6-1.
const TOP = [12, 13, 14, 15, 16, 17, -100, 18, 19, 20, 21, 22, 23]
const BOTTOM = [11, 10, 9, 8, 7, 6, -100, 5, 4, 3, 2, 1, 0]

export default function Backgammon() {
  const { t } = useI18n()
  const [st, setSt] = usePersistentState<State>('backgammon', () => newGame())
  const [sel, setSel] = useState<number | null>(null)
  const humanTurn = !st.winner && st.turn === HUMAN

  const all = useMemo(() => (humanTurn && st.dice ? legalPlays(st.start, HUMAN, st.dice) : []), [humanTurn, st.dice, st.start])
  const maxLen = all.reduce((m, p) => Math.max(m, p.length), 0)
  const options = humanTurn && st.dice ? nextMoves(all, st.done) : []
  const finished = humanTurn && st.dice !== null && st.done.length === maxLen
  const blocked = humanTurn && st.dice !== null && maxLen === 0

  // Dice still to use: those of the first legal play that matches what was played.
  const used = useMemo(() => {
    const play = all.find((p) => st.done.every((d, k) => p[k] && p[k].from === d.from && p[k].to === d.to))
    return play ? st.done.map((_, k) => play[k].die) : []
  }, [all, st.done])
  const diceShown = st.dice ? (st.dice[0] === st.dice[1] ? [st.dice[0], st.dice[0], st.dice[0], st.dice[0]] : st.dice) : []
  const usedFlags = (() => {
    const left = [...used]
    return diceShown.map((d) => {
      const k = left.indexOf(d)
      if (k < 0) return false
      left.splice(k, 1)
      return true
    })
  })()

  // The computer rolls and plays its whole turn.
  useEffect(() => {
    if (st.winner || st.turn !== AI) return
    const id = setTimeout(() => {
      setSt((s) => {
        const dice = s.dice ?? roll(Math.random)
        let board = s.board
        const moves = aiPlay(board, AI, dice, s.difficulty, Math.random)
        for (const m of moves) board = move(board, AI, m)
        const lastAi = moves.map((m) => ({ from: toBoardPoint(AI, m.from), to: toBoardPoint(AI, m.to) }))
        const value = winValue(board, AI)
        if (value) return { ...s, board, lastAi, dice, winner: { p: AI, value }, points: [s.points[0], s.points[1] + value] }
        return { ...s, board, start: board, lastAi, aiDice: dice, turn: HUMAN, dice: null, done: [] }
      })
    }, 900)
    return () => clearTimeout(id)
  }, [st.turn, st.winner, setSt])

  // No legal move: show the roll for a moment, then hand over.
  useEffect(() => {
    if (!blocked) return
    const id = setTimeout(() => setSt((s) => ({ ...s, turn: AI, dice: null, done: [] })), 1600)
    return () => clearTimeout(id)
  }, [blocked, setSt])

  const doRoll = () => setSt((s) => ({ ...s, dice: roll(Math.random), start: s.board, done: [] }))

  const playMove = (m: Move) => {
    setSel(null)
    setSt((s) => {
      const board = move(s.board, HUMAN, m)
      const value = winValue(board, HUMAN)
      if (value) return { ...s, board, done: [...s.done, m], winner: { p: HUMAN, value }, points: [s.points[0] + value, s.points[1]] }
      return { ...s, board, done: [...s.done, m] }
    })
  }

  const fromsAvailable = new Set(options.map((m) => m.from))
  const targets = sel === null ? [] : options.filter((m) => m.from === sel)

  const clickPoint = (i: number) => {
    if (!humanTurn) return
    const m = targets.find((x) => x.to === i)
    if (m) return playMove(m)
    if (fromsAvailable.has(i)) setSel(sel === i ? null : i)
    else setSel(null)
  }

  const endTurn = () => setSt((s) => ({ ...s, turn: AI, dice: null, done: [] }))
  const undo = () => {
    setSel(null)
    setSt((s) => ({ ...s, board: s.start, done: [] }))
  }
  const restart = (changes: Partial<State> = {}) => {
    setSel(null)
    setSt((s) => newGame({ difficulty: s.difficulty, points: s.points, ...changes }))
  }

  const pointClass = (i: number) =>
    [
      'bg-point',
      i >= 12 ? 'top' : 'bottom',
      i % 2 ? 'odd' : 'even',
      sel === i ? 'sel' : '',
      targets.some((m) => m.to === i) ? 'target' : '',
      fromsAvailable.has(i) && sel === null ? 'can' : '',
      st.lastAi.some((m) => m.to === i) && st.turn === HUMAN ? 'last' : '',
    ].join(' ')

  const stack = (count: number, owner: Player | null) => {
    const shown = Math.min(count, 5)
    return Array.from({ length: shown }, (_, k) => (
      <span key={k} className={`bg-checker p${owner}`}>
        {k === shown - 1 && count > 5 ? count : ''}
      </span>
    ))
  }

  const point = (i: number) => {
    const v = st.board.pts[i]
    return (
      <button key={i} type="button" className={pointClass(i)} onClick={() => clickPoint(i)} aria-label={t('backgammon.point', { n: i + 1 })}>
        <span className="bg-num">{i + 1}</span>
        <span className="bg-stack">{v ? stack(Math.abs(v), v > 0 ? HUMAN : AI) : null}</span>
      </button>
    )
  }

  const bar = (row: 'top' | 'bottom') => {
    // Your checkers wait on the bar beside the board where they come back in (top right).
    const who: Player = row === 'top' ? HUMAN : AI
    const n = st.board.bar[who]
    const canPick = who === HUMAN && fromsAvailable.has(BAR)
    return (
      <button
        key={`bar-${row}`}
        type="button"
        className={`bg-bar ${row} ${sel === BAR && who === HUMAN ? 'sel' : ''} ${canPick && sel === null ? 'can' : ''}`}
        onClick={() => who === HUMAN && clickPoint(BAR)}
        aria-label={t('backgammon.bar')}
      >
        <span className="bg-stack">{stack(n, who)}</span>
      </button>
    )
  }

  const offTarget = targets.some((m) => m.to === OFF)

  let status: string
  if (st.winner)
    status = t(st.winner.p === HUMAN ? 'backgammon.won' : 'backgammon.lost', {
      kind: t(st.winner.value === 3 ? 'backgammon.backgammon' : st.winner.value === 2 ? 'backgammon.gammon' : 'backgammon.single'),
    })
  else if (st.turn === AI) status = t('common.thinking')
  else if (!st.dice) status = t('backgammon.roll')
  else if (blocked) status = t('backgammon.blocked')
  else if (finished) status = t('backgammon.done')
  else status = t('backgammon.move')

  return (
    <GameShell
      title={t('backgammon.name')}
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
          <span className="pill">
            {t('common.you')} <b>{st.points[0]}</b> · {t('common.machine')} <b>{st.points[1]}</b>
          </span>
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        </>
      }
    >
      <p className="hint">
        {st.aiDice && st.turn === HUMAN && !st.winner
          ? t(st.lastAi.length ? 'backgammon.aiPlayed' : 'backgammon.aiBlocked', { a: st.aiDice[0], b: st.aiDice[1] })
          : t('backgammon.rules')}
      </p>
      <div className="bg-wrap">
        <div className="bg-board">
          <div className="bg-row top">{TOP.map((i) => (i < 0 ? bar('top') : point(i)))}</div>
          <div className="bg-row bottom">{BOTTOM.map((i) => (i < 0 ? bar('bottom') : point(i)))}</div>
        </div>
        <div className="bg-tray">
          <div className="bg-off p1" aria-label={t('backgammon.offOf', { name: t('common.machine') })}>
            {st.board.off[AI]}
          </div>
          <button
            type="button"
            className={`bg-off p0 ${offTarget ? 'target' : ''}`}
            onClick={() => {
              const m = targets.find((x) => x.to === OFF)
              if (m) playMove(m)
            }}
            aria-label={t('backgammon.bearOff')}
          >
            {st.board.off[HUMAN]}
          </button>
        </div>
      </div>
      <div className="bg-controls">
        <span className="pill">
          {t('backgammon.pips')}: {t('common.you')} <b>{pips(st.board, HUMAN)}</b> · {t('common.machine')} <b>{pips(st.board, AI)}</b>
        </span>
        <span className="bg-dice">
          {diceShown.map((d, k) => (
            <Die key={k} n={d} used={humanTurn ? usedFlags[k] : false} />
          ))}
        </span>
        {humanTurn && !st.dice && (
          <button type="button" className="primary" onClick={doRoll}>
            {t('backgammon.rollButton')}
          </button>
        )}
        {humanTurn && st.done.length > 0 && (
          <button type="button" className="secondary" onClick={undo}>
            {t('common.undo')}
          </button>
        )}
        {finished && !blocked && (
          <button type="button" className="primary" onClick={endTurn}>
            {t('backgammon.endTurn')}
          </button>
        )}
        {st.winner && (
          <button type="button" className="primary" onClick={() => restart()}>
            {t('common.newGame')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
