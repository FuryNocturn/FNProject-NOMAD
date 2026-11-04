import { generate, minPushes, parse, solved, walk } from './logic'

test('generated levels are solvable in the number of pushes they report', () => {
  for (const n of [1, 2, 3, 5, 8, 12, 16, 20]) {
    const { level, start, pushes } = generate(n)
    expect(solved(level, start), `level ${n}`).toBe(false)
    expect(level.goals.filter(Boolean).length).toBe(start.boxes.length)
    expect(minPushes(level, start), `level ${n}`).toBe(pushes)
  }
}, 60_000)

test('the same level number gives the same puzzle, and later levels are harder', () => {
  expect(generate(4)).toEqual(generate(4))
  expect(generate(20).pushes).toBeGreaterThan(generate(1).pushes)
}, 30_000)

test('walking, pushing and blocked pushes', () => {
  const { level, start } = parse(['#####', '#@$ #', '# $ #', '#####'])
  const pushed = walk(level, start, 'right')!
  expect(pushed.pushed).toBe(true)
  expect(pushed.pos.boxes).toContain(8)
  // A box against the wall does not move.
  expect(walk(level, pushed.pos, 'right')).toBeNull()
  // Two boxes in a row cannot be pushed.
  expect(walk(level, { player: 2, boxes: [7, 12] }, 'down')).toBeNull()
})
