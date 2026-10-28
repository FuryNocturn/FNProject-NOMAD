import { seededRng } from '../../lib/rng'
import { COLS, type State, collect, newGame, plant, step } from './logic'

/** No sky suns and one zombie far in the future, so the level neither spawns nor ends by itself. */
const quiet = (st: State): State => ({ ...st, waves: [{ at: 1e9, kind: 'normal', lane: 0 }], skyTimer: 1e9 })
const run = (st: State, seconds: number, rng = seededRng(1)) => {
  let s = st
  for (let t = 0; t < seconds; t += 0.1) s = step(s, 0.1, rng)
  return s
}

test('planting costs sun, needs a free cell and starts the recharge', () => {
  const st = newGame(1, seededRng(1))
  const a = plant(st, 'shooter', 2, 0)!
  expect(a.sun).toBe(50)
  expect(plant(a, 'shooter', 2, 1)).toBeNull() // recharging (and not enough sun)
  expect(plant(a, 'sunflower', 2, 0)).toBeNull() // occupied
})

test('sunflowers make suns that can be collected', () => {
  let st = quiet(plant(newGame(1, seededRng(2)), 'sunflower', 0, 0)!)
  st = run(st, 7)
  expect(st.suns.length).toBe(1)
  const sun = st.sun
  st = collect(st, st.suns[0].id)
  expect(st.sun).toBe(sun + 25)
})

test('a pea shooter stops a normal zombie in its lane', () => {
  let st = quiet(plant(newGame(1, seededRng(3)), 'shooter', 1, 0)!)
  st = { ...st, zombies: [{ id: 99, kind: 'normal', lane: 1, x: COLS, hp: 200 }] }
  st = run(st, 30)
  expect(st.zombies).toHaveLength(0)
  expect(st.plants).toHaveLength(1)
})

test('zombies eat plants, the lawnmower saves the lane once, then the game is lost', () => {
  let st = quiet(plant(newGame(1, seededRng(4)), 'sunflower', 3, 0)!)
  st = { ...st, zombies: [{ id: 1, kind: 'bucket', lane: 3, x: 1, hp: 1300 }] }
  st = run(st, 12)
  expect(st.plants).toHaveLength(0) // eaten
  expect(st.mowers[3]).toBe(false) // the mower went
  expect(st.zombies).toHaveLength(0)
  st = { ...st, zombies: [{ id: 2, kind: 'normal', lane: 3, x: 0.2, hp: 200 }] }
  expect(run(st, 2).status).toBe('lost')
})

test('the cherry clears zombies around it', () => {
  let st = quiet({ ...newGame(1, seededRng(5)), sun: 500 })
  st = { ...st, zombies: [{ id: 1, kind: 'bucket', lane: 2, x: 5.2, hp: 1300 }, { id: 2, kind: 'normal', lane: 3, x: 4.8, hp: 200 }] }
  st = plant(st, 'cherry', 2, 4)!
  st = run(st, 1.5)
  expect(st.zombies).toHaveLength(0)
})

test('clearing every scheduled zombie wins', () => {
  const st = { ...quiet(newGame(1, seededRng(6))), waves: [], zombies: [] }
  expect(step(st, 0.1, seededRng(6)).status).toBe('won')
})
