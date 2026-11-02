import { type Rng, randomInt } from '../../lib/rng'

/**
 * Spanish draughts: 8x8, men move and capture diagonally forward only, kings
 * ("damas") fly any distance. Capturing is compulsory and the player must take
 * the sequence that captures the most pieces, then the most kings.
 */
export type Color = 'w' | 'b' // white (the human) starts at the bottom and moves up
export type Piece = { c: Color; king: boolean }
export type Board = (Piece | null)[] // 64, index 0 top left
export type Move = { path: number[]; captured: number[] }
export type State = { board: Board; turn: Color; quiet: number } // quiet: plies without a capture or man move
export type Difficulty = 'easy' | 'medium' | 'hard'

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
export const isDark = (i: number) => (Math.floor(i / 8) + (i % 8)) % 2 === 1
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8
const DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const forward = (c: Color) => (c === 'w' ? -1 : 1)

export function initial(): State {
  const board: Board = Array(64).fill(null)
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue
    const r = Math.floor(i / 8)
    if (r < 3) board[i] = { c: 'b', king: false }
    if (r > 4) board[i] = { c: 'w', king: false }
  }
  return { board, turn: 'w', quiet: 0 }
}

/** Every capture sequence starting at `from`, explored depth-first. Jumped pieces stay until the move ends. */
function captures(board: Board, from: number, piece: Piece): Move[] {
  const out: Move[] = []
  const walk = (at: number, path: number[], taken: number[]) => {
    let extended = false
    const r0 = Math.floor(at / 8)
    const c0 = at % 8
    for (const [dr, dc] of DIAGS) {
      if (!piece.king && dr !== forward(piece.c)) continue
      let r = r0 + dr
      let c = c0 + dc
      // A king may travel over empty squares before the piece it jumps.
      if (piece.king) while (on(r, c) && !board[r * 8 + c] && r * 8 + c !== from) [r, c] = [r + dr, c + dc]
      if (!on(r, c)) continue
      const victim = r * 8 + c
      const v = board[victim]
      if (!v || v.c === piece.c || taken.includes(victim)) continue
      let lr = r + dr
      let lc = c + dc
      while (on(lr, lc) && (!board[lr * 8 + lc] || lr * 8 + lc === from)) {
        extended = true
        walk(lr * 8 + lc, [...path, lr * 8 + lc], [...taken, victim])
        if (!piece.king) break // men land right behind the piece
        lr += dr
        lc += dc
      }
    }
    if (!extended && taken.length) out.push({ path, captured: taken })
  }
  walk(from, [from], [])
  return out
}

export function legalMoves(st: State): Move[] {
  const { board, turn } = st
  let caps: Move[] = []
  const quiet: Move[] = []
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (!p || p.c !== turn) continue
    caps.push(...captures(board, i, p))
    const r0 = Math.floor(i / 8)
    const c0 = i % 8
    for (const [dr, dc] of DIAGS) {
      if (!p.king && dr !== forward(turn)) continue
      let r = r0 + dr
      let c = c0 + dc
      while (on(r, c) && !board[r * 8 + c]) {
        quiet.push({ path: [i, r * 8 + c], captured: [] })
        if (!p.king) break
        r += dr
        c += dc
      }
    }
  }
  if (!caps.length) return quiet
  // Law of quantity, then of quality (most kings taken).
  const most = Math.max(...caps.map((m) => m.captured.length))
  caps = caps.filter((m) => m.captured.length === most)
  const kings = (m: Move) => m.captured.filter((i) => board[i]!.king).length
  const bestKings = Math.max(...caps.map(kings))
  return caps.filter((m) => kings(m) === bestKings)
}

export function apply(st: State, m: Move): State {
  const board = [...st.board]
  const from = m.path[0]
  const to = m.path[m.path.length - 1]
  const p = board[from]!
  board[from] = null
  for (const i of m.captured) board[i] = null
  const crowned = !p.king && Math.floor(to / 8) === (p.c === 'w' ? 0 : 7)
  board[to] = crowned ? { ...p, king: true } : p
  const quiet = m.captured.length || !p.king ? 0 : st.quiet + 1
  return { board, turn: other(st.turn), quiet }
}

/** 'w' or 'b' wins, 'draw', or null while playing. No moves means the side to move loses. */
export function winner(st: State): Color | 'draw' | null {
  if (legalMoves(st).length === 0) return other(st.turn)
  if (st.quiet >= 80) return 'draw'
  return null
}

function evaluate(st: State): number {
  let s = 0
  for (let i = 0; i < 64; i++) {
    const p = st.board[i]
    if (!p) continue
    const advance = p.king ? 0 : p.c === 'w' ? 7 - Math.floor(i / 8) : Math.floor(i / 8)
    const v = p.king ? 320 : 100 + advance * 4
    s += p.c === st.turn ? v : -v
  }
  return s
}

function negamax(st: State, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(st)
  if (!moves.length) return -100000 - depth
  if (depth === 0) return evaluate(st)
  let best = -Infinity
  for (const m of moves) {
    best = Math.max(best, -negamax(apply(st, m), depth - 1, -beta, -alpha))
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 4, hard: 6 }

export function aiMove(st: State, difficulty: Difficulty, rng: Rng): Move {
  const moves = legalMoves(st)
  if (difficulty === 'easy' && rng() < 0.4) return moves[randomInt(rng, moves.length)]
  let best: Move[] = []
  let bestScore = -Infinity
  for (const m of moves) {
    const s = -negamax(apply(st, m), DEPTH[difficulty] - 1, -Infinity, Infinity)
    if (s > bestScore) [bestScore, best] = [s, [m]]
    else if (s === bestScore) best.push(m)
  }
  return best[randomInt(rng, best.length)]
}
