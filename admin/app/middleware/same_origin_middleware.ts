import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { isCrossSiteRequest } from '../utils/cross_site_request.js'

/** Refuses state-changing requests that the browser says come from another site (CSRF). */
export default class SameOriginMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const crossSite = isCrossSiteRequest({
      method: request.method(),
      secFetchSite: request.header('sec-fetch-site'),
      origin: request.header('origin'),
      hosts: [request.header('host'), request.header('x-forwarded-host')],
    })
    if (crossSite) {
      logger.warn(
        `[SameOrigin] Refused cross-site ${request.method()} ${request.url()} from origin "${request.header('origin') ?? '-'}"`
      )
      return response.forbidden({ success: false, message: 'Cross-site requests are not allowed.' })
    }
    return next()
  }
}
