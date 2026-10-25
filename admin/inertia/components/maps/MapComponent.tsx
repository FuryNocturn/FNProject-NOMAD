import { useTranslation } from 'react-i18next'
import Map, {
  FullscreenControl,
  Marker,
  MapProvider,
  NavigationControl,
  ScaleControl,
} from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { Protocol } from 'pmtiles'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useMapMarkers } from '~/hooks/useMapMarkers'

import MarkerPin from './MarkerPin'
import MarkerPanel from './MarkerPanel'
import CoordinateOverlay from './CoordinateOverlay'
import ViewMapMarkerPopup from './ViewMapMarkerPopup'
import MapMarkerFormPopup from './MapMarkerFormPopup'
import ScaleUnitToggle from './ScaleUnitSelector'

type ScaleUnit = 'imperial' | 'metric' | 'nautical'

type MapCommand = {
  id: number
  lat: number
  lng: number
  action: 'fly' | 'marker'
}

type MapComponentProps = {
  mapCommand?: MapCommand | null
  isHoveringUI?: boolean
  showCoordinatesEnabled?: boolean
}

type MapLocationParams = {
  lat: number
  lng: number
  zoom: number
}

const SAVED_MAP_VIEW_KEY = 'nomad:map-view'
const MAP_MODE_KEY = 'nomad:map-mode'
const MAP_MODES = ['street', 'aerial', 'hybrid', 'topographic'] as const
type MapMode = (typeof MAP_MODES)[number]
const DEFAULT_MAP_VIEW = { longitude: -101, latitude: 40, zoom: 3.5 }

type SavedMapView = { longitude: number; latitude: number; zoom: number }

const getMapLocationParams = (): MapLocationParams | null => {
  const params = new URLSearchParams(window.location.search)

  const latParam = params.get('lat')
  const lngParam = params.get('lng')
  const longParam = params.get('long')
  const rawLng = lngParam ?? longParam

  // Both coordinates must actually be present. Coercing a missing param instead
  // yields Number(null) === 0, which passes every bounds check below and flies
  // the map to 0,0 on a plain visit to /maps -- overriding the restored view and
  // then persisting Null Island back over it via onMoveEnd.
  if (!latParam || !rawLng) return null

  const lat = Number(latParam)
  const lng = Number(rawLng)
  const zoomParam = params.get('zoom')
  const zoom = zoomParam ? Number(zoomParam) : 12

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }

  if (!lngParam && longParam) {
    params.set('lng', longParam)
    params.delete('long')

    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    )
  }

  return {
    lat,
    lng,
    zoom: Number.isFinite(zoom) ? zoom : 12,
  }
}

// Restore the last map position/zoom from localStorage so a refresh of /maps doesn't snap back
// to the default US-wide view. Bounds-checked so a corrupt or out-of-range value falls through
// to the default instead of throwing.
const getSavedMapView = (): SavedMapView | null => {
  try {
    const raw = localStorage.getItem(SAVED_MAP_VIEW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      Number.isFinite(parsed.longitude) &&
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.zoom) &&
      parsed.latitude >= -90 &&
      parsed.latitude <= 90 &&
      parsed.longitude >= -180 &&
      parsed.longitude <= 180
    ) {
      return { longitude: parsed.longitude, latitude: parsed.latitude, zoom: parsed.zoom }
    }
  } catch {
    // ignore — fall through to default
  }
  return null
}

const isValidMarkerCoordinate = (marker: { longitude: number; latitude: number }) =>
  Number.isFinite(marker.longitude) &&
  Number.isFinite(marker.latitude) &&
  marker.longitude >= -180 &&
  marker.longitude <= 180 &&
  marker.latitude >= -90 &&
  marker.latitude <= 90
