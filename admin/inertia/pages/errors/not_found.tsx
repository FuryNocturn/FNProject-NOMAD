import { useTranslation } from 'react-i18next'
export default function NotFound() {
  const { t } = useTranslation()
  return (
    <>
      <div className="container">
        <div className="title">{t('pages.errors.notFoundTitle')}</div>

        <span>{t('pages.errors.notFoundMessage')}</span>
      </div>
    </>
  )
}