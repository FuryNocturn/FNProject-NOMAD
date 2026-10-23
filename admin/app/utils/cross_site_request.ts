/**
 * NOMAD has no login, so the classic CSRF token defence (which hangs off a session) does
 * not apply. Instead, state-changing requests that a *browser* marks as coming from another
 * site are refused: without this, any web page the user visits could POST a plain HTML form
 * to the LAN-reachable API (forms need no CORS preflight) and e.g. install a container that
 * bind-mounts host paths.
 *
 * Non-browser clients (curl, scripts) send neither header and are allowed, as before.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface RequestOriginInfo {
  method: string
  /** `Sec-Fetch-Site` header, sent by all current browsers */
  secFetchSite?: string
  /** `Origin` header, sent by browsers on cross-origin requests and on POST/PUT/PATCH/DELETE */
  origin?: string
  /** Host(s) this server is reached at: the `Host` header and, behind a proxy, `X-Forwarded-Host` */
  hosts: Array<string | undefined>
}

export function isCrossSiteRequest({ method, secFetchSite, origin, hosts }: RequestOriginInfo): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false

  // 'same-site' is refused too: apps NOMAD installs run on other ports of the same host,
  // and a compromised or malicious app page must not be able to drive the admin API.
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') return true

  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host.toLowerCase()
    } catch {
      return true // includes the literal "null" origin (sandboxed iframes, file://)
    }
    const known = hosts.filter(Boolean).map((h) => h!.split(',')[0].trim().toLowerCase())
    return !known.includes(originHost)
  }

  return false
}
