import { type Rng, randomInt } from '../../lib/rng'

/**
 * Garden defence (our own take on the lane-defence genre). Five lanes, nine
 * columns. Plants cost sun; zombies walk in from the right. A lane's lawnmower
 * saves it once; a zombie reaching the house after that ends the game.
 * Time is in seconds; positions in columns (0 = house side, 9 = right edge).
 */
export const LANES = 5
export const COLS = 9

export type PlantKind = 'sunflower' | 'shooter' | 'walnut' | 'cherry'
export type ZombieKind = 'normal' | 'cone' | 'bucket'

export const PLANTS: Record<PlantKind, { cost: number; hp: number; recharge: number }> = {
  sunflower: { cost: 50, hp: 300, recharge: 7.5 },
  shooter: { cost: 100, hp: 300, recharge: 7.5 },
  walnut: { cost: 50, hp: 4000, recharge: 30 },
  cherry: { cost: 150, hp: 1000, recharge: 45 },
}
export const ZOMBIES: Record<ZombieKind, { hp: number; speed: number }> = {
  normal: { hp: 200, speed: 0.22 },
  cone: { hp: 560, speed: 0.22 },
  bucket: { hp: 1300, speed: 0.22 },
}
const BITE_DPS = 100
const PEA_DAMAGE = 20
const PEA_SPEED = 5
const SHOOT_EVERY = 1.5
const SUNFLOWER_EVERY = 12
const SKY_SUN_EVERY = 9
const SUN_LIFETIME = 10
const CHERRY_FUSE = 1
const CHERRY_DAMAGE = 1800

export type Plant = { kind: PlantKind; lane: number; col: number; hp: number; timer: number }
export type Zombie = { id: number; kind: ZombieKind; lane: number; x: number; hp: number }
export type Pea = { lane: number; x: number }
export type Sun = { id: number; lane: number; col: number; ttl: number }
export type State = {
  level: number
  time: number
  sun: number
  plants: Plant[]
  zombies: Zombie[]
  peas: Pea[]
  suns: Sun[]
  mowers: boolean[]
  recharge: Record<PlantKind, number>
  /** Spawn times and kinds still to come, in order. */
  waves: { at: number; kind: ZombieKind; lane: number }[]
  skyTimer: number
  nextId: number
  status: 'playing' | 'won' | 'lost'
}

/** Zombies for a level: more of them, tougher, with a final rush. */
export function schedule(level: number, rng: Rng): State['waves'] {
  const count = 8 + level * 4
  const out: State['waves'] = []
  let t = 20
  for (let k = 0; k < count; k++) {
    const roll = rng()
    const kind: ZombieKind = roll < Math.min(0.1 * level, 0.35) ? 'bucket' : roll < Math.min(0.15 + 0.1 * level, 0.6) ? 'cone' : 'normal'
    out.push({ at: t, kind, lane: randomInt(rng, LANES) })
    // Gaps shrink as the level goes on; the last fifth arrives together.
    const finalRush = k >= count * 0.8
    t += finalRush ? 1.2 : Math.max(4, 14 - level - k * 0.3)
  }
  return out
}

export function newGame(level: number, rng: Rng): State {
  return {
    level,
    time: 0,
    sun: 150,
    plants: [],
    zombies: [],
    peas: [],
    suns: [],
    mowers: Array(LANES).fill(true),
    recharge: { sunflower: 0, shooter: 0, walnut: 0, cherry: 0 },
    waves: schedule(level, rng),
    skyTimer: 4,
    nextId: 1,
    status: 'playing',
  }
}

export function canPlant(st: State, kind: PlantKind, lane: number, col: number): boolean {
  return (
    st.status === 'playing' && st.sun >= PLANTS[kind].cost && st.recharge[kind] <= 0 &&
    lane >= 0 && lane < LANES && col >= 0 && col < COLS &&
    !st.plants.some((p) => p.lane === lane && p.col === col)
  )
}

export function plant(st: State, kind: PlantKind, lane: number, col: number): State | null {
  if (!canPlant(st, kind, lane, col)) return null
  const timer = kind === 'sunflower' ? SUNFLOWER_EVERY / 2 : kind === 'cherry' ? CHERRY_FUSE : 0
  return {
    ...st,
    sun: st.sun - PLANTS[kind].cost,
    plants: [...st.plants, { kind, lane, col, hp: PLANTS[kind].hp, timer }],
    recharge: { ...st.recharge, [kind]: PLANTS[kind].recharge },
  }
}

