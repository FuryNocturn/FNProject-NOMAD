import type { TFunction } from 'i18next'
import type { ModelVisionCapability } from '../../types/ollama.js'

// English fallback when no `t` is passed (unit tests run without i18n).
// Keep in sync with chat.vision.* in i18n/locales/en/chat.json.
const ENGLISH = {
  temporary:
    'Images are sent only with this request. They are not saved and will disappear after you send them or reload this page.',
  unsupported:
    'This model cannot use images. Choose a model marked “Supports images” in Models & Settings.',
  unknown:
    'NOMAD cannot confirm whether this model accepts images. You can try an image, but the request will fail if the model is text-only.',
}

export function visionAttachmentGuidance(capability: ModelVisionCapability, t?: TFunction): string {
  const text = (key: keyof typeof ENGLISH) => (t ? t(`chat.vision.${key}`) : ENGLISH[key])

  if (capability === 'unsupported') {
    return text('unsupported')
  }

  if (capability === 'unknown') {
    return `${text('unknown')} ${text('temporary')}`
  }

  return text('temporary')
}
