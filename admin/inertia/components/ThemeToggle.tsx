import { IconSun, IconMoon } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useThemeContext } from '~/providers/ThemeProvider'

interface ThemeToggleProps {
  compact?: boolean
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useThemeContext()
  const isDark = theme === 'dark'
  const switchLabel = isDark ? t('theme.switchToDayOps') : t('theme.switchToNightOps')

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors
                 text-desert-stone hover:text-desert-green-darker cursor-pointer"
      aria-label={switchLabel}
      title={switchLabel}
    >
      {isDark ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
      {!compact && <span>{isDark ? t('theme.dayOps') : t('theme.nightOps')}</span>}
    </button>
  )
}
