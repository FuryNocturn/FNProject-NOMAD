/** Hosts that serve the official Kiwix tree; download.kiwix.org redirects to the other two. */
const OFFICIAL_KIWIX_HOSTS = new Set([
  'download.kiwix.org',
  'lb.download.kiwix.org',
  'mirror.download.kiwix.org',
])

/**
 * The same file on the preferred mirror (`downloads.kiwixMirror`), or null when
 * no mirror is set or the URL is not an official Kiwix `/zim/` URL. Mirror base
 * URLs point at their copy of the `zim/` folder (e.g.
 * https://mirrors.dotsrc.org/kiwix/zim/), like the seeded library sources.
 */
export function kiwixMirrorUrl(url: string, mirrorBase: string | null | undefined): string | null {
  const base = mirrorBase?.trim()
  if (!base) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!OFFICIAL_KIWIX_HOSTS.has(parsed.hostname) || !parsed.pathname.startsWith('/zim/'))
    return null
  return (base.endsWith('/') ? base : `${base}/`) + parsed.pathname.slice('/zim/'.length)
}
