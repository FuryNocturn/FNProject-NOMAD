import vine from '@vinejs/vine'
import { RASTER_PROVIDERS } from '../utils/raster_tiles.js'

const PROVIDER_IDS = RASTER_PROVIDERS.map((p) => p.id) as [string, ...string[]]

const bbox = vine.array(vine.number().min(-180).max(180)).fixedLength(4)

/** POST /api/maps/raster/estimate */
export const rasterEstimateValidator = vine.compile(
  vine.object({
    providerId: vine.enum(PROVIDER_IDS),
    bbox,
    maxzoom: vine.number().withoutDecimals().min(6).max(18),
  })
)

/** POST /api/maps/raster/download */
export const rasterDownloadValidator = vine.compile(
  vine.object({
    providerId: vine.enum(PROVIDER_IDS),
    regionId: vine.string().trim().minLength(1).maxLength(80),
    regionName: vine.string().trim().minLength(1).maxLength(120),
    bbox,
    maxzoom: vine.number().withoutDecimals().min(6).max(18),
  })
)
