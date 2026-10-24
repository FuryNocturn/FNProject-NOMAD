import { posix, resolve, sep } from 'node:path'

/**
 * Local filename for a remote download, taken from the URL's decoded pathname only.
 * The raw URL string must never be used: `https://host/a.zim#/kiwix-library.xml`
 * would otherwise be saved as `kiwix-library.xml`. Returns null when there is no
 * usable name, when it contains separators/control characters, or when it does
 * not end with `extension` (if given).
 */
export function filenameFromUrl(url: string, extension?: string): string | null {
  let name: string
  try {
    name = posix.basename(decodeURIComponent(new URL(url).pathname))
  } catch {
    return null
  }
  if (!name || name === '.' || name === '..' || /[\\/\x00-\x1f\x7f]/.test(name)) return null
  if (extension && !name.endsWith(extension)) return null
  return name
}

/** Resolves `name` under `base`, throwing if the result escapes `base`. */
export function resolveInside(base: string, name: string): string {
  const root = resolve(base)
  const full = resolve(root, name)
  if (!full.startsWith(root + sep)) {
    throw new Error(`Refusing to write outside ${root}: ${name}`)
  }
  return full
}
