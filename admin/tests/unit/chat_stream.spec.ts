import assert from 'node:assert/strict'
import test from 'node:test'
import { chatStreamErrorMessage } from '../../inertia/lib/chat_stream.js'

test('chat stream preserves an actionable server error message', () => {
  assert.equal(
    chatStreamErrorMessage({
      error: true,
      message:
        'NOMAD cannot confirm that this model accepts images. Choose a model marked “Supports images”.',
    }),
    'NOMAD cannot confirm that this model accepts images. Choose a model marked “Supports images”.'
  )
  assert.equal(
    chatStreamErrorMessage({ error: true }),
    'The model encountered an error. Please try again.'
  )
  assert.equal(chatStreamErrorMessage({ done: true }), null)
})

test('chat stream translates the generic error when a t function is given', () => {
  const t = ((key: string) => `t:${key}`) as any
  assert.equal(chatStreamErrorMessage({ error: true }, t), 't:chat.main.modelError')
  assert.equal(chatStreamErrorMessage({ error: true, message: 'from server' }, t), 'from server')
})
