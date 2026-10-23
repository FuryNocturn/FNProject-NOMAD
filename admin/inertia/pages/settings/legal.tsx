import { Head } from '@inertiajs/react'
import { useTranslation, Trans } from 'react-i18next'
import SettingsLayout from '~/layouts/SettingsLayout'

export default function LegalPage() {
  const { t } = useTranslation()
  return (
    <SettingsLayout>
      <Head title={t('settingsSystem.legal.pageTitle')} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6 max-w-4xl">
          <h1 className="text-4xl font-semibold mb-8">{t('settingsSystem.legal.title')}</h1>

          {/* License Agreement */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('settingsSystem.legal.license.title')}</h2>
            <p className="text-text-primary mb-3">{t('settingsSystem.legal.license.copyright')}</p>
            <p className="text-text-primary mb-3">
              {t('settingsSystem.legal.license.p1')}
            </p>
            <p className="text-text-primary mb-3">
              <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://www.apache.org/licenses/LICENSE-2.0</a>
            </p>
            <p className="text-text-primary">
              {t('settingsSystem.legal.license.p2')}
            </p>
          </section>

          {/* Third-Party Software */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('settingsSystem.legal.thirdParty.title')}</h2>
            <p className="text-text-primary mb-4">
              {t('settingsSystem.legal.thirdParty.intro')}
            </p>
            <ul className="space-y-3 text-text-primary">
              <li>
                <strong>Kiwix</strong> {t('settingsSystem.legal.thirdParty.kiwix')}
                <br />
                <a href="https://kiwix.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://kiwix.org</a>
              </li>
              <li>
                <strong>Kolibri</strong> {t('settingsSystem.legal.thirdParty.kolibri')}
                <br />
                <a href="https://learningequality.org/kolibri" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://learningequality.org/kolibri</a>
              </li>
              <li>
                <strong>Ollama</strong> {t('settingsSystem.legal.thirdParty.ollama')}
                <br />
                <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://ollama.com</a>
              </li>
              <li>
                <strong>CyberChef</strong> {t('settingsSystem.legal.thirdParty.cyberchef')}
                <br />
                <a href="https://github.com/gchq/CyberChef" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://github.com/gchq/CyberChef</a>
              </li>
              <li>
                <strong>FlatNotes</strong> {t('settingsSystem.legal.thirdParty.flatnotes')}
                <br />
                <a href="https://github.com/dullage/flatnotes" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://github.com/dullage/flatnotes</a>
              </li>
              <li>
                <strong>Qdrant</strong> {t('settingsSystem.legal.thirdParty.qdrant')}
                <br />
                <a href="https://github.com/qdrant/qdrant" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://github.com/qdrant/qdrant</a>
              </li>
            </ul>
          </section>

          {/* Privacy Statement */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('settingsSystem.legal.privacy.title')}</h2>
            <p className="text-text-primary mb-3">
              {t('settingsSystem.legal.privacy.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary">
              <li><Trans i18nKey="settingsSystem.legal.privacy.telemetry" components={{ b: <strong /> }} /></li>
              <li><Trans i18nKey="settingsSystem.legal.privacy.localFirst" components={{ b: <strong /> }} /></li>
              <li><Trans i18nKey="settingsSystem.legal.privacy.noAccounts" components={{ b: <strong /> }} /></li>
              <li><Trans i18nKey="settingsSystem.legal.privacy.networkOptional" components={{ b: <strong /> }} /></li>
            </ul>
          </section>

          {/* Content Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('settingsSystem.legal.content.title')}</h2>
            <p className="text-text-primary mb-3">
              {t('settingsSystem.legal.content.p1')}
            </p>
            <p className="text-text-primary mb-3">
              {t('settingsSystem.legal.content.p2')}
            </p>
            <p className="text-text-primary">
              {t('settingsSystem.legal.content.p3')}
            </p>
          </section>

          {/* Medical Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('settingsSystem.legal.medical.title')}</h2>
            <p className="text-text-primary mb-3">
              {t('settingsSystem.legal.medical.p1')}
            </p>
            <p className="text-text-primary mb-3 font-semibold">
              {t('settingsSystem.legal.medical.notSubstitute')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary mb-3">
              <li>{t('settingsSystem.legal.medical.i1')}</li>
              <li>{t('settingsSystem.legal.medical.i2')}</li>
              <li>{t('settingsSystem.legal.medical.i3')}</li>
              <li>{t('settingsSystem.legal.medical.i4')}</li>
            </ul>
          </section>

          {/* Data Storage Notice */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{t('settingsSystem.legal.storage.title')}</h2>
            <p className="text-text-primary mb-3">
              {t('settingsSystem.legal.storage.intro')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-primary">
              <li><Trans i18nKey="settingsSystem.legal.storage.installDir" components={{ b: <strong /> }} /></li>
              <li><Trans i18nKey="settingsSystem.legal.storage.downloaded" components={{ b: <strong /> }} /></li>
              <li><Trans i18nKey="settingsSystem.legal.storage.appData" components={{ b: <strong /> }} /></li>
            </ul>
            <p className="text-text-primary mt-3">
              {t('settingsSystem.legal.storage.outro')}
            </p>
          </section>

        </main>
      </div>
    </SettingsLayout>
  )
}
