import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'

/**
 * UI languages. To add one: copy locales/en.json to locales/<code>.json,
 * translate the values, then add it here and to `resources` below.
 * Keys missing from a translation fall back to English.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const LANGUAGE_STORAGE_KEY = 'nomad:language'
const DEFAULT_LANGUAGE: Language = 'en'

export function isSupportedLanguage(code: unknown): code is Language {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code)
}

// Saved choice first, then the browser's language, then English.
function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isSupportedLanguage(stored)) return stored
  } catch {}
  const browser = navigator.language?.split('-')[0]
  return isSupportedLanguage(browser) ? browser : DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  // React already escapes rendered text
  interpolation: { escapeValue: false },
})

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
