import { usePage } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'

// Must match the fallback in config/inertia.ts (sharedData.aiAssistantName)
const SERVER_DEFAULT_NAME = 'AI Assistant'

/** The assistant's display name: the user's custom name, or the translated default. */
export function useAiAssistantName(): string {
  const { t } = useTranslation()
  const { aiAssistantName } = usePage<{ aiAssistantName?: string }>().props
  return aiAssistantName && aiAssistantName !== SERVER_DEFAULT_NAME
    ? aiAssistantName
    : t('services.nomad_ollama.name')
}
