import { Head, router } from '@inertiajs/react'
import StyledTable from '~/components/StyledTable'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledButton from '~/components/StyledButton'
import { useModals } from '~/context/ModalContext'
import StyledModal from '~/components/StyledModal'
import { FileEntry } from '../../../types/files'
import { useNotifications } from '~/context/NotificationContext'
import { useEffect, useRef, useState } from 'react'
import api from '~/lib/api'
import DownloadURLModal from '~/components/DownloadURLModal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useDownloads from '~/hooks/useDownloads'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import CuratedCollectionCard from '~/components/CuratedCollectionCard'
import CountryPickerModal from '~/components/CountryPickerModal'
import type { CollectionWithStatus } from '../../../types/collections'
import ActiveDownloads from '~/components/ActiveDownloads'
import Alert from '~/components/Alert'
import { formatBytes } from '~/lib/util'
import { hasDownloadedGlobalMap } from '~/lib/global_map_banner'
import { Trans, useTranslation } from 'react-i18next'

const CURATED_COLLECTIONS_KEY = 'curated-map-collections'
const GLOBAL_MAP_INFO_KEY = 'global-map-info'

export default function MapsManager(props: {
  maps: { baseAssetsExist: boolean; worldBasemapExists: boolean; regionFiles: FileEntry[] }
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { openModal, closeAllModals } = useModals()
  const { addNotification } = useNotifications()
  const [downloading, setDownloading] = useState(false)
  const [deletingFileKey, setDeletingFileKey] = useState<string | null>(null)

  const { data: curatedCollections } = useQuery({
    queryKey: [CURATED_COLLECTIONS_KEY],
    queryFn: () => api.listCuratedMapCollections(),
    refetchOnWindowFocus: false,
  })

  const { data: activeMapDownloads = [], invalidate: invalidateDownloads } = useDownloads({
    filetype: 'map',
    enabled: true,
  })

  // Refresh the Stored Map Files list when a map download finishes. We pass props.maps.regionFiles
  // straight through from the server-side render, so without an Inertia partial reload it stays stale
  // until the user navigates away and back.
  const prevMapDownloadCountRef = useRef(activeMapDownloads.length)
  useEffect(() => {
    if (activeMapDownloads.length < prevMapDownloadCountRef.current) {
      router.reload({ only: ['maps'] })
    }
    prevMapDownloadCountRef.current = activeMapDownloads.length
  }, [activeMapDownloads.length])

  const { data: globalMapInfo } = useQuery({
    queryKey: [GLOBAL_MAP_INFO_KEY],
    queryFn: () => api.getGlobalMapInfo(),
    refetchOnWindowFocus: false,
  })
  const globalMapAlreadyDownloaded = hasDownloadedGlobalMap(globalMapInfo?.key, props.maps.regionFiles)

  const setupWorldBasemap = useMutation({
    mutationFn: () => api.setupWorldBasemap(),
    onSuccess: () => {
      addNotification({
        type: 'success',
        message: t('settingsMaps.notifications.baseMapDownloaded'),
      })
      router.reload({ only: ['maps'] })
    },
    onError: () => {
      addNotification({
        type: 'error',
        message: t('settingsMaps.notifications.baseMapFailed'),
      })
    },
  })

  const downloadGlobalMap = useMutation({
    mutationFn: () => api.downloadGlobalMap(),
    onSuccess: () => {
      invalidateDownloads()
      addNotification({
        type: 'success',
        message: t('settingsMaps.notifications.globalQueued'),
      })
      closeAllModals()
    },
    onError: (error) => {
      console.error('Error downloading global map:', error)
      addNotification({
        type: 'error',
        message: t('settingsMaps.notifications.globalFailed'),
      })
    },
  })

  async function downloadBaseAssets() {
    try {
      setDownloading(true)

      const res = await api.downloadBaseMapAssets()
      if (!res) {
        throw new Error(t('settingsMaps.notifications.baseAssetsUnknown'))
      }

      if (res.success) {
        addNotification({
          type: 'success',
          message: t('settingsMaps.notifications.baseAssetsDownloaded'),
        })
        router.reload()
      }
    } catch (error) {
      console.error('Error downloading base assets:', error)
      addNotification({
        type: 'error',
        message: t('settingsMaps.notifications.baseAssetsFailed'),
      })
    } finally {
      setDownloading(false)
    }
  }

  async function downloadCollection(record: CollectionWithStatus) {
    try {
      await api.downloadMapCollection(record.slug)
      invalidateDownloads()
      addNotification({
        type: 'success',
        message: t('settingsMaps.notifications.collectionQueued', { name: record.name }),
      })
    } catch (error) {
      console.error('Error downloading collection:', error)
    }
  }

  async function downloadCustomFile(url: string) {
    try {
      await api.downloadRemoteMapRegion(url)
      invalidateDownloads()
      addNotification({
        type: 'success',
        message: t('settingsMaps.notifications.downloadQueued'),
      })
    } catch (error) {
      console.error('Error downloading custom file:', error)
    }
  }

  async function deleteFile(file: FileEntry) {
    if (file.type !== 'file') return

    try {
      setDeletingFileKey(file.key)
      // Close first: the modal element is stored once, so its confirm button can't show loading
      // and would stay clickable during the request.
      closeAllModals()
      const res = await api.deleteMapRegionFile(file.name)
      // catchInternal returns undefined on failure instead of throwing
      if (!res) throw new Error('Delete failed')
      addNotification({
        type: 'success',
        message: t('settingsMaps.notifications.fileDeleted', { name: file.name }),
      })
      router.reload({ only: ['maps'] })
    } catch (error) {
      console.error('Error deleting map file:', error)
      addNotification({
        type: 'error',
        message: t('settingsMaps.notifications.fileDeleteFailed', { name: file.name }),
      })
    } finally {
      setDeletingFileKey(null)
    }
  }

  async function confirmDeleteFile(file: FileEntry) {
    openModal(
      <StyledModal
        title={t('settingsMaps.confirmDelete.title')}
        onConfirm={() => deleteFile(file)}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('settingsMaps.confirmDelete.confirm')}
        cancelText={t('common.cancel')}
        confirmVariant="danger"
        confirmLoading={file.type === 'file' && deletingFileKey === file.key}
      >
        <p className="text-text-secondary">
          {t('settingsMaps.confirmDelete.message', { name: file.name })}
        </p>
      </StyledModal>,
      'confirm-delete-file-modal'
    )
  }

  async function confirmDownload(record: CollectionWithStatus) {
    const isCollection = 'resources' in record
    openModal(
      <StyledModal
        title={t('settingsMaps.confirmDownload.title')}
        onConfirm={() => {
          if (isCollection) {
            if (record.all_installed) {
              addNotification({
                message: t('settingsMaps.notifications.collectionAlreadyInstalled', { name: record.name }),
                type: 'info',
              })
              return
            }
            downloadCollection(record)
          }
          closeAllModals()
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('settingsMaps.confirmDownload.confirm')}
        cancelText={t('common.cancel')}
        confirmVariant="primary"
      >
        <p className="text-text-secondary">
          <Trans
            i18nKey="settingsMaps.confirmDownload.message"
            values={{ name: isCollection ? record.name : record }}
            components={{ strong: <strong /> }}
          />
        </p>
      </StyledModal>,
      'confirm-download-file-modal'
    )
  }

  async function confirmGlobalMapDownload() {
    if (!globalMapInfo) return
    openModal(
      <StyledModal
        title={t('settingsMaps.confirmGlobal.title')}
        onConfirm={() => downloadGlobalMap.mutate()}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('settingsMaps.confirmGlobal.confirm')}
        cancelText={t('common.cancel')}
        confirmVariant="primary"
        confirmLoading={downloadGlobalMap.isPending}
      >
        <p className="text-text-secondary">
          {t('settingsMaps.confirmGlobal.message', {
            size: formatBytes(globalMapInfo.size, 1),
            date: globalMapInfo.date,
          })}
        </p>
      </StyledModal>,
      'confirm-global-map-download-modal'
    )
  }

  function openCountryPickerModal() {
    openModal(
      <CountryPickerModal
        onCancel={closeAllModals}
        installedFilenames={(props.maps.regionFiles ?? []).map((f) => f.name)}
        onDownloadStart={() => {
          invalidateDownloads()
          addNotification({
            type: 'success',
            message: t('settingsMaps.notifications.countryDownloadQueued'),
          })
          closeAllModals()
        }}
      />,
      'country-picker-modal'
    )
  }

  async function openDownloadModal() {
    openModal(
      <DownloadURLModal
        title={t('settingsMaps.page.downloadMapFileTitle')}
        suggestedURL={t('settingsMaps.page.suggestedUrl')}
        onCancel={() => closeAllModals()}
        onPreflightSuccess={async (url) => {
          await downloadCustomFile(url)
          closeAllModals()
        }}
      />,
      'download-map-file-modal'
    )
  }

  const refreshManifests = useMutation({
    mutationFn: () => api.refreshManifests(),
    onSuccess: () => {
      addNotification({
        message: t('settingsMaps.notifications.manifestsRefreshed'),
        type: 'success',
      })
      queryClient.invalidateQueries({ queryKey: [CURATED_COLLECTIONS_KEY] })
    },
  })

  return (
    <SettingsLayout>
      <Head title={t('settingsMaps.page.headTitle')} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-4xl font-semibold mb-2">{t('settingsMaps.page.title')}</h1>
              <p className="text-text-muted">{t('settingsMaps.page.subtitle')}</p>
            </div>
            <div className="flex space-x-4">

            </div>
          </div>
          {!props.maps.baseAssetsExist && (
            <Alert
              title={t('settingsMaps.page.baseAssetsMissing')}
              type="warning"
              variant="solid"
              className="my-4"
              buttonProps={{
                variant: 'secondary',
                children: t('settingsMaps.page.downloadBaseAssets'),
                icon: 'IconDownload',
                loading: downloading,
                onClick: () => downloadBaseAssets(),
              }}
            />
          )}
          {props.maps.baseAssetsExist && !props.maps.worldBasemapExists && (
            <Alert
              title={t('settingsMaps.page.worldBasemapMissingTitle')}
              message={t('settingsMaps.page.worldBasemapMissingMessage')}
              type="warning"
              variant="solid"
              className="my-4"
              buttonProps={{
                variant: 'secondary',
                children: t('settingsMaps.page.downloadBaseMap'),
                icon: 'IconCloudDownload',
                loading: setupWorldBasemap.isPending,
                onClick: () => setupWorldBasemap.mutate(),
              }}
            />
          )}
          {globalMapInfo && globalMapAlreadyDownloaded && (
            <Alert
              title={t('settingsMaps.page.globalInstalledTitle')}
              message={t('settingsMaps.page.globalInstalledMessage', {
                date: globalMapInfo.date,
                size: formatBytes(globalMapInfo.size, 1),
              })}
              type="success"
              variant="bordered"
              className="mt-8"
              icon="IconCircleCheck"
              buttonProps={{
                variant: 'secondary',
                children: t('settingsMaps.page.downloadLatestBuild'),
                icon: 'IconRefresh',
                onClick: () => confirmGlobalMapDownload(),
              }}
            />
          )}
          {globalMapInfo && !globalMapAlreadyDownloaded && (
            <Alert
              title={t('settingsMaps.page.globalAvailableTitle')}
              message={t('settingsMaps.page.globalAvailableMessage', {
                size: formatBytes(globalMapInfo.size, 1),
                date: globalMapInfo.date,
              })}
              type="info-inverted"
              variant="bordered"
              className="mt-8"
              icon="IconWorld"
              buttonProps={{
                variant: 'primary',
                children: t('settingsMaps.page.downloadGlobalMap'),
                icon: 'IconCloudDownload',
                loading: downloadGlobalMap.isPending,
                onClick: () => confirmGlobalMapDownload(),
              }}
            />
          )}
          <Alert
            title={t('settingsMaps.page.countryAlertTitle')}
            message={t('settingsMaps.page.countryAlertMessage')}
            type="info-inverted"
            variant="bordered"
            className="mt-8"
            icon="IconMap2"
            buttonProps={{
              variant: 'primary',
              children: t('settingsMaps.page.chooseCountries'),
              icon: 'IconMap2',
              onClick: openCountryPickerModal,
            }}
          />

          <div className="mt-8 mb-6 flex items-center justify-between">
            <StyledSectionHeader title={t('settingsMaps.page.curatedRegions')} className="!mb-0" />
            <StyledButton
              onClick={() => refreshManifests.mutate()}
              disabled={refreshManifests.isPending}
              icon="IconRefresh"
            >
              {t('settingsMaps.page.forceRefresh')}
            </StyledButton>
          </div>
          <div className="!mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {curatedCollections?.map((collection) => (
              <CuratedCollectionCard
                key={collection.slug}
                collection={collection}
                onClick={(collection) => confirmDownload(collection)}
              />
            ))}
            {curatedCollections && curatedCollections.length === 0 && (
              <p className="text-text-muted">{t('settingsMaps.page.noCollections')}</p>
            )}
          </div>
          <div className="mt-12 mb-6 flex items-center justify-between">
            <StyledSectionHeader title={t('settingsMaps.page.storedFiles')} className="!mb-0" />
            <StyledButton
              variant="primary"
              onClick={openDownloadModal}
              loading={downloading}
              icon="IconCloudDownload"
            >
              {t('settingsMaps.page.downloadCustom')}
            </StyledButton>
          </div>
          <StyledTable<FileEntry & { actions?: any }>
            className="font-semibold mt-4"
            rowLines={true}
            loading={false}
            compact
            columns={[
              { accessor: 'name', title: t('settingsMaps.page.columnName') },
              {
                accessor: 'actions',
                title: t('settingsMaps.page.columnActions'),
                render: (record) => (
                  <div className="flex space-x-2">
                    <StyledButton
                      variant="danger"
                      icon={'IconTrash'}
                      onClick={() => {
                        confirmDeleteFile(record)
                      }}
                    >
                      {t('settingsMaps.page.delete')}
                    </StyledButton>
                  </div>
                ),
              },
            ]}
            data={props.maps.regionFiles || []}
          />
          <ActiveDownloads filetype="map" withHeader />
        </main>
      </div>
    </SettingsLayout>
  )
}
