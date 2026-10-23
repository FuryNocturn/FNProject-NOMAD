import {
  IconBolt,
  IconBox,
  IconHelp,
  IconMapRoute,
  IconPill,
  IconSettings,
  IconWifiOff,
} from '@tabler/icons-react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import AppLayout from '~/layouts/AppLayout'
import { getServiceLink } from '~/lib/navigation'
import { ServiceSlim } from '../../types/services'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import { useUpdateAvailable } from '~/hooks/useUpdateAvailable'
import { useSystemSetting } from '~/hooks/useSystemSetting'
import {
  useBenchmarkRerunBanner,
  BENCHMARK_RERUN_BANNER_QUERY_KEY,
} from '~/hooks/useBenchmarkRerunBanner'
import { useQueryClient } from '@tanstack/react-query'
import api from '~/lib/api'
import Alert from '~/components/Alert'
import WhatsNewBanner from '~/components/WhatsNewBanner'
import { SERVICE_NAMES } from '../../constants/service_names'
import LinkTileModal from '~/components/LinkTileModal'
import { IconPlus, IconPencil, IconTrash, IconExternalLink } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { linkTileColor } from '../../constants/link_tile_colors'

// Built-in tiles carry a translation key (home.tiles.<tileKey>) instead of text;
// the label and description are resolved at render time.
type BuiltInItem = Omit<DashboardItem, 'label' | 'description'> & { tileKey: string }

// Maps is a Core Capability (display_order: 4)
const MAPS_ITEM: BuiltInItem = {
  tileKey: 'maps',
  to: '/maps',
  target: '',
  icon: <IconMapRoute size={48} />,
  installed: true,
  displayOrder: 4,
  poweredBy: null,
}

// Drug Reference + "When to use what" — offline medical reference tiles.
// icon and displayOrder here are a reasonable default; both are open for the
// maintainer to re-pick to fit the dashboard's ordering conventions.
const DRUG_REFERENCE_ITEM: BuiltInItem = {
  tileKey: 'drugReference',
  to: '/drug-reference',
  target: '',
  icon: <IconPill size={48} />,
  installed: true,
  displayOrder: 5,
  poweredBy: null,
}

// System items shown after all apps
const EASY_SETUP_PATH = '/easy-setup'

const SYSTEM_ITEMS: BuiltInItem[] = [
  {
    tileKey: 'easySetup',
    to: EASY_SETUP_PATH,
    target: '',
    icon: <IconBolt size={48} />,
    installed: true,
    displayOrder: 50,
    poweredBy: null,
  },
  {
    tileKey: 'supplyDepot',
    to: '/supply-depot',
    target: '',
    icon: <IconBox size={48} />,
    installed: true,
    displayOrder: 51,
    poweredBy: null,
  },
  {
    tileKey: 'docs',
    to: '/docs/home',
    target: '',
    icon: <IconHelp size={48} />,
    installed: true,
    displayOrder: 52,
    poweredBy: null,
  },
  {
    tileKey: 'settings',
    to: '/settings/system',
    target: '',
    icon: <IconSettings size={48} />,
    installed: true,
    displayOrder: 53,
    poweredBy: null,
  },
]

interface DashboardItem {
  label: string
  to: string
  target: string
  description: string
  icon: React.ReactNode
  installed: boolean
  displayOrder: number
  poweredBy: string | null
  /** Set only for user-added link tiles, which render differently and can be edited. */
  linkTile?: ServiceSlim
}

