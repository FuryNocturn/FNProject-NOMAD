import { Head } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { useAiAssistantName } from '~/hooks/useAiAssistantName'
import ChatComponent from '~/components/chat'

export default function Chat(props: { settings: { chatSuggestionsEnabled: boolean } }) {
  const { t } = useTranslation()
  const aiAssistantName = useAiAssistantName()
  return (
    <div className="w-full h-full">
      <Head title={t('chat.page.headTitle', { name: aiAssistantName })} />
      <ChatComponent enabled={true} suggestionsEnabled={props.settings.chatSuggestionsEnabled} />
    </div>
  )
}
