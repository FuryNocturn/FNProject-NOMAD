import i18n, { type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * UI languages. Texts live in locales/<code>/<section>.json; each file name is
 * the first part of its keys (home.json → t('home.…')).
 * To add a language: copy the locales/en folder to locales/<code>, translate
 * the values, then add it to this list. Missing keys fall back to English.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
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

// Build { en: { translation: { home: {...}, common: {...} } }, es: ... } from the folders
const localeFiles = import.meta.glob<Record<string, unknown>>('./locales/*/*.json', {
  eager: true,
  import: 'default',
})
const resources: Resource = {}
for (const [path, texts] of Object.entries(localeFiles)) {
  const [, lang, section] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)!
  resources[lang] ??= { translation: {} }
  ;(resources[lang].translation as Record<string, unknown>)[section] = texts
}

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  // React already escapes rendered text
  interpolation: { escapeValue: false },
  // Skip the library's promotional console.info on every page load
  showSupportNotice: false,
})

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