export default function MapComponent({
                                       mapCommand,
                                       isHoveringUI = false,
                                       showCoordinatesEnabled = true,
                                     }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null)
  const animationFrameRef = useRef<number | null>(null)
  const handledMapCommandIdRef = useRef<number | null>(null)

  const { t } = useTranslation()
  const { markers, addMarker, updateMarker, deleteMarker } = useMapMarkers()

  const [targetIndicator, setTargetIndicator] = useState<{ lng: number; lat: number } | null>(null)
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const [placingMarker, setPlacingMarker] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null)
  const [editingMarkerId, setEditingMarkerId] = useState<number | null>(null)
  const [hasUnsavedMarkerChanges, setHasUnsavedMarkerChanges] = useState(false)
  const [showCoordinates, setShowCoordinates] = useState(false)

  const getInitialScaleUnit = (): ScaleUnit => {
    const stored = localStorage.getItem('nomad:map-scale-unit')

    return stored === 'metric' || stored === 'imperial' || stored === 'nautical'
      ? stored
      : 'metric'
  }

  const [scaleUnit, setScaleUnit] = useState<ScaleUnit>(getInitialScaleUnit)

  // Raster archives (aerial / topographic, #1175) come in the style hidden; the
  // mode decides which layers show. Only offered when such archives exist.
  const [rasterRoles, setRasterRoles] = useState<string[]>([])
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    const stored = localStorage.getItem(MAP_MODE_KEY)
    return MAP_MODES.includes(stored as MapMode) ? (stored as MapMode) : 'street'
  })

  const applyMapMode = useCallback((mode: MapMode) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const wantRole = mode === 'street' ? null : mode === 'topographic' ? 'topographic' : 'aerial'
    for (const layer of map.getStyle()?.layers ?? []) {
      const role = (layer.metadata as Record<string, unknown> | undefined)?.['nomad:role']
      let visible: boolean
      if (layer.type === 'raster' && role) visible = role === wantRole
      else if (!('source' in layer) || !layer.source) visible = true // background
      else if (mode === 'street') visible = true
      // Hybrid keeps roads, borders and labels over the imagery
      else visible = mode === 'hybrid' && (layer.type === 'line' || layer.type === 'symbol')
      map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none')
    }
  }, [])

  const changeMapMode = useCallback(
    (mode: MapMode) => {
      setMapMode(mode)
      localStorage.setItem(MAP_MODE_KEY, mode)
      applyMapMode(mode)
    },
    [applyMapMode]
  )

  // Resolve the initial view once at mount: saved view → default. Lazy so it isn't recomputed
  // on every render.
  const [initialViewState] = useState(() => getSavedMapView() ?? DEFAULT_MAP_VIEW)

  const [cursorLngLat, setCursorLngLat] = useState<{
    lng: number
    lat: number
    x: number
    y: number
  } | null>(null)

  const hideCoordinates = useCallback(() => {
    setShowCoordinates(false)
    setCursorLngLat(null)
  }, [])

  const flyToLocationParams = useCallback(() => {
    const location = getMapLocationParams()
    if (!location) return

    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: location.zoom,
      duration: 1500,
    })
  }, [])

  const confirmDiscardMarkerChanges = useCallback(() => {
    if (!hasUnsavedMarkerChanges) return true
    return window.confirm(t('maps.discardChanges'))
  }, [hasUnsavedMarkerChanges, t])

  useEffect(() => {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    return () => {
      maplibregl.removeProtocol('pmtiles')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!mapCommand) return
    if (handledMapCommandIdRef.current === mapCommand.id) return

    handledMapCommandIdRef.current = mapCommand.id

    if (mapCommand.action === 'fly') {
      const currentZoom = mapRef.current?.getZoom() ?? 12

      setTargetIndicator({
        lng: mapCommand.lng,
        lat: mapCommand.lat,
      })

      mapRef.current?.flyTo({
        center: [mapCommand.lng, mapCommand.lat],
        zoom: currentZoom,
        duration: 1500,
      })

      return
    }

    if (mapCommand.action === 'marker') {
      if (!confirmDiscardMarkerChanges()) return

      setTargetIndicator(null)

      const currentZoom = mapRef.current?.getZoom() ?? 12

      mapRef.current?.flyTo({
        center: [mapCommand.lng, mapCommand.lat],
        zoom: currentZoom,
        duration: 750,
      })

      window.setTimeout(() => {
        setPlacingMarker({
          lng: mapCommand.lng,
          lat: mapCommand.lat,
        })

        setSelectedMarkerId(null)
        setEditingMarkerId(null)
        setHasUnsavedMarkerChanges(false)
      }, 750)
    }
  }, [mapCommand, confirmDiscardMarkerChanges])

  useEffect(() => {
    if (!selectedMarkerId) return

    const marker = markers.find((existingMarker) => existingMarker.id === selectedMarkerId)

    if (!marker || marker.visible === false) {
      setSelectedMarkerId(null)
      setEditingMarkerId(null)
    }
  }, [markers, selectedMarkerId])

  const handleScaleUnitChange = useCallback((unit: ScaleUnit) => {
    setScaleUnit(unit)
    localStorage.setItem('nomad:map-scale-unit', unit)
  }, [])

  const handleMapLoad = useCallback(() => {
    flyToLocationParams()
    const layers = mapRef.current?.getMap().getStyle()?.layers ?? []
    const roles = [
      ...new Set(
        layers
          .map((l) => (l.metadata as Record<string, unknown> | undefined)?.['nomad:role'])
          .filter((r): r is string => typeof r === 'string')
      ),
    ]
    setRasterRoles(roles)
    // A saved mode whose imagery was since deleted falls back to streets
    const usable =
      mapMode === 'street' ||
      roles.includes(mapMode === 'topographic' ? 'topographic' : 'aerial')
    applyMapMode(usable ? mapMode : 'street')
    if (!usable) setMapMode('street')
  }, [flyToLocationParams, applyMapMode, mapMode])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!confirmDiscardMarkerChanges()) return

      setPlacingMarker({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      setSelectedMarkerId(null)
      setEditingMarkerId(null)
      setHasUnsavedMarkerChanges(false)
      setTargetIndicator(null)
    },
    [confirmDiscardMarkerChanges]
  )

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement | null

      if (
        !showCoordinatesEnabled ||
        isHoveringUI ||
        isDraggingMap ||
        target?.closest('.maplibregl-control-container, .maplibregl-ctrl')
      ) {
        hideCoordinates()
        return
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        setShowCoordinates(true)
        setCursorLngLat({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          x: e.point.x,
          y: e.point.y,
        })
      })
    },
    [hideCoordinates, isHoveringUI, isDraggingMap, showCoordinatesEnabled]
  )


  const handleFlyTo = useCallback((longitude: number, latitude: number) => {
    setTargetIndicator(null)
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 12, duration: 1500 })
  }, [])

  const handleDeleteMarker = useCallback(
    (id: number) => {
      if (selectedMarkerId === id) setSelectedMarkerId(null)
      if (editingMarkerId === id) setEditingMarkerId(null)

      deleteMarker(id)
    },
    [selectedMarkerId, editingMarkerId, deleteMarker]
  )

  const selectedMarker = selectedMarkerId
    ? markers.find((marker) => marker.id === selectedMarkerId && isValidMarkerCoordinate(marker))
    : null

  return (
    <MapProvider>
      <div
        style={{ position: 'relative', width: '100%', height: '100vh' }}
        onMouseLeave={() => {
          setIsDraggingMap(false)
          hideCoordinates()
        }}
        onMouseMoveCapture={(e) => {
          const target = e.target as HTMLElement | null

          if (
            target?.closest(
              '.maplibregl-control-container, .maplibregl-ctrl, .maplibregl-ctrl-group, .maplibregl-ctrl-scale'
            )
          ) {
            hideCoordinates()
          }
        }}
      >
        <Map
          ref={mapRef}
          reuseMaps
          style={{ width: '100%', height: '100vh' }}
          cursor={isDraggingMap ? 'grabbing' : 'crosshair'}
          mapStyle={`${window.location.protocol}//${window.location.hostname}:${window.location.port}/api/maps/styles`}
          mapLib={maplibregl}
          initialViewState={initialViewState}
          onMoveEnd={(e) => {
            // Persist the view so a refresh restores where the user was, not the default.
            const { longitude, latitude, zoom } = e.viewState
            try {
              localStorage.setItem(
                SAVED_MAP_VIEW_KEY,
                JSON.stringify({ longitude, latitude, zoom })
              )
            } catch {
              // ignore persistence failures (private mode, quota)
            }
          }}
          onLoad={handleMapLoad}
          onMouseDown={() => {
            setIsDraggingMap(true)
            hideCoordinates()
          }}
          onMouseUp={() => {
            setIsDraggingMap(false)
          }}
          onDragStart={() => {
            setIsDraggingMap(true)
            hideCoordinates()
          }}
          onDragEnd={() => {
            setIsDraggingMap(false)
            hideCoordinates()
          }}
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={hideCoordinates}
        >
          <NavigationControl style={{ marginTop: '110px', marginRight: '36px' }} />
          <FullscreenControl style={{ marginTop: '30px', marginRight: '36px' }} />
          <ScaleControl position="bottom-left" maxWidth={150} unit={scaleUnit} />

          {rasterRoles.length > 0 && (
            <div
              className="maplibregl-ctrl absolute bottom-10 right-3 z-10 flex overflow-hidden rounded-md border border-border-default bg-surface-primary text-xs shadow"
              role="group"
              aria-label={t('maps.layers.label')}
            >
              {MAP_MODES.filter(
                (mode) =>
                  mode === 'street' ||
                  rasterRoles.includes(mode === 'topographic' ? 'topographic' : 'aerial')
              ).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeMapMode(mode)}
                  aria-pressed={mapMode === mode}
                  className={
                    mapMode === mode
                      ? 'px-3 py-1.5 bg-desert-green text-white'
                      : 'px-3 py-1.5 text-text-primary hover:bg-surface-secondary'
                  }
                >
                  {t(`maps.layers.${mode}`)}
                </button>
              ))}
            </div>
          )}

          {showCoordinates && cursorLngLat && (
            <CoordinateOverlay
              latitude={cursorLngLat.lat}
              longitude={cursorLngLat.lng}
              x={cursorLngLat.x}
              y={cursorLngLat.y}
            />
          )}

          {targetIndicator && (
            <Marker longitude={targetIndicator.lng} latitude={targetIndicator.lat} anchor="center">
              <div
                className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full border-2 border-desert-orange bg-surface-primary/70 shadow-lg"
                aria-hidden="true"
              >
                <div className="relative h-5 w-5">
                  <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-desert-orange" />
                  <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-desert-orange" />
                </div>
              </div>
            </Marker>
          )}

          <ScaleUnitToggle
            scaleUnit={scaleUnit}
            onChange={handleScaleUnitChange}
            onMouseEnter={hideCoordinates}
          />

          {markers
            .filter((marker) => marker.visible)
            .map((marker) => (
              <Marker
                key={marker.id}
                longitude={marker.longitude}
                latitude={marker.latitude}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation()

                  if (!confirmDiscardMarkerChanges()) return

                  setSelectedMarkerId(marker.id === selectedMarkerId ? null : marker.id)
                  setPlacingMarker(null)
                  setEditingMarkerId(null)
                  setHasUnsavedMarkerChanges(false)
                  setTargetIndicator(null)
                }}
              >
                <MarkerPin
                  color={marker.color}
                  customColor={marker.customColor}
                  icon={marker.icon}
                  iconColor={marker.iconColor}
                  visible={marker.visible}
                  active={marker.id === selectedMarkerId}
                />
              </Marker>
            ))}

          {placingMarker && (
            <MapMarkerFormPopup
              longitude={placingMarker.lng}
              latitude={placingMarker.lat}
              onDirtyChange={setHasUnsavedMarkerChanges}
              onMouseEnter={hideCoordinates}
              onSave={async ({ name, notes, color, customColor, icon }) => {
                const saved = await addMarker({
                  name,
                  longitude: placingMarker.lng,
                  latitude: placingMarker.lat,
                  color,
                  customColor,
                  icon,
                  notes: notes || null,
                })

                // Leave the popup open on failure. api.ts already surfaces the
                // error toast, but closing here would throw away what was typed
                // with nothing to retry against.
                if (!saved) return

                setPlacingMarker(null)
                setHasUnsavedMarkerChanges(false)
                setTargetIndicator(null)
              }}
              onCancel={() => {
                if (!confirmDiscardMarkerChanges()) return

                setPlacingMarker(null)
                setEditingMarkerId(null)
                setHasUnsavedMarkerChanges(false)
                setTargetIndicator(null)
              }}
            />
          )}

          {selectedMarker && editingMarkerId !== selectedMarker.id && (
            <ViewMapMarkerPopup
              marker={selectedMarker}
              onClose={() => setSelectedMarkerId(null)}
              onEdit={() => setEditingMarkerId(selectedMarker.id)}
              onMouseEnter={hideCoordinates}
            />
          )}

          {selectedMarker && editingMarkerId === selectedMarker.id && (
            <MapMarkerFormPopup
              longitude={selectedMarker.longitude}
              latitude={selectedMarker.latitude}
              initialMarker={selectedMarker}
              onDirtyChange={setHasUnsavedMarkerChanges}
              onMouseEnter={hideCoordinates}
              onSave={async ({ id, name, notes, color, customColor, icon }) => {
                if (!id) return

                const saved = await updateMarker(id, {
                  name,
                  notes: notes || null,
                  color,
                  customColor,
                  icon,
                })

                if (!saved) return

                setEditingMarkerId(null)
                setHasUnsavedMarkerChanges(false)
              }}
              onCancel={() => {
                if (!confirmDiscardMarkerChanges()) return

                setEditingMarkerId(null)
                setHasUnsavedMarkerChanges(false)
              }}
            />
          )}
        </Map>
      </div>

      <div onMouseEnter={hideCoordinates}>
        <MarkerPanel
          markers={markers}
          onDelete={handleDeleteMarker}
          onFlyTo={handleFlyTo}
          onSelect={setSelectedMarkerId}
          selectedMarkerId={selectedMarkerId}
          onToggleVisibility={(id, visible) => updateMarker(id, { visible })}
        />
      </div>
    </MapProvider>
  )
}
