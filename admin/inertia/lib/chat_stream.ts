import type { TFunction } from 'i18next'

// English fallback when no `t` is passed (unit tests run without i18n).
// Keep in sync with chat.main.modelError in i18n/locales/en/chat.json.
const GENERIC_CHAT_STREAM_ERROR = 'The model encountered an error. Please try again.'

export function chatStreamErrorMessage(event: unknown, t?: TFunction): string | null {
  if (!event || typeof event !== 'object' || !('error' in event) || !event.error) {
    return null
  }

  const message = 'message' in event ? event.message : undefined
  if (typeof message === 'string' && message.trim()) return message
  return t ? t('chat.main.modelError') : GENERIC_CHAT_STREAM_ERROR
}
