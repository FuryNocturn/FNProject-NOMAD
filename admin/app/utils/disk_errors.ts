/**
 * True for a "disk full" error (ENOSPC, or EDQUOT for a quota), including one wrapped in an
 * error's `cause` chain. Write-stream errors currently reach callers unwrapped; this keeps the
 * check correct if a layer starts wrapping them.
 */
export function isDiskFullError(error: unknown): boolean {
  for (let e: any = error, depth = 0; e && depth < 5; e = e.cause, depth++) {
    if (e.code === 'ENOSPC' || e.code === 'EDQUOT') return true
  }
  return false
}
