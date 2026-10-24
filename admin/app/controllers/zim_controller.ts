import { ZimService } from '#services/zim_service'
import {
  assertNotPrivateUrl,
  downloadCategoryTierValidator,
  filenameParamValidator,
  remoteDownloadWithMetadataValidator,
  selectWikipediaValidator,
} from '#validators/common'
import { addCustomLibraryValidator, browseLibraryValidator, idParamValidator, listRemoteZimValidator } from '#validators/zim'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import { createWriteStream } from 'fs'
import { access, rename, statfs, unlink } from 'fs/promises'
import { join, resolve, sep } from 'path'
import { ZIM_STORAGE_PATH, ensureDirectoryExists, sanitizeFilename } from '../utils/fs.js'
import { DOWNLOAD_FREE_SPACE_HEADROOM_BYTES, formatGiB } from '../utils/download_integrity.js'
import { uploadByteBudget } from '../utils/upload_budget.js'

@inject()
export default class ZimController {
  constructor(private zimService: ZimService) {}

  async list({}: HttpContext) {
    return await this.zimService.list()
  }

  async listRemote({ request }: HttpContext) {
    const payload = await request.validateUsing(listRemoteZimValidator)
    const { start = 0, count = 12, query, language } = payload
    return await this.zimService.listRemote({ start, count, query, language })
  }

  async listCatalogLanguages({}: HttpContext) {
    return { languages: await this.zimService.listCatalogLanguages() }
  }

  async downloadRemote({ request }: HttpContext) {
    const payload = await request.validateUsing(remoteDownloadWithMetadataValidator)
    assertNotPrivateUrl(payload.url)
    const { filename, jobId } = await this.zimService.downloadRemote(payload.url, payload.metadata)

    return {
      message: 'Download started successfully',
      filename,
      jobId,
      url: payload.url,
    }
  }

  async listCuratedCategories({}: HttpContext) {
    return await this.zimService.listCuratedCategories()
  }

  async downloadCategoryTier({ request }: HttpContext) {
    const payload = await request.validateUsing(downloadCategoryTierValidator)
    const resources = await this.zimService.downloadCategoryTier(
      payload.categorySlug,
      payload.tierSlug
    )

    return {
      message: 'Download started successfully',
      categorySlug: payload.categorySlug,
      tierSlug: payload.tierSlug,
      resources,
    }
  }

  async rescanLibrary({}: HttpContext) {
    const result = await this.zimService.rescanLibrary()
    return {
      message: 'Kiwix library rescanned',
      ...result,
    }
  }

  async delete({ request, response }: HttpContext) {
    const payload = await request.validateUsing(filenameParamValidator)

    try {
      await this.zimService.delete(payload.params.filename)
    } catch (error) {
      if (error.message === 'not_found') {
        return response.status(404).send({
          message: `ZIM file with key ${payload.params.filename} not found`,
        })
      }
      if (error.message === 'Invalid filename') {
        return response.status(400).send({ message: error.message })
      }
      throw error // Re-throw any other errors and let the global error handler catch
    }

    return {
      message: 'ZIM file deleted successfully',
    }
  }

