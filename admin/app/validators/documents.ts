import vine from '@vinejs/vine'

/** GET /api/documents/search */
export const searchDocumentsValidator = vine.compile(
  vine.object({
    q: vine.string().trim().minLength(1).maxLength(200),
  })
)
