import { Head } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import SettingsLayout from '~/layouts/SettingsLayout'
import CreatorPacksSection from '~/components/CreatorPacksSection'
import ActiveDownloads from '~/components/ActiveDownloads'
import useCreatorPacks from '~/hooks/useCreatorPacks'

export default function CreatorPacksPage() {
  const { t } = useTranslation()
  const { configured } = useCreatorPacks()

  return (
    <SettingsLayout>
      <Head title={t('settingsContent.creatorPacksPage.headTitle')} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <h1 className="text-4xl font-semibold mb-2">{t('settingsContent.creatorPacksPage.title')}</h1>
          <p className="text-text-muted mb-4">
            {t('settingsContent.creatorPacksPage.subtitle')}
          </p>

          {configured ? (
            <>
              <CreatorPacksSection allowUninstall />
              <div className="mt-10">
                <ActiveDownloads filetype="zim" withHeader />
              </div>
            </>
          ) : (
            <p className="text-text-muted mt-4">
              {t('settingsContent.creatorPacksPage.unavailable')}
            </p>
          )}
        </main>
      </div>
    </SettingsLayout>
  )
}
