import type { HttpContext } from '@adonisjs/core/http'
import { RasterMapService } from '#services/raster_map_service'
import { rasterDownloadValidator, rasterEstimateValidator } from '#validators/raster_maps'
import { isValidBbox, type Bbox } from '../utils/raster_tiles.js'

/** Offline aerial / topographic map downloads (#1175). */
export default class RasterMapsController {
  private service = new RasterMapService()

  async providers({ response }: HttpContext) {
    return response.json(this.service.providers())
  }

  async regions({ response }: HttpContext) {
    return response.json(await this.service.regions())
  }

  async estimate({ request, response }: HttpContext) {
    const { providerId, bbox, maxzoom } = await request.validateUsing(rasterEstimateValidator)
    if (!isValidBbox(bbox)) return response.status(422).json({ error: 'Invalid area' })
    const estimate = this.service.estimate(providerId, bbox as Bbox, maxzoom)
    if (!estimate) {
      return response.status(422).json({ error: 'This source has no coverage for that area' })
    }
    return response.json(estimate)
  }

  async download({ request, response }: HttpContext) {
    const params = await request.validateUsing(rasterDownloadValidator)
    if (!isValidBbox(params.bbox)) return response.status(422).json({ error: 'Invalid area' })
    const result = await this.service.start({ ...params, bbox: params.bbox as Bbox })
    if (!result) {
      return response.status(422).json({ error: 'This source has no coverage for that area' })
    }
    return response.status(202).json({ created: result.created, jobId: result.job.id })
  }
}
