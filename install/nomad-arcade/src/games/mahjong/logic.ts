import { type Rng, randomInt, shuffled } from '../../lib/rng'

/**
 * Mahjong solitaire on a four-layer pyramid of 82 tiles. A tile is free when
 * nothing lies on it and its left or right side is open. Remove free pairs of
 * the same face until the board is clear.
 */
export type Pos = { x: number; y: number; z: number }
export type Tile = Pos & { id: number; face: number }
export type State = { tiles: Tile[]; removed: number[]; shuffles: number }

/** Layer z: a w x h block whose top-left cell is (ox, oy) on the 8x6 base grid. */
const LAYERS = [
  { w: 8, h: 6, ox: 0, oy: 0 },
  { w: 6, h: 4, ox: 1, oy: 1 },
  { w: 4, h: 2, ox: 2, oy: 2 },
  { w: 2, h: 1, ox: 3, oy: 2 },
]

export const LAYOUT: Pos[] = LAYERS.flatMap(({ w, h, ox, oy }, z) =>
  Array.from({ length: w * h }, (_, i) => ({ x: ox + (i % w), y: oy + Math.floor(i / w), z }))
)

/** 36 faces: three suits of 1-9, four winds, three dragons, two flowers. */
export const FACE_COUNT = 36

const key = (p: Pos) => `${p.x},${p.y},${p.z}`

export function isFree(present: Set<string>, p: Pos): boolean {
  if (present.has(key({ ...p, z: p.z + 1 }))) return false
  return !present.has(key({ ...p, x: p.x - 1 })) || !present.has(key({ ...p, x: p.x + 1 }))
}

/**
 * Assigns faces by playing the board backwards: repeatedly take two tiles that
 * are free right now and give them the same face. Taking them in that order
 * clears the board, so every deal can be solved.
 */
function assignFaces(positions: Pos[], pairFaces: number[], rng: Rng): number[] | null {
  const present = new Set(positions.map(key))
  const faces = new Map<string, number>()
  for (const face of shuffled(pairFaces, rng)) {
    const free = positions.filter((p) => present.has(key(p)) && isFree(present, p))
    if (free.length < 2) return null
    const a = free.splice(randomInt(rng, free.length), 1)[0]
    present.delete(key(a))
    // The partner must still be free once the first tile is gone.
    const now = positions.filter((p) => present.has(key(p)) && isFree(present, p))
    const b = now[randomInt(rng, now.length)]
    present.delete(key(b))
    faces.set(key(a), face)
    faces.set(key(b), face)
  }
  return positions.map((p) => faces.get(key(p))!)
}

export function newGame(rng: Rng): State {
  for (;;) {
    const faces = assignFaces(LAYOUT, Array.from({ length: LAYOUT.length / 2 }, (_, i) => i % FACE_COUNT), rng)
    if (faces) return { tiles: LAYOUT.map((p, id) => ({ ...p, id, face: faces[id] })), removed: [], shuffles: 0 }
  }
}

export const remaining = (st: State) => st.tiles.filter((t) => !st.removed.includes(t.id))

export function freeTiles(st: State): Tile[] {
  const left = remaining(st)
  const present = new Set(left.map(key))
  return left.filter((t) => isFree(present, t))
}

export function removePair(st: State, a: number, b: number): State | null {
  const free = freeTiles(st)
  const ta = free.find((t) => t.id === a)
  const tb = free.find((t) => t.id === b)
  if (!ta || !tb || a === b || ta.face !== tb.face) return null
  return { ...st, removed: [...st.removed, a, b] }
}

/** A removable pair, if any. */
export function hint(st: State): [number, number] | null {
  const free = freeTiles(st)
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) if (free[i].face === free[j].face) return [free[i].id, free[j].id]
  return null
}

/** Re-deals the faces of the remaining tiles so that the rest can still be cleared. */
export function reshuffle(st: State, rng: Rng): State {
  const left = remaining(st)
  // One entry per pair still on the board, so the same faces come back.
  const counts = new Map<number, number>()
  for (const t of left) counts.set(t.face, (counts.get(t.face) ?? 0) + 1)
  const pairFaces = [...counts].flatMap(([f, n]) => Array<number>(n / 2).fill(f))
  for (let tries = 0; tries < 50; tries++) {
    const faces = assignFaces(left, pairFaces, rng)
    if (!faces) continue
    const byId = new Map(left.map((t, i) => [t.id, faces[i]]))
    return { ...st, tiles: st.tiles.map((t) => (byId.has(t.id) ? { ...t, face: byId.get(t.id)! } : t)), shuffles: st.shuffles + 1 }
  }
  return st
}

export const isWon = (st: State) => st.removed.length === st.tiles.length
