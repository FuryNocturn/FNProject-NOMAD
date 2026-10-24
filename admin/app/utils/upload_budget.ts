import { DOWNLOAD_FREE_SPACE_HEADROOM_BYTES } from './download_integrity.js'

/**
 * How many bytes an upload may write so the disk keeps its free-space headroom.
 * `declaredBytes` (the request's Content-Length, 0 if unknown) is checked up
 * front; the returned `maxBytes` is the cap enforced while streaming. Always
 * >= 1 when ok, because a multipart `limit` of 0 means "no limit".
 */
export function uploadByteBudget(
  freeBytes: number,
  declaredBytes: number,
  headroomBytes = DOWNLOAD_FREE_SPACE_HEADROOM_BYTES
): { ok: true; maxBytes: number } | { ok: false } {
  const maxBytes = freeBytes - headroomBytes
  if (maxBytes < 1 || declaredBytes > maxBytes) return { ok: false }
  return { ok: true, maxBytes }
}
