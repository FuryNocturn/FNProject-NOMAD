import { BaseSchema } from '@adonisjs/lucid/schema'
import logger from '@adonisjs/core/services/logger'

// ER_TABLE_CANT_HANDLE_FT: "The used table type doesn't support FULLTEXT indexes".
const FULLTEXT_UNSUPPORTED_ERRNO = 1214

/**
 * Extracted text of knowledge-base documents, for keyword search that works
 * without AI (#1182). Derived data: DocumentSearchService rebuilds it from the
 * files on disk, so it can be dropped at any time.
 */
export default class extends BaseSchema {
  protected tableName = 'kb_document_texts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Absolute path; a sha256 of it carries the UNIQUE (paths can exceed index length)
      table.text('source').notNullable()
      table.string('source_hash', 64).notNullable().unique()
      table.string('file_name', 512).notNullable()
      table.bigInteger('size_bytes').notNullable()
      table.bigInteger('mtime_ms').notNullable()
      table.specificType('content', 'LONGTEXT').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.defer(async (db) => {
      try {
        await db.rawQuery(
          'ALTER TABLE kb_document_texts ADD FULLTEXT INDEX ft_kb_document_texts (file_name, content)'
        )
      } catch (err) {
        const e = err as { errno?: number; code?: string; message?: string }
        if (e.errno === FULLTEXT_UNSUPPORTED_ERRNO || e.code === 'ER_TABLE_CANT_HANDLE_FT') {
          logger.warn(`[migration] FULLTEXT unsupported; document search uses LIKE: ${e.message}`)
          return
        }
        throw err
      }
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
