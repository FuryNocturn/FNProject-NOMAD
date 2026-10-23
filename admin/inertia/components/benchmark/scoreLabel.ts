import type { TFunction } from 'i18next'

/** Translated headline label for a benchmark type (partial runs are not the NOMAD Score). */
export function scoreLabel(t: TFunction, type: string): string {
  if (type === 'system') return t('settingsBenchmark.score.systemScore')
  if (type === 'ai') return t('settingsBenchmark.score.aiScore')
  return t('settingsBenchmark.score.nomadScore')
}
