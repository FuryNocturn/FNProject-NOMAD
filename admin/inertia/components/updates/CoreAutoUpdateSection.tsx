import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StyledButton from '~/components/StyledButton'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import Alert from '~/components/Alert'
import api from '~/lib/api'
import Input from '~/components/inputs/Input'
import Switch from '~/components/inputs/Switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/NotificationContext'
import { useAutoUpdateStatus } from '~/hooks/useAutoUpdateStatus'

// Labels are resolved at render time: settingsSystem.common.cooloff.h<value>
const COOLOFF_OPTIONS = [{ value: 24 }, { value: 48 }, { value: 72 }, { value: 168 }]

export default function CoreAutoUpdateSection() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useAutoUpdateStatus()

  const [windowStart, setWindowStart] = useState('02:00')
  const [windowEnd, setWindowEnd] = useState('05:00')
  const [cooloff, setCooloff] = useState(72)

  // Seed editable fields once the persisted status loads.
  useEffect(() => {
    if (status) {
      setWindowStart(status.windowStart)
      setWindowEnd(status.windowEnd)
      setCooloff(status.cooloffHours)
    }
  }, [status?.windowStart, status?.windowEnd, status?.cooloffHours])

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => api.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-update-status'] })
    },
    onError: () => {
      addNotification({ type: 'error', message: t('settingsSystem.coreAuto.toggleFailed') })
    },
  })

  const enabled = status?.enabled ?? false
  const autoDisabled = !!status?.autoDisabledReason

  const handleToggle = (value: boolean) => {
    saveMutation.mutate(
      { key: 'autoUpdate.enabled', value },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['auto-update-status'] })
          addNotification({
            type: 'success',
            message: value
              ? t('settingsSystem.coreAuto.enabled')
              : t('settingsSystem.coreAuto.disabled'),
          })
        },
      }
    )
  }

  const handleSaveWindow = async () => {
    try {
      await api.updateSetting('autoUpdate.windowStart', windowStart)
      await api.updateSetting('autoUpdate.windowEnd', windowEnd)
      await api.updateSetting('autoUpdate.cooloffHours', String(cooloff))
      queryClient.invalidateQueries({ queryKey: ['auto-update-status'] })
      addNotification({ type: 'success', message: t('settingsSystem.coreAuto.saved') })
    } catch {
      addNotification({ type: 'error', message: t('settingsSystem.coreAuto.saveFailed') })
    }
  }

  return (
    <>
      <StyledSectionHeader title={t('settingsSystem.coreAuto.title')} className="mt-8" />
      <div className="bg-surface-primary rounded-lg border shadow-md overflow-hidden mt-6 p-6">
        {autoDisabled && (
          <Alert
            type="warning"
            title={t('settingsSystem.coreAuto.disabledTitle')}
            message={status?.autoDisabledReason || t('settingsSystem.coreAuto.disabledDefault')}
            variant="bordered"
            className="mb-4"
          />
        )}

        <Switch
          checked={enabled}
          onChange={handleToggle}
          disabled={saveMutation.isPending || isLoading}
          label={t('settingsSystem.coreAuto.enable')}
          description={t('settingsSystem.coreAuto.description')}
        />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            name="autoUpdateWindowStart"
            label={t('settingsSystem.common.windowStart')}
            type="time"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            disabled={!enabled}
            helpText={t('settingsSystem.common.localServerTime')}
          />
          <Input
            name="autoUpdateWindowEnd"
            label={t('settingsSystem.common.windowEnd')}
            type="time"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            disabled={!enabled}
            helpText={t('settingsSystem.common.localServerTime')}
          />
          <div>
            <label
              htmlFor="autoUpdateCooloff"
              className="block text-base/6 font-medium text-text-primary"
            >
              {t('settingsSystem.common.cooloffPeriod')}
            </label>
            <p className="mt-1 text-sm text-text-muted">{t('settingsSystem.coreAuto.cooloffHelp')}</p>
            <select
              id="autoUpdateCooloff"
              value={cooloff}
              onChange={(e) => setCooloff(Number(e.target.value))}
              disabled={!enabled}
              className="mt-1.5 block w-full rounded-md bg-surface-primary px-3 py-2 text-base text-text-primary border border-border-default focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6 disabled:opacity-50"
            >
              {COOLOFF_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`settingsSystem.common.cooloff.h${opt.value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <StyledButton
            variant="primary"
            size="sm"
            onClick={handleSaveWindow}
            disabled={!enabled}
          >
            {t('settingsSystem.common.saveSchedule')}
          </StyledButton>
        </div>

        {enabled && status && (
          <div className="mt-6 pt-4 border-t border-desert-stone-light text-sm space-y-1">
            <p className="text-desert-stone-dark">
              <span className="font-medium">{t('settingsSystem.coreAuto.statusLabel')}</span>
              {status.eligibleTarget
                ? t('settingsSystem.coreAuto.eligible', { version: status.eligibleTarget.version })
                : t('settingsSystem.coreAuto.noEligible')}
            </p>
            <p className="text-desert-stone">
              <span className="font-medium">{t('settingsSystem.common.updateWindow')}</span>
              {status.withinWindow
                ? t('settingsSystem.coreAuto.inWindow')
                : t('settingsSystem.coreAuto.outOfWindow')}
            </p>
            {status.lastResult && (
              <p className="text-desert-stone">
                <span className="font-medium">{t('settingsSystem.coreAuto.lastCheck')}</span>
                {status.lastResult}
                {status.lastAttemptAt
                  ? ` (${new Date(status.lastAttemptAt).toLocaleString()})`
                  : ''}
              </p>
            )}
            {status.lastError && (
              <p className="text-desert-red">
                <span className="font-medium">{t('settingsSystem.common.lastError')}</span>
                {status.lastError}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
