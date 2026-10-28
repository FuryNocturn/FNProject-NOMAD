import { MAX_MISSES, guess, masked, misses, newGame, status } from './logic'

test('guessing reveals every occurrence; accents count as the plain letter', () => {
  let st = newGame('Corazón', 'cuerpo')
  st = guess(st, 'o')
  expect(masked(st)).toBe('_O___O_')
  st = guess(st, 'ó') // same as O: no new guess
  expect(st.guessed).toEqual(['O'])
})

test('ñ is a separate letter', () => {
  let st = newGame('piña', 'frutas')
  st = guess(st, 'n')
  expect(masked(st)).toBe('____')
  st = guess(st, 'ñ')
  expect(masked(st)).toBe('__Ñ_')
})

test('win by revealing the word, lose after too many misses', () => {
  let st = newGame('oso', 'animales')
  st = guess(guess(st, 'o'), 's')
  expect(status(st)).toBe('won')
  let lose = newGame('oso', 'animales')
  for (const l of 'abcdefghij'.slice(0, MAX_MISSES)) lose = guess(lose, l)
  expect(misses(lose)).toBe(MAX_MISSES)
  expect(status(lose)).toBe('lost')
})
