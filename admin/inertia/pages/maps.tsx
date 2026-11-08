import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'

import MapsLayout from '~/layouts/MapsLayout'
import MapComponent, { type MapCommand } from '~/components/maps/MapComponent'
import StyledButton from '~/components/StyledButton'
import {
  IconArrowLeft,
  IconCrosshair,
  IconMapPin,
  IconPlaneTilt,
  IconRulerMeasure,
} from '@tabler/icons-react'
import { FileEntry } from '../../types/files'
import Alert from '~/components/Alert'
import { useNotifications } from '~/context/NotificationContext'
import {
  findRegionByLabel,
  parseLatLng,
  zoomForPlace,
  type JumpRegion,
  type PlaceResult,
} from '~/lib/map_jump'
import { fetchRegionBounds } from '~/lib/map_region_bounds'
import MapJumpSearch from '~/components/maps/MapJumpSearch'

/** The view MapComponent saves on every move: used to rank nearby search results first. */
function currentMapCenter(): { lat: number; lng: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem('nomad:map-view') ?? 'null')
    if (Number.isFinite(saved?.latitude) && Number.isFinite(saved?.longitude)) {
      return { lat: saved.latitude, lng: saved.longitude }
    }
  } catch {
    // no saved view yet
  }
  return null
}

export default function Maps(props: {
  maps: {
    baseAssetsExist: boolean
    worldBasemapExists: boolean
    regionFiles: FileEntry[]
    regions: JumpRegion[]
  }
}) {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const [isHoveringUI, setIsHoveringUI] = useState(false)

  const [jumpText, setJumpText] = useState('')
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null)
  const [showCoordinatesEnabled, setShowCoordinatesEnabled] = useState(true)
  const [measureEnabled, setMeasureEnabled] = useState(false)

  const regions = props.maps.regions ?? []

  const jumpToRegion = async (region: JumpRegion) => {
    // Clear right away so the list shows every region again on the next focus.
    setJumpText('')
    try {
      const bounds = await fetchRegionBounds(region.url)
      setMapCommand({ id: Date.now(), action: 'fit', bounds })
    } catch {
      addNotification({
        type: 'error',
        message: `Could not read the map file for ${region.label}.`,
      })
    }
  }

  const handleCoordinateAction = (action: 'fly' | 'marker') => {
    const coordinates = parseLatLng(jumpText)
    if (!coordinates) return

    setMapCommand({
      id: Date.now(),
      ...coordinates,
      action,
    })
  }

  // Enter and the fly button: a downloaded region by name, otherwise lat,lng.
  const handleJump = () => {
    const region = findRegionByLabel(jumpText, regions)
    if (region) {
      void jumpToRegion(region)
      return
    }
    handleCoordinateAction('fly')
  }

  const jumpToPlace = (place: PlaceResult) => {
    setJumpText('')
    setMapCommand({
      id: Date.now(),
      action: 'fly',
      lat: place.lat,
      lng: place.lng,
      zoom: zoomForPlace(place.layer, place.kind),
    })
  }

  const alertMessage = !props.maps.baseAssetsExist
    ? t('maps.page.baseAssetsMissing')
    : !props.maps.worldBasemapExists
    ? t('maps.page.worldBasemapMissing')
    : props.maps.regionFiles.length === 0
    ? t('maps.page.noRegions')
    : null

  return (
    <MapsLayout>
      <Head title={t('maps.page.headTitle')} />

      <div className="relative w-full h-screen overflow-hidden">
        {/* Navbar */}
        <div
          className="absolute top-0 left-0 right-0 z-50 flex justify-between p-4 bg-surface-secondary backdrop-blur-sm shadow-sm"
          onMouseEnter={() => setIsHoveringUI(true)}
          onMouseLeave={() => setIsHoveringUI(false)}
        >
          <Link href="/home" className="flex items-center">
            <IconArrowLeft className="mr-2" size={24} />
            <p className="text-lg text-text-secondary">{t('common.backToHome')}</p>
          </Link>

          <div className="flex items-center gap-2">
            <MapJumpSearch
              text={jumpText}
              onTextChange={setJumpText}
              regions={regions}
              onPickRegion={(region) => void jumpToRegion(region)}
              onPickPlace={jumpToPlace}
              onSubmitText={handleJump}
              getNear={currentMapCenter}
            />

            <button
              type="button"
              onClick={handleJump}
              className="rounded border border-border-default bg-surface-primary p-2 text-text-secondary hover:bg-surface-secondary"
              title={t('maps.page.flyToRegionOrCoordinates')}
            >
              <IconPlaneTilt size={18}/>
            </button>

            <button
              type="button"
              onClick={() => handleCoordinateAction('marker')}
              className="rounded border border-border-default bg-surface-primary p-2 text-text-secondary hover:bg-surface-secondary"
              title={t('maps.page.addMarkerAtCoordinates')}
            >
              <IconMapPin size={18}/>
            </button>

            <button
              type="button"
              onClick={() => setShowCoordinatesEnabled((prev) => !prev)}
              className={`rounded border border-border-default p-2 transition-colors ${
                showCoordinatesEnabled
                  ? 'bg-desert-green text-white'
                  : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
              }`}
              title={showCoordinatesEnabled ? t('maps.page.hideCoordinates') : t('maps.page.showCoordinates')}
            >
              <IconCrosshair size={18}/>
            </button>

            <button
              type="button"
              onClick={() => setMeasureEnabled((prev) => !prev)}
              className={`rounded border border-border-default p-2 transition-colors ${
                measureEnabled
                  ? 'bg-desert-green text-white'
                  : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
              }`}
              title={measureEnabled ? 'Stop measuring' : 'Measure distance and area'}
              aria-pressed={measureEnabled}
            >
              <IconRulerMeasure size={18}/>
            </button>

            <Link href="/settings/maps" className="mr-4">
              <StyledButton variant="primary" icon="IconSettings">
                {t('maps.page.manageRegions')}
              </StyledButton>
            </Link>
          </div>
        </div>

        {/* Alert */}
        {alertMessage && (
          <div
            className="absolute top-20 left-4 right-4 z-50"
            onMouseEnter={() => setIsHoveringUI(true)}
            onMouseLeave={() => setIsHoveringUI(false)}
          >
            <Alert
              title={alertMessage}
              type="warning"
              variant="solid"
              className="w-full"
              buttonProps={{
                variant: 'secondary',
                children: t('maps.page.goToMapSettings'),
                icon: 'IconSettings',
                onClick: () => router.visit('/settings/maps'),
              }}
            />
          </div>
        )}

        {/* Map */}

        <div className="absolute inset-0">
          <MapComponent
            mapCommand={mapCommand}
            isHoveringUI={isHoveringUI}
            showCoordinatesEnabled={showCoordinatesEnabled}
            measureEnabled={measureEnabled}
            onMeasureDone={() => setMeasureEnabled(false)}
          />
        </div>
      </div>
    </MapsLayout>
  )
}
