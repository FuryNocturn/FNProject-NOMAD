import { determineFileType } from './fs.js'

/** innodb_ft_min_token_size: shorter words never match FULLTEXT, so they go to LIKE. */
export const FULLTEXT_MIN_TOKEN = 3

/**
 * Text kept per document. shortcut: a very long book is searched only in its
 * first ~5M characters; raise it (or store chunks) if that ever matters.
 */
export const MAX_STORED_CHARS = 5_000_000

/**
 * File types whose text is indexed for keyword search. Images are left out on
 * purpose: OCR is slow and needs the AI-side tesseract setup, while this search
 * must stay cheap and work without AI. ZIMs are searched in Kiwix itself.
 */
export function isSearchableDocument(filepath: string): boolean {
  return ['pdf', 'docx', 'epub', 'text'].includes(determineFileType(filepath))
}

/** Distinct words of the query, lower-cased, in order. */
export function searchTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  return [...new Set(words)]
}

/** True when at least one term is long enough for the FULLTEXT index. */
export function canUseFulltext(terms: string[]): boolean {
  return terms.some((t) => t.length >= FULLTEXT_MIN_TOKEN)
}

/**
 * A short excerpt around the first place any term appears, with whitespace
 * collapsed. Falls back to the start of the text when no term is found
 * (FULLTEXT matched on a stemmed/accented form, for instance).
 */
export function buildSnippet(content: string, terms: string[], radius = 160): string {
  const lower = content.toLowerCase()
  let at = -1
  for (const term of terms) {
    const i = lower.indexOf(term)
    if (i !== -1 && (at === -1 || i < at)) at = i
  }
  const start = Math.max(0, (at === -1 ? 0 : at) - radius)
  const end = Math.min(content.length, (at === -1 ? 0 : at) + radius * 2)
  const text = content.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '… ' : ''}${text}${end < content.length ? ' …' : ''}`
}
