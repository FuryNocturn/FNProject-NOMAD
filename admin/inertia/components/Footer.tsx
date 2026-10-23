import { useState } from 'react'
import { usePage } from '@inertiajs/react'
import { UsePageProps } from '../../types/system'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '~/components/ThemeToggle'
import LanguageSelect from '~/components/LanguageSelect'
import { IconBug } from '@tabler/icons-react'
import DebugInfoModal from './DebugInfoModal'

export default function Footer() {
  const { t } = useTranslation()
  const { appVersion } = usePage().props as unknown as UsePageProps
  const [debugModalOpen, setDebugModalOpen] = useState(false)

  return (
    <footer>
      <div className="flex items-center justify-center gap-3 border-t border-border-subtle py-4">
        <p className="text-sm/6 text-text-secondary">
          {t('common.version', { version: appVersion })}
        </p>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => setDebugModalOpen(true)}
          className="text-sm/6 text-gray-500 hover:text-desert-green flex items-center gap-1 cursor-pointer"
        >
          <IconBug className="size-3.5" />
          {t('common.debugInfo')}
        </button>
        <ThemeToggle />
        <LanguageSelect />
      </div>
      <DebugInfoModal open={debugModalOpen} onClose={() => setDebugModalOpen(false)} />
    </footer>
  )
}
