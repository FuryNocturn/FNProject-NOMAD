import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import StyledButton from '~/components/StyledButton'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import { useNotifications } from '~/context/NotificationContext'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'

const selectClass =
  'rounded-md border border-border-default bg-surface-primary text-text-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-desert-green'

/** Parse "west, south, east, north"; null unless it is a valid box. */
function parseBbox(text: string): number[] | null {
  const n = text.split(/[,\s]+/).filter(Boolean).map(Number)
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null
  return n[0] < n[2] && n[1] < n[3] ? n : null
}

/** Ground resolution at a zoom, around mid latitudes (40°), for the zoom labels. */
const metersPerPixel = (z: number) => (156543 * Math.cos((40 * Math.PI) / 180)) / 2 ** z

/** Download offline aerial imagery / topographic maps for an area (#1175). */
export default function RasterMapDownload() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()

  const { data: providers = [] } = useQuery({
    queryKey: ['raster-providers'],
    queryFn: async () => (await api.getRasterProviders()) ?? [],
  })
  const { data: regions = [] } = useQuery({
    queryKey: ['raster-regions'],
    queryFn: async () => (await api.getRasterRegions()) ?? [],
  })

  const [providerId, setProviderId] = useState('ign-pnoa')
  const [area, setArea] = useState('')
  const [customBbox, setCustomBbox] = useState('')
  const [maxzoom, setMaxzoom] = useState(14)
  const [starting, setStarting] = useState(false)

  const provider = providers.find((p) => p.id === providerId)
  const region = regions.find((r) => r.id === area)
  const bbox = area === 'custom' ? parseBbox(customBbox) : (region?.bbox ?? null)
  const zooms = useMemo(
    () => Array.from({ length: (provider?.maxzoom ?? 16) - 9 }, (_, i) => 10 + i),
    [provider]
  )

  const { data: estimate, error: estimateError } = useQuery({
    queryKey: ['raster-estimate', providerId, bbox, maxzoom],
    queryFn: () => api.estimateRasterMap({ providerId, bbox: bbox!, maxzoom }),
    enabled: !!bbox && !!provider,
    retry: false,
  })

  const start = async () => {
    if (!bbox) return
    setStarting(true)
    const result = await api.downloadRasterMap({
      providerId,
      regionId: area === 'custom' ? `custom-${bbox.map((n) => n.toFixed(2)).join('_')}` : area,
      regionName: area === 'custom' ? t('settingsMaps.raster.customArea') : (region?.name ?? area),
      bbox,
      maxzoom,
    })
    setStarting(false)
    if (!result) return
    addNotification({
      message: result.created ? t('settingsMaps.raster.started') : t('settingsMaps.raster.alreadyRunning'),
      type: 'success',
    })
    queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
  }

  return (
    <section className="mt-12">
      <StyledSectionHeader title={t('settingsMaps.raster.title')} />
      <p className="text-sm text-text-muted mb-4">{t('settingsMaps.raster.intro')}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
          {t('settingsMaps.raster.source')}
          <select className={selectClass} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`settingsMaps.raster.providers.${p.id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
          {t('settingsMaps.raster.area')}
          <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">{t('settingsMaps.raster.chooseArea')}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value="custom">{t('settingsMaps.raster.customArea')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
          {t('settingsMaps.raster.detail')}
          <select className={selectClass} value={maxzoom} onChange={(e) => setMaxzoom(Number(e.target.value))}>
            {zooms.map((z) => (
              <option key={z} value={z}>
                {t('settingsMaps.raster.zoomOption', { zoom: z, meters: metersPerPixel(z).toFixed(1) })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {area === 'custom' && (
        <input
          className={`${selectClass} mt-3 w-full`}
          placeholder={t('settingsMaps.raster.bboxPlaceholder')}
          value={customBbox}
          onChange={(e) => setCustomBbox(e.target.value)}
        />
      )}
      {regions.length === 0 && (
        <p className="mt-2 text-xs text-text-muted">{t('settingsMaps.raster.noRegions')}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <StyledButton
          icon="IconCloudDownload"
          onClick={start}
          loading={starting}
          disabled={!estimate || starting}
        >
          {t('settingsMaps.raster.download')}
        </StyledButton>
        {estimate && (
          <span className="text-sm text-text-secondary">
            {t('settingsMaps.raster.estimate', {
              tiles: estimate.tiles.toLocaleString(),
              size: formatBytes(estimate.bytes),
            })}
          </span>
        )}
        {bbox && estimateError && (
          <span className="text-sm text-desert-red">{t('settingsMaps.raster.noCoverage')}</span>
        )}
      </div>
      {provider && (
        <p
          className="mt-3 text-xs text-text-muted [&_a]:underline"
          // Attribution strings are our own constants (raster_tiles.ts), not user input
          dangerouslySetInnerHTML={{ __html: provider.attribution }}
        />
      )}
    </section>
  )
}