export function collect(st: State, id: number): State {
  if (!st.suns.some((s) => s.id === id)) return st
  return { ...st, sun: st.sun + 25, suns: st.suns.filter((s) => s.id !== id) }
}

export function dig(st: State, lane: number, col: number): State {
  return { ...st, plants: st.plants.filter((p) => !(p.lane === lane && p.col === col)) }
}

/** Advances the garden by `dt` seconds. */
export function step(st: State, dt: number, rng: Rng): State {
  if (st.status !== 'playing') return st
  const time = st.time + dt
  let nextId = st.nextId
  const recharge = { ...st.recharge }
  for (const k of Object.keys(recharge) as PlantKind[]) recharge[k] = Math.max(0, recharge[k] - dt)

  // Arrivals.
  const zombies = st.zombies.map((z) => ({ ...z }))
  const waves = st.waves.filter((w) => {
    if (w.at > time) return true
    zombies.push({ id: nextId++, kind: w.kind, lane: w.lane, x: COLS + 0.4, hp: ZOMBIES[w.kind].hp })
    return false
  })

  // Suns: from the sky and from sunflowers; uncollected ones fade.
  const suns = st.suns.map((s) => ({ ...s, ttl: s.ttl - dt })).filter((s) => s.ttl > 0)
  let skyTimer = st.skyTimer - dt
  if (skyTimer <= 0) {
    suns.push({ id: nextId++, lane: randomInt(rng, LANES), col: randomInt(rng, COLS), ttl: SUN_LIFETIME })
    skyTimer = SKY_SUN_EVERY
  }

  let plants = st.plants.map((p) => ({ ...p, timer: p.timer - dt }))
  const peas = st.peas.map((p) => ({ ...p, x: p.x + PEA_SPEED * dt }))
  for (const p of plants) {
    if (p.kind === 'sunflower' && p.timer <= 0) {
      suns.push({ id: nextId++, lane: p.lane, col: p.col, ttl: SUN_LIFETIME })
      p.timer = SUNFLOWER_EVERY
    }
    if (p.kind === 'shooter' && p.timer <= 0 && zombies.some((z) => z.lane === p.lane && z.x > p.col && z.x < COLS + 0.5)) {
      peas.push({ lane: p.lane, x: p.col + 0.6 })
      p.timer = SHOOT_EVERY
    }
    if (p.kind === 'cherry' && p.timer <= 0) {
      for (const z of zombies) if (Math.abs(z.lane - p.lane) <= 1 && Math.abs(z.x - (p.col + 0.5)) <= 1.6) z.hp -= CHERRY_DAMAGE
      p.hp = 0
    }
  }

  // Peas hit the first zombie they reach in their lane.
  const flying = peas.filter((pea) => {
    const target = zombies
      .filter((z) => z.lane === pea.lane && z.hp > 0 && z.x <= pea.x && z.x > pea.x - PEA_SPEED * dt - 0.6)
      .sort((a, b) => a.x - b.x)[0]
    if (target) {
      target.hp -= PEA_DAMAGE
      return false
    }
    return pea.x < COLS + 1
  })

  // Zombies eat the plant in front of them, otherwise walk.
  for (const z of zombies) {
    if (z.hp <= 0) continue
    const food = plants.find((p) => p.lane === z.lane && p.hp > 0 && z.x - (p.col + 0.5) <= 0.55 && z.x - (p.col + 0.5) > -0.3)
    if (food && food.kind !== 'cherry') food.hp -= BITE_DPS * dt
    else z.x -= ZOMBIES[z.kind].speed * dt
  }
  plants = plants.filter((p) => p.hp > 0)

  // The house: a lawnmower clears the lane once; after that the game is lost.
  const mowers = [...st.mowers]
  let status: State['status'] = 'playing'
  for (const z of zombies) {
    if (z.hp <= 0 || z.x > 0) continue
    if (mowers[z.lane]) {
      mowers[z.lane] = false
      for (const o of zombies) if (o.lane === z.lane) o.hp = 0
    } else status = 'lost'
  }
  const alive = zombies.filter((z) => z.hp > 0)
  if (status === 'playing' && !waves.length && !alive.length) status = 'won'

  return { ...st, time, recharge, zombies: alive, waves, suns, skyTimer, plants, peas: flying, mowers, nextId, status }
}
