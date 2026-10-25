import { DocumentSearchService } from '#services/document_search_service'
import { searchDocumentsValidator } from '#validators/documents'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/** Keyword search over knowledge-base documents, no AI needed (#1182). */
@inject()
export default class DocumentsController {
  constructor(private documentSearch: DocumentSearchService) {}

  async index({ inertia }: HttpContext) {
    // Pick up documents added since the last visit; the page polls the status
    this.documentSearch.startReindex()
    return inertia.render('documents', { status: await this.documentSearch.status() })
  }

  async search({ request, response }: HttpContext) {
    const { q } = await request.validateUsing(searchDocumentsValidator)
    return response.json({ results: await this.documentSearch.search(q) })
  }

  async status({ response }: HttpContext) {
    return response.json(await this.documentSearch.status())
  }

  async reindex({ response }: HttpContext) {
    const started = this.documentSearch.startReindex()
    return response.status(202).json({ started })
  }
}