  async upload({ request, response }: HttpContext) {
    let filename: string | null = null
    let tmpPath: string | null = null
    let uploadError: string | null = null
    let writeError: NodeJS.ErrnoException | null = null

    try {
      const basePath = resolve(join(process.cwd(), ZIM_STORAGE_PATH))
      await ensureDirectoryExists(basePath)

      // Refuse before reading the body when it can't fit with the free-space
      // headroom left; the remaining budget is also the streaming byte cap.
      const fs = await statfs(basePath)
      const freeBytes = Number(fs.bavail) * Number(fs.bsize)
      const declaredBytes = Number(request.header('content-length')) || 0
      const budget = uploadByteBudget(freeBytes, declaredBytes)
      if (!budget.ok) {
        return response.status(507).send({
          message: `Not enough free disk space for this upload (${formatGiB(freeBytes)} free, ${formatGiB(
            DOWNLOAD_FREE_SPACE_HEADROOM_BYTES
          )} must stay free)`,
        })
      }

      request.multipart.onFile('*', {}, async (part, reportChunk) => {
        const clientName = part.filename || ''
        if (!clientName.toLowerCase().endsWith('.zim')) {
          part.resume()
          uploadError = 'INVALID_TYPE'
          return
        }

        const sanitized = sanitizeFilename(clientName)
        const finalPath = resolve(join(basePath, sanitized))

        if (!finalPath.startsWith(basePath + sep)) {
          part.resume()
          uploadError = 'INVALID_FILENAME'
          return
        }

        const exists = await access(finalPath).then(() => true).catch(() => false)
        if (exists) {
          part.resume()
          uploadError = 'DUPLICATE_FILENAME'
          return
        }

        // `wx`: a second upload of the same name fails with EEXIST instead of
        // writing into the first one's .tmp. tmpPath is only recorded once the
        // file is ours, so cleanup never deletes another upload's .tmp.
        const candidateTmp = finalPath + '.tmp'
        const ws = createWriteStream(candidateTmp, { flags: 'wx' })
        ws.on('open', () => {
          tmpPath = candidateTmp
        })

        try {
          await new Promise<void>((res, rej) => {
            ws.on('error', rej)
            ws.on('finish', res)
            part.on('error', rej)
            // Feeds the multipart byte limit set in process() below; over the
            // limit the parser errors this part and rejects process() with 413.
            part.on('data', (chunk: Buffer) => reportChunk(chunk))
            part.pipe(ws)
          })
          await rename(candidateTmp, finalPath)
          tmpPath = null
          filename = sanitized
        } catch (error) {
          // The multipart parser swallows handler errors, so record it for the
          // response and clean up here.
          writeError = error
          part.unpipe(ws)
          ws.destroy()
          part.resume()
          if (tmpPath) {
            await unlink(tmpPath).catch(() => {})
            tmpPath = null
          }
        }
      })

      await request.multipart.process({ limit: budget.maxBytes })

      if (uploadError === 'INVALID_TYPE') {
        return response.status(422).send({ message: 'Only .zim files are accepted' })
      }
      if (uploadError === 'INVALID_FILENAME') {
        return response.status(422).send({ message: 'Invalid filename' })
      }
      if (uploadError === 'DUPLICATE_FILENAME') {
        return response.status(409).send({ message: 'A ZIM file with that name already exists' })
      }
      // Assigned inside the part handler, which TS's narrowing can't see.
      const failure = writeError as NodeJS.ErrnoException | null
      if (failure) {
        logger.error('[ZimController] Upload write failed:', failure)
        if (failure.code === 'EEXIST') {
          return response.status(409).send({ message: 'A ZIM file with that name is already being uploaded' })
        }
        if (failure.code === 'ENOSPC') {
          return response.status(507).send({ message: 'Not enough free disk space for this upload' })
        }
        return response.status(500).send({ message: 'Upload failed' })
      }
      if (!filename) {
        return response.status(400).send({ message: 'No file received' })
      }

      // Never report success for a file that isn't actually on disk.
      const finalPath = join(basePath, filename)
      if (!(await access(finalPath).then(() => true).catch(() => false))) {
        logger.error(`[ZimController] Upload finished but ${finalPath} is missing`)
        return response.status(500).send({ message: 'Upload failed' })
      }

      const { added } = await this.zimService.registerLocalUpload(filename)

      return response.status(201).send({
        message: 'ZIM file uploaded and registered successfully',
        filename,
        added,
      })
    } catch (error) {
      logger.error('[ZimController] Upload failed:', error)
      if (tmpPath) {
        await unlink(tmpPath).catch(() => {})
      }
      if (error?.code === 'E_REQUEST_ENTITY_TOO_LARGE') {
        return response.status(413).send({
          message: 'Upload is larger than the free disk space allows',
        })
      }
      return response.status(500).send({ message: 'Upload failed' })
    }
  }

  // Wikipedia selector endpoints

  async getWikipediaState({}: HttpContext) {
    return this.zimService.getWikipediaState()
  }

  async selectWikipedia({ request }: HttpContext) {
    const payload = await request.validateUsing(selectWikipediaValidator)
    return this.zimService.selectWikipedia(payload.optionId)
  }

  // Custom library endpoints

  async listCustomLibraries({}: HttpContext) {
    return this.zimService.listCustomLibraries()
  }

  async addCustomLibrary({ request, response }: HttpContext) {
    const payload = await request.validateUsing(addCustomLibraryValidator)
    assertNotPrivateUrl(payload.base_url)
    try {
      const source = await this.zimService.addCustomLibrary(payload.name, payload.base_url)
      return { message: 'Custom library added', library: source }
    } catch (error) {
      if (error.message === 'Maximum of 10 custom libraries allowed') {
        return response.status(400).send({ message: error.message })
      }
      throw error
    }
  }

  async removeCustomLibrary({ request, response }: HttpContext) {
    const payload = await request.validateUsing(idParamValidator)
    try {
      await this.zimService.removeCustomLibrary(payload.params.id)
      return { message: 'Custom library removed' }
    } catch (error) {
      if (error.message === 'Custom library not found') {
        return response.status(404).send({ message: error.message })
      }
      throw error
    }
  }

  async browseLibrary({ request, response }: HttpContext) {
    const payload = await request.validateUsing(browseLibraryValidator)
    try {
      return await this.zimService.browseLibraryUrl(payload.url)
    } catch (error) {
      // Redirect/lookup refusals arrive wrapped by axios, so match on the message
      if (
        error.message?.includes('loopback or link-local') ||
        error.message?.includes('Redirect to a non-HTTP URL refused')
      ) {
        return response.status(400).send({ message: error.message })
      }
      return response.status(502).send({
        message: 'Could not fetch directory listing from the provided URL',
      })
    }
  }
}
