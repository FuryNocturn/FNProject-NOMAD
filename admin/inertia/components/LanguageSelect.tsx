import { IconLanguage } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import api from '~/lib/api'
import { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY, isSupportedLanguage } from '~/i18n'

export default function LanguageSelect() {
  const { t, i18n } = useTranslation()

  const changeLanguage = (code: string) => {
    if (!isSupportedLanguage(code)) return
    i18n.changeLanguage(code)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
    } catch {}
    // Fire-and-forget KV store sync, same as the theme setting
    api.updateSetting('ui.language', code).catch(() => {})
  }

  return (
    <label
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-desert-stone
                 hover:text-desert-green-darker cursor-pointer"
      title={t('language.select')}
    >
      <IconLanguage className="size-4" />
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        aria-label={t('language.select')}
        className="bg-transparent cursor-pointer outline-none"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  )
}
