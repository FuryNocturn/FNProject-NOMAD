import { useI18n } from '../i18n'
import type { SCard } from './spanish'

/** "Rey de oros", "Joker"… for labels and messages. */
export function useSpanishName() {
  const { t } = useI18n()
  return (c: SCard) =>
    c.r === 0
      ? t('cards.joker')
      : t('cards.name', { rank: t(`cards.r${c.r}` as 'cards.r1'), suit: t(`cards.suit${c.s}` as 'cards.suit0') })
}
