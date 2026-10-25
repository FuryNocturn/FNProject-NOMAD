/** [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number]

export type RasterProvider = {
  id: string
  role: 'aerial' | 'topographic'
  /** XYZ (Web Mercator, origin top-left) template with {z} {x} {y} */
  url: string
  attribution: string
  /** HTTPS page describing the source and its licence (kept in the archive manifest) */
  homepage: string
  /** Area the provider actually covers; downloads are clipped to it */
  coverage: Bbox
  maxzoom: number
}

/**
 * Raster sources that allow offline copies. IGN España publishes PNOA and the
 * MTN under CC BY 4.0; USGS National Map tiles are US public domain (Alaska's
 * SPOT imagery is licence-restricted, so coverage stops below it).
 */
export const RASTER_PROVIDERS: readonly RasterProvider[] = [
  {
    id: 'ign-pnoa',
    role: 'aerial',
    url: 'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/jpeg',
    attribution: 'PNOA © <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a> (CC BY 4.0)',
    homepage: 'https://www.ign.es/web/ign/portal/ide-area-nodo-ide-ign',
    coverage: [-18.5, 27.4, 4.6, 44.0],
    maxzoom: 18,
  },
  {
    id: 'ign-mtn',
    role: 'topographic',
    url: 'https://www.ign.es/wmts/mapa-raster?request=GetTile&service=WMTS&version=1.0.0&layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/jpeg',
    attribution: 'MTN © <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a> (CC BY 4.0)',
    homepage: 'https://www.ign.es/web/ign/portal/ide-area-nodo-ide-ign',
    coverage: [-18.5, 27.4, 4.6, 44.0],
    maxzoom: 17,
  },
  {
    id: 'usgs-imagery',
    role: 'aerial',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attribution: 'USDA, <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>: Orthoimagery',
    homepage: 'https://www.usgs.gov/programs/national-geospatial-program/national-map',
    coverage: [-179.9, 17.5, -64.5, 49.5],
    maxzoom: 16,
  },
  {
    id: 'usgs-topo',
    role: 'topographic',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: '<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>',
    homepage: 'https://www.usgs.gov/programs/national-geospatial-program/national-map',
    coverage: [-179.9, 17.5, -64.5, 49.5],
    maxzoom: 16,
  },
]

/** Lowest zoom written, so a region still shows an overview when zoomed out. */
export const RASTER_MIN_ZOOM = 5
/** Rough average tile size for the estimate shown before a download. */
export const AVERAGE_TILE_BYTES = 25_000

const MAX_MERCATOR_LAT = 85.0511287798

export function getRasterProvider(id: string): RasterProvider | undefined {
  return RASTER_PROVIDERS.find((p) => p.id === id)
}

export function isValidBbox(b: unknown): b is Bbox {
  return (
    Array.isArray(b) &&
    b.length === 4 &&
    b.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    b[0] >= -180 &&
    b[2] <= 180 &&
    b[1] >= -90 &&
    b[3] <= 90 &&
    b[0] < b[2] &&
    b[1] < b[3]
  )
}

/** Overlap of two boxes, or null when they do not intersect. */
export function intersectBbox(a: Bbox, b: Bbox): Bbox | null {
  const r: Bbox = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.min(a[3], b[3]),
  ]
  return r[0] < r[2] && r[1] < r[3] ? r : null
}

/** XYZ tile column/row containing a point at a zoom. */
export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))
  const rad = (clampedLat * Math.PI) / 180
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) }
}

/** Inclusive tile ranges covering a box at a zoom. */
export function tileRange(bbox: Bbox, z: number) {
  const nw = lonLatToTile(bbox[0], bbox[3], z)
  const se = lonLatToTile(bbox[2], bbox[1], z)
  return { minX: nw.x, maxX: se.x, minY: nw.y, maxY: se.y }
}

export function countTiles(bbox: Bbox, minzoom: number, maxzoom: number): number {
  let total = 0
  for (let z = minzoom; z <= maxzoom; z++) {
    const r = tileRange(bbox, z)
    total += (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1)
  }
  return total
}

export function tileUrl(provider: RasterProvider, z: number, x: number, y: number): string {
  return provider.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

/** MBTiles stores rows bottom-up (TMS). */
export function xyzRowToTms(y: number, z: number): number {
  return 2 ** z - 1 - y
}
