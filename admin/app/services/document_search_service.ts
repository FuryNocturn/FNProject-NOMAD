import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { RagService } from '#services/rag_service'
import { listDirectoryContentsRecursive } from '../utils/fs.js'
import { escapeLike } from '../utils/sql.js'
import {
  MAX_STORED_CHARS,
  buildSnippet,
  canUseFulltext,
  isSearchableDocument,
  searchTerms,
} from '../utils/document_search.js'

const TABLE = 'kb_document_texts'

export type DocumentSearchHit = { source: string; fileName: string; snippet: string }

export type DocumentIndexStatus = {
  running: boolean
  documents: number
  lastRun: { at: string; indexed: number; removed: number; failed: number } | null
}

const sourceHash = (source: string) => createHash('sha256').update(source).digest('hex')

/**
 * Keyword search over knowledge-base documents that works without AI (#1182):
 * the text of each uploaded (or externally mounted) document is kept in MySQL
 * with a FULLTEXT index, using the same FULLTEXT-then-LIKE pattern as the drug
 * reference. The table is derived data, rebuilt incrementally from disk.
 */
@inject()
export class DocumentSearchService {
  // One reindex at a time per process; requests during a run just report it
  private static running = false
  private static lastRun: DocumentIndexStatus['lastRun'] = null

  constructor(private ragService: RagService) {}

  private static roots(): string[] {
    return [RagService.UPLOADS_STORAGE_PATH, RagService.EXTERNAL_DOCS_PATH].map((dir) =>
      join(process.cwd(), dir)
    )
  }

  async status(): Promise<DocumentIndexStatus> {
    const [{ total }] = await db.from(TABLE).count('* as total')
    return {
      running: DocumentSearchService.running,
      documents: Number(total),
      lastRun: DocumentSearchService.lastRun,
    }
  }

  /** Start an incremental reindex in the background; false if one is running. */
  startReindex(): boolean {
    if (DocumentSearchService.running) return false
    DocumentSearchService.running = true
    this.reindex()
      .catch((error) => logger.error({ err: error }, '[DocumentSearch] reindex failed'))
      .finally(() => {
        DocumentSearchService.running = false
      })
    return true
  }

  /**
   * Index new or changed documents (by size + mtime) and drop rows whose file
   * is gone. A root that is missing or empty is left alone, so an unmounted
   * external folder does not wipe its documents from the index.
   */
  private async reindex() {
    let indexed = 0
    let removed = 0
    let failed = 0
    const seen = new Set<string>()
    const walkedRoots: string[] = []

    for (const root of DocumentSearchService.roots()) {
      let entries: Awaited<ReturnType<typeof listDirectoryContentsRecursive>>
      try {
        entries = await listDirectoryContentsRecursive(root)
      } catch (error: any) {
        if (error?.code === 'ENOENT') continue
        throw error
      }
      const files = entries.filter(
        (e): e is Extract<typeof e, { type: 'file' }> =>
          e.type === 'file' && isSearchableDocument(e.key)
      )
      if (files.length > 0) walkedRoots.push(resolve(root))
      for (const file of files) {
        seen.add(file.key)
        try {
          if (await this.indexFile(file.key)) indexed++
        } catch (error) {
          failed++
          logger.warn({ err: error }, `[DocumentSearch] could not index ${file.key}`)
        }
      }
    }

    const rows: { source: string }[] = await db.from(TABLE).select('source')
    for (const { source } of rows) {
      const underWalkedRoot = walkedRoots.some((root) => resolve(source).startsWith(root + sep))
      if (underWalkedRoot && !seen.has(source)) {
        await this.remove(source)
        removed++
      }
    }

    DocumentSearchService.lastRun = { at: new Date().toISOString(), indexed, removed, failed }
    logger.info(`[DocumentSearch] reindex: ${indexed} indexed, ${removed} removed, ${failed} failed`)
  }

  /** Index one file if it is new or changed. Returns true when the text was (re)stored. */
  async indexFile(filepath: string): Promise<boolean> {
    if (!isSearchableDocument(filepath)) return false
    const info = await stat(filepath)
    const hash = sourceHash(filepath)
    const existing = await db
      .from(TABLE)
      .where('source_hash', hash)
      .select('size_bytes', 'mtime_ms')
      .first()
    if (
      existing &&
      Number(existing.size_bytes) === info.size &&
      Number(existing.mtime_ms) === Math.floor(info.mtimeMs)
    ) {
      return false
    }

    const text = (await this.ragService.extractTextForSearch(filepath)) ?? ''
    const row = {
      source: filepath,
      source_hash: hash,
      file_name: basename(filepath).slice(0, 512),
      size_bytes: info.size,
      mtime_ms: Math.floor(info.mtimeMs),
      content: text.slice(0, MAX_STORED_CHARS),
      updated_at: new Date(),
    }
    if (existing) {
      await db.from(TABLE).where('source_hash', hash).update(row)
    } else {
      await db.table(TABLE).insert({ ...row, created_at: new Date() })
    }
    return true
  }

  async remove(source: string) {
    await db.from(TABLE).where('source_hash', sourceHash(source)).delete()
  }

  /** FULLTEXT (natural language) when a term is long enough, LIKE otherwise or on error. */
  async search(query: string, limit = 25): Promise<DocumentSearchHit[]> {
    const terms = searchTerms(query)
    if (terms.length === 0) return []

    let rows: { source: string; file_name: string; content: string }[] | null = null
    if (canUseFulltext(terms)) {
      try {
        const [result] = await db.rawQuery(
          `SELECT source, file_name, content,
             MATCH(file_name, content) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
           FROM ${TABLE}
           WHERE MATCH(file_name, content) AGAINST(? IN NATURAL LANGUAGE MODE)
           ORDER BY relevance DESC
           LIMIT ?`,
          [query, query, limit]
        )
        rows = result
      } catch (error) {
        logger.warn({ err: error }, '[DocumentSearch] FULLTEXT failed, falling back to LIKE')
      }
    }
    if (!rows || rows.length === 0) {
      // Every term must appear, in the name or the text
      const q = db.from(TABLE).select('source', 'file_name', 'content').limit(limit)
      for (const term of terms) {
        const like = `%${escapeLike(term)}%`
        q.where((w) => w.where('file_name', 'like', like).orWhere('content', 'like', like))
      }
      rows = await q
    }

    return rows.map((r) => ({
      source: r.source,
      fileName: r.file_name,
      snippet: buildSnippet(r.content, terms),
    }))
  }
}