export default function Home(props: {
  system: {
    services: ServiceSlim[]
  }
  // Server-computed: true when the offline FDA drug dataset is installed or
  // installing (curated Medicine tier). Gates the two medical-reference tiles
  // below so they only appear once the data exists.
  drugReferenceInstalled: boolean
}) {
  const { t } = useTranslation()
  const items: DashboardItem[] = []
  const updateInfo = useUpdateAvailable();

  const translateTile = ({ tileKey, ...item }: BuiltInItem): DashboardItem => ({
    ...item,
    label: t(`home.tiles.${tileKey}.label`),
    description: t(`home.tiles.${tileKey}.description`),
  })
  const rerunBanner = useBenchmarkRerunBanner()
  const queryClient = useQueryClient()
  const { aiAssistantName } = usePage<{ aiAssistantName: string }>().props

  // Link tile management. `editingTile` null with the modal open means "create".
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [editingTile, setEditingTile] = useState<ServiceSlim | null>(null)
  // Deleting a tile is not undoable and the tiles are user-entered, so the trash
  // icon arms a confirm rather than deleting on the first click.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  const refreshServices = () => router.reload({ only: ['system'] })

  const handleDeleteTile = async (serviceName: string) => {
    const result = await api.deleteLinkTile(serviceName)
    setPendingDelete(null)
    if (!result?.success) {
      setLinkError(t('home.removeLinkFailed'))
      return
    }
    refreshServices()
  }


  const handleDismissRerunBanner = async () => {
    await api.updateSetting('benchmark.rerunBannerDismissed', true)
    queryClient.invalidateQueries({ queryKey: BENCHMARK_RERUN_BANNER_QUERY_KEY })
  }

  // Check if user has visited Easy Setup
  const { data: easySetupVisited } = useSystemSetting({
    key: 'ui.hasVisitedEasySetup'
  })
  const shouldHighlightEasySetup = easySetupVisited?.value ? String(easySetupVisited.value) !== 'true' : false

  // Add installed services (non-dependency services only). Link tiles are user-added
  // shortcuts with no container behind them, so they are collected separately below
  // and rendered with their own treatment.
  props.system.services
    .filter(
      (service) =>
        service.installed && (service.ui_location || service.custom_url) && !service.is_link_tile
    )
    .forEach((service) => {
      // Seeded apps have translations under services.<service_name>; anything else
      // (or a missing key) falls back to the text stored in the database.
      const name = t(`services.${service.service_name}.name`, {
        defaultValue: service.friendly_name || service.service_name,
      })
      items.push({
        // Inject custom AI Assistant name if this is the chat service
        label: service.service_name === SERVICE_NAMES.OLLAMA && aiAssistantName ? aiAssistantName : name,
        to:
          service.ui_location || service.custom_url
            ? getServiceLink(service.ui_location || '', service.custom_url)
            : '#',
        target: '_blank',
        description: t(`services.${service.service_name}.description`, {
          defaultValue: service.description || t('home.accessApp', { name }),
        }),
        icon: service.icon ? (
          <DynamicIcon icon={service.icon as DynamicIconName} className="!size-12" />
        ) : (
          <IconWifiOff size={48} />
        ),
        installed: service.installed,
        displayOrder: service.display_order ?? 100,
        poweredBy: service.powered_by ?? null,
      })
    })

  // User-added link tiles: shortcuts to things NOMAD does not manage.
  props.system.services
    .filter((service) => service.is_link_tile && service.custom_url)
    .forEach((service) => {
      items.push({
        label: service.friendly_name || service.service_name,
        to: getServiceLink('', service.custom_url),
        target: '_blank',
        description: service.description || t('home.opensInNewTab'),
        icon: <DynamicIcon icon={service.icon as DynamicIconName} className="!size-12" />,
        installed: true,
        displayOrder: service.display_order ?? 90,
        poweredBy: null,
        linkTile: service,
      })
    })

  // Add Maps as a Core Capability
  items.push(translateTile(MAPS_ITEM))

  // Add the offline medical-reference tiles only once the FDA drug dataset is
  // installed (or installing) via the curated Medicine tier. Both tiles read the
  // same drug_labels table, so they gate together off one server-computed flag.
  if (props.drugReferenceInstalled) {
    items.push(translateTile(DRUG_REFERENCE_ITEM))
  }

  // Add system items
  items.push(...SYSTEM_ITEMS.map(translateTile))

  // Sort all items by display order
  items.sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <AppLayout>
      <Head title={t('common.commandCenter')} />
      {
        updateInfo?.updateAvailable && (
          <div className='flex justify-center items-center p-4 w-full'>
            <Alert
              title={t('home.updateAvailable')}
              type="info-inverted"
              variant="solid"
              className="w-full"
              buttonProps={{
                variant: 'primary',
                children: t('common.goToSettings'),
                icon: 'IconSettings',
                onClick: () => router.visit('/settings/update'),
              }}
            />
          </div>
        )
      }
      <WhatsNewBanner />
      {
        rerunBanner?.show && (
          <div className='flex justify-center items-center px-4 pt-4 w-full'>
            <Alert
              title={t('home.benchmarkRerun.title')}
              message={t('home.benchmarkRerun.message')}
              type="info-inverted"
              variant="solid"
              className="w-full"
              dismissible
              onDismiss={handleDismissRerunBanner}
              buttonProps={{
                variant: 'primary',
                children: t('home.benchmarkRerun.button'),
                icon: 'IconRefresh',
                onClick: () => router.visit('/settings/benchmark'),
              }}
            />
          </div>
        )
      }
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {items.map((item) => {
          const isEasySetup = item.to === EASY_SETUP_PATH
          const shouldHighlight = isEasySetup && shouldHighlightEasySetup

          const isLinkTile = Boolean(item.linkTile)
          // A flat surface color read as a stark white card next to the filled
          // app tiles. Tint from the brand palette instead, user-chosen.
          const tileColor = linkTileColor(item.linkTile?.link_color)

          // Link tiles are deliberately not styled like managed apps: outlined
          // rather than filled, with an external-link marker. If they looked the
          // same, users would expect Start/Stop/Update and file bugs when those
          // controls are not there.
          const tileContent = (
            <div
              className={
                isLinkTile
                  ? `relative rounded border-2 border-dashed ${tileColor.border} ${tileColor.bg} text-text-primary hover:bg-surface-secondary transition-colors shadow-sm h-48 flex flex-col items-center justify-center cursor-pointer text-center px-4`
                  : 'relative rounded border-desert-green border-2 bg-desert-green hover:bg-transparent hover:text-text-primary text-white transition-colors shadow-sm h-48 flex flex-col items-center justify-center cursor-pointer text-center px-4'
              }
            >
              {isLinkTile && (
                <span
                  className={`absolute top-2 left-2 ${tileColor.marker}`}
                  title={t('home.linkTileHint')}
                >
                  <IconExternalLink size={16} />
                </span>
              )}
              {shouldHighlight && (
                <span className="absolute top-2 right-2 flex items-center justify-center">
                  <span
                    className="animate-ping absolute inline-flex w-16 h-6 rounded-full bg-desert-orange-light opacity-75"
                    style={{ animationDuration: '1.5s' }}
                  ></span>
                  <span className="relative inline-flex items-center rounded-full px-2.5 py-1 bg-desert-orange-light text-xs font-semibold text-white shadow-sm">
                    {t('home.startHere')}
                  </span>
                </span>
              )}
              <div className="flex items-center justify-center mb-2">{item.icon}</div>
              <h3 className="font-bold text-2xl">{item.label}</h3>
              {item.poweredBy && <p className="text-sm opacity-80">{t('home.poweredBy', { name: item.poweredBy })}</p>}
              <p className="xl:text-lg mt-2">{item.description}</p>
            </div>
          )

          if (isLinkTile) {
            const tile = item.linkTile!
            const confirming = pendingDelete === tile.service_name

            return (
              <div key={item.label} className="group relative">
                <a href={item.to} target="_blank" rel="noopener noreferrer">
                  {tileContent}
                </a>

                {confirming ? (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteTile(tile.service_name)}
                      className="rounded bg-desert-red px-2 py-1 text-xs font-medium text-white hover:brightness-110"
                    >
                      {t('common.remove')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-text-secondary hover:bg-surface-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTile(tile)
                        setLinkModalOpen(true)
                      }}
                      title={t('home.editLink')}
                      aria-label={t('home.editLink')}
                      className="rounded p-1 text-text-muted hover:bg-surface-secondary hover:text-text-primary"
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(tile.service_name)}
                      title={t('home.removeLink')}
                      aria-label={t('home.removeLink')}
                      className="rounded p-1 text-text-muted hover:bg-surface-secondary hover:text-desert-red"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          }

          return item.target === '_blank' ? (
            <a key={item.label} href={item.to} target="_blank" rel="noopener noreferrer">
              {tileContent}
            </a>
          ) : (
            <Link key={item.label} href={item.to}>
              {tileContent}
            </Link>
          )
        })}

        {/* Add-a-link affordance, last in the grid so it never displaces an app. */}
        <button
          type="button"
          onClick={() => {
            setEditingTile(null)
            setLinkModalOpen(true)
          }}
          className="rounded border-2 border-dashed border-border-default bg-transparent text-text-muted hover:border-desert-green hover:text-text-primary transition-colors h-48 flex flex-col items-center justify-center cursor-pointer text-center px-4"
        >
          <IconPlus size={40} />
          <h3 className="font-bold text-xl mt-2">{t('home.addLink')}</h3>
          <p className="text-sm mt-1">{t('home.addLinkHint')}</p>
        </button>
      </div>

      {linkError && (
        <div className="px-4 pb-4">
          <Alert title={linkError} type="error" variant="solid" className="w-full" />
        </div>
      )}

      <LinkTileModal
        open={linkModalOpen}
        tile={editingTile}
        onClose={() => setLinkModalOpen(false)}
        onSaved={() => {
          setLinkModalOpen(false)
          refreshServices()
        }}
        showError={(msg) => setLinkError(msg)}
      />
    </AppLayout>
  )
}
