import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StyledButton from '~/components/StyledButton'
import StyledTable from '~/components/StyledTable'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import ActiveDownloads from '~/components/ActiveDownloads'
import Alert from '~/components/Alert'
import type { ContentUpdateCheckResult, ResourceUpdateInfo } from '../../../types/collections'
import api from '~/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/NotificationContext'
import { formatBytes } from '~/lib/util'

export default function ContentUpdatesSection() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const [checkResult, setCheckResult] = useState<ContentUpdateCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set())
  const [isApplyingAll, setIsApplyingAll] = useState(false)

  const handleCheck = async () => {
    setIsChecking(true)
    try {
      const result = await api.checkForContentUpdates()
      if (result) {
        setCheckResult(result)
      }
    } catch {
      setCheckResult({
        updates: [],
        checked_at: new Date().toISOString(),
        error: t('settingsSystem.contentUpdates.checkFailed'),
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleApply = async (update: ResourceUpdateInfo) => {
    setApplyingIds((prev) => new Set(prev).add(update.resource_id))
    try {
      const result = await api.applyContentUpdate(update)
      if (result?.success) {
        addNotification({ type: 'success', message: t('settingsSystem.contentUpdates.started', { id: update.resource_id }) })
        // Remove from the updates list
        setCheckResult((prev) =>
          prev
            ? { ...prev, updates: prev.updates.filter((u) => u.resource_id !== update.resource_id) }
            : prev
        )
        // Force Active Downloads to refetch now — small updates finish before the next
        // idle poll fires, so without this the user wouldn't see them.
        queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
      } else {
        addNotification({ type: 'error', message: result?.error || t('settingsSystem.contentUpdates.startFailed') })
      }
    } catch {
      addNotification({ type: 'error', message: t('settingsSystem.contentUpdates.startFailedFor', { id: update.resource_id }) })
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev)
        next.delete(update.resource_id)
        return next
      })
    }
  }

  const handleApplyAll = async () => {
    if (!checkResult?.updates.length) return
    setIsApplyingAll(true)
    try {
      const result = await api.applyAllContentUpdates(checkResult.updates)
      if (result?.results) {
        const succeeded = result.results.filter((r) => r.success).length
        const failed = result.results.filter((r) => !r.success).length
        if (succeeded > 0) {
          addNotification({ type: 'success', message: t('settingsSystem.contentUpdates.startedCount', { count: succeeded }) })
        }
        if (failed > 0) {
          addNotification({ type: 'error', message: t('settingsSystem.contentUpdates.failedCount', { count: failed }) })
        }
        // Remove successful updates from the list
        const successIds = new Set(result.results.filter((r) => r.success).map((r) => r.resource_id))
        setCheckResult((prev) =>
          prev
            ? { ...prev, updates: prev.updates.filter((u) => !successIds.has(u.resource_id)) }
            : prev
        )
        if (successIds.size > 0) {
          queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
        }
      }
    } catch {
      addNotification({ type: 'error', message: t('settingsSystem.contentUpdates.applyFailed') })
    } finally {
      setIsApplyingAll(false)
    }
  }

  return (
    <div className="mt-8">
      <StyledSectionHeader title={t('settingsSystem.contentUpdates.title')} />

      <div className="bg-surface-primary rounded-lg border shadow-md overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <p className="text-desert-stone-dark">
            {t('settingsSystem.contentUpdates.description')}
          </p>
          <StyledButton
            variant="primary"
            icon="IconRefresh"
            onClick={handleCheck}
            loading={isChecking}
          >
            {t('settingsSystem.contentUpdates.check')}
          </StyledButton>
        </div>

        {checkResult?.error && (
          <Alert
            type="warning"
            title={t('settingsSystem.contentUpdates.issueTitle')}
            message={checkResult.error}
            variant="bordered"
            className="my-4"
          />
        )}

        {checkResult && !checkResult.error && checkResult.updates.length === 0 && (
          <Alert
            type="success"
            title={t('settingsSystem.contentUpdates.allUpToDateTitle')}
            message={t('settingsSystem.contentUpdates.allUpToDateMessage')}
            variant="bordered"
            className="my-4"
          />
        )}

        {checkResult && checkResult.updates.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-desert-stone-dark">
                {t('settingsSystem.contentUpdates.available', { count: checkResult.updates.length })}
              </p>
              <StyledButton
                variant="primary"
                size="sm"
                icon="IconDownload"
                onClick={handleApplyAll}
                loading={isApplyingAll}
              >
                {t('settingsSystem.contentUpdates.updateAll', { count: checkResult.updates.length })}
              </StyledButton>
            </div>
            <StyledTable
              data={checkResult.updates}
              columns={[
                {
                  accessor: 'resource_id',
                  title: t('settingsSystem.contentUpdates.colTitle'),
                  render: (record) => (
                    <span className="font-medium text-desert-green">{record.resource_id}</span>
                  ),
                },
                {
                  accessor: 'resource_type',
                  title: t('settingsSystem.contentUpdates.colType'),
                  render: (record) => (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${record.resource_type === 'zim'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                        }`}
                    >
                      {record.resource_type === 'zim' ? 'ZIM' : t('settingsSystem.contentUpdates.typeMap')}
                    </span>
                  ),
                },
                {
                  accessor: 'size_bytes',
                  title: t('settingsSystem.contentUpdates.colSize'),
                  render: (record) => (
                    <span className="text-desert-stone-dark">
                      {record.size_bytes ? formatBytes(record.size_bytes, 1) : '—'}
                    </span>
                  ),
                },
                {
                  accessor: 'installed_version',
                  title: t('settingsSystem.contentUpdates.colVersion'),
                  render: (record) => (
                    <span className="text-desert-stone-dark">
                      {record.installed_version} → {record.latest_version}
                    </span>
                  ),
                },
                {
                  accessor: 'resource_id',
                  title: '',
                  render: (record) => (
                    <StyledButton
                      variant="secondary"
                      size="sm"
                      icon="IconDownload"
                      onClick={() => handleApply(record)}
                      loading={applyingIds.has(record.resource_id)}
                    >
                      {t('settingsSystem.contentUpdates.update')}
                    </StyledButton>
                  ),
                },
              ]}
            />
          </div>
        )}

        {checkResult?.checked_at && (
          <p className="text-xs text-desert-stone mt-3">
            {t('settingsSystem.contentUpdates.lastChecked', {
              time: new Date(checkResult.checked_at).toLocaleString(),
            })}
          </p>
        )}
      </div>

      <ActiveDownloads withHeader />
    </div>
  )
}
