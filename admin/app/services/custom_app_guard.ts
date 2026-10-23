import { realpathSync } from 'node:fs'
import { posix } from 'node:path'
import env from '#start/env'

// Host paths are Linux paths even when this code runs (e.g. in tests) on Windows
const { dirname, normalize, relative, join } = posix

/**
 * Security guardrails for user-defined ("custom app") containers.
 *
 * project-nomad runs containers as host siblings via the mounted Docker socket (DooD), so a
 * misconfigured bind mount or image is a real host-takeover vector. The posture here is
 * "guardrails with warnings": hard-block the genuinely catastrophic, warn-but-allow the merely
 * risky so a trusted admin keeps their power without an easy foot-gun.
 */

export interface GuardEvaluation {
  /** Hard rejections — the install cannot proceed until these are fixed. */
  blocked: string[]
  /** Advisory warnings — overridable via the "install anyway" force flag. */
  warnings: string[]
}

/**
 * Absolute host directories that must never be bind-mounted into a custom container: writing to
 * any of them (binaries, libraries, root's home, Docker's own state) is a host takeover.
 */
const SYSTEM_BLOCK_PREFIXES = [
  '/etc', '/proc', '/sys', '/boot', '/dev', '/run', '/var/run',
  '/usr', '/bin', '/sbin', '/lib', '/lib32', '/lib64', '/libx32', '/root', '/snap',
  '/var/lib/docker', '/var/lib/containerd',
]

/** Where the admin container itself sees the storage root (the `/app/storage` bind in compose). */
const ADMIN_STORAGE_VIEW = '/app/storage'

type RealpathFn = (p: string) => string

/** Registries we ship curated apps from; anything else is allowed but warned on. */
const TRUSTED_REGISTRIES = ['docker.io', 'registry-1.docker.io', 'ghcr.io', 'lscr.io', 'quay.io']

/** Resolve the managed storage root (where bind mounts are expected to live). */
export function getStorageRoot(): string {
  return normalize(env.get('NOMAD_STORAGE_PATH', '/opt/project-nomad/storage')).replace(/\/+$/, '')
}

/** Normalize an absolute path: collapse `..`/`.` segments and strip any trailing slash. */
function normalizeHostPath(p: string): string {
  return normalize(p).replace(/\/+$/, '') || '/'
}

/** True when `child` equals `ancestor` or sits beneath it. */
function isWithin(child: string, ancestor: string): boolean {
  return child === ancestor || child.startsWith(ancestor + '/')
}

/**
 * True when a host path under the storage root really stays inside it once symlinks are resolved.
 * Another container can write into storage, so `storage/app-a/x -> /` must not let a second app
 * mount host `/`. Checked through the admin's own view of storage; a path that does not exist yet
 * is judged by its nearest existing ancestor (Docker creates the rest as plain directories).
 */
function staysInsideStorage(host: string, storageRoot: string, realpath: RealpathFn): boolean {
  let local = join(ADMIN_STORAGE_VIEW, relative(storageRoot, host))
  let viewRoot: string
  try {
    viewRoot = realpath(ADMIN_STORAGE_VIEW)
  } catch {
    return true // not running inside the admin container (e.g. tests): nothing to resolve
  }
  while (true) {
    try {
      return isWithin(normalizeHostPath(realpath(local)), viewRoot)
    } catch {
      const parent = dirname(local)
      if (parent === local) return false
      local = parent
    }
  }
}

/**
 * Evaluate user-supplied bind mounts. Hard-blocks the Docker socket, core system directories,
 * project-nomad's own install tree (code, database, compose file with credentials) except the
 * storage root, and storage paths that escape through a symlink.
 * Warns on any other host path outside the managed storage root.
 */
export function evaluateBindMounts(
  volumes: { host_path: string; container_path: string }[],
  realpath: RealpathFn = realpathSync.native
): GuardEvaluation {
  const blocked: string[] = []
  const warnings: string[] = []

  const storageRoot = getStorageRoot()
  // The install tree is the parent of the storage root (e.g. /opt/project-nomad). Mounting it —
  // or any ancestor, up to and including `/` — would hand a container project-nomad's own files.
  const installRoot = dirname(storageRoot)

  for (const { host_path: hostPath, container_path: containerPath } of volumes) {
    const host = normalizeHostPath(hostPath)

    if (!hostPath.startsWith('/')) {
      blocked.push(`Volume host path "${hostPath}" must be an absolute path.`)
      continue
    }
    if (!containerPath.startsWith('/')) {
      blocked.push(`Volume container path "${containerPath}" must be an absolute path.`)
      continue
    }

    // A colon is Docker's bind delimiter (host:container:options). A path containing one would be
    // re-split by Docker into a different mount than the one validated here — reject it outright so
    // the checks below can't be bypassed by a parse-differential. (The validator blocks this too;
    // this keeps the guard self-defending for any caller that skips validation.)
    if (hostPath.includes(':') || containerPath.includes(':')) {
      blocked.push(`Volume paths must not contain a colon (":"): "${hostPath}" → "${containerPath}".`)
      continue
    }

    // The Docker socket is the most dangerous mount of all — full control of the host daemon.
    if (host.endsWith('docker.sock') || /\/docker\.sock$/.test(host)) {
      blocked.push(
        `Mounting the Docker socket ("${hostPath}") is not allowed — it grants full host control.`
      )
      continue
    }

    // Core system directories. The storage root itself is exempt: under Docker Desktop it lives
    // at /run/desktop/mnt/host/<drive>/..., inside the blocked /run prefix.
    const inStorage = isWithin(host, storageRoot)
    if (host === '/' || (!inStorage && SYSTEM_BLOCK_PREFIXES.some((p) => isWithin(host, p)))) {
      blocked.push(`Mounting system directory "${hostPath}" is not allowed.`)
      continue
    }

    // At or above project-nomad's own install tree (covers `/`, `/opt`, `/opt/project-nomad`).
    if (host === installRoot || isWithin(installRoot, host)) {
      blocked.push(
        `Mounting "${hostPath}" would expose project-nomad's own files and is not allowed.`
      )
      continue
    }

    // Inside the install tree but not storage: the database, Redis data, compose.yml (credentials).
    if (isWithin(host, installRoot) && !isWithin(host, storageRoot)) {
      blocked.push(
        `Mounting "${hostPath}" would expose project-nomad's own files and is not allowed.`
      )
      continue
    }

    if (isWithin(host, storageRoot) && !staysInsideStorage(host, storageRoot, realpath)) {
      blocked.push(
        `Volume "${hostPath}" leads outside the storage folder through a symbolic link and is not allowed.`
      )
      continue
    }

    // Anything outside the managed storage root is allowed but flagged.
    if (!isWithin(host, storageRoot)) {
      warnings.push(
        `Volume "${hostPath}" is outside the managed storage root (${storageRoot}). Make sure you trust this image with access to that path.`
      )
    }
  }

  return { blocked, warnings }
}

/**
 * Evaluate a Docker image reference. Hard-blocks malformed references; warns on moving tags
 * (`:latest`/untagged) and images from registries outside the trusted set.
 */
export function evaluateImageReference(image: string): GuardEvaluation {
  const blocked: string[] = []
  const warnings: string[] = []

  const ref = image.trim()
  // Loose validity check: no whitespace/control chars, and a sane character set for an image ref.
  if (!ref || /\s/.test(ref) || !/^[\w./:@-]+$/.test(ref)) {
    blocked.push(`"${image}" is not a valid image reference.`)
    return { blocked, warnings }
  }

  // Split off any digest, then any tag, to inspect the registry and tag.
  const [nameAndTag] = ref.split('@')
  const firstSegment = nameAndTag.split('/')[0]
  const hasRegistryHost =
    nameAndTag.includes('/') && (firstSegment.includes('.') || firstSegment.includes(':'))
  const registry = hasRegistryHost ? firstSegment.split(':')[0] : 'docker.io'

  if (!TRUSTED_REGISTRIES.includes(registry)) {
    warnings.push(
      `Image is from "${registry}", which is outside project-nomad's trusted registries. Only install images you trust.`
    )
  }

  // Determine the tag (ignore a colon that's part of a registry host:port in the first segment).
  const remainder = hasRegistryHost ? nameAndTag.slice(firstSegment.length + 1) : nameAndTag
  const tag = remainder.includes(':') ? remainder.split(':').pop() : undefined
  const hasDigest = ref.includes('@sha256:')
  if (!hasDigest && (!tag || tag === 'latest')) {
    warnings.push(
      `Image "${image}" uses a moving tag (${tag ? ':latest' : 'no tag'}). Pin a specific version for reproducible installs.`
    )
  }

  return { blocked, warnings }
}

/** Combine bind-mount and image evaluations into a single result. */
export function evaluateCustomApp(input: {
  image?: string
  volumes?: { host_path: string; container_path: string }[]
}): GuardEvaluation {
  const bind = evaluateBindMounts(input.volumes ?? [])
  const img = input.image ? evaluateImageReference(input.image) : { blocked: [], warnings: [] }
  return {
    blocked: [...bind.blocked, ...img.blocked],
    warnings: [...bind.warnings, ...img.warnings],
  }
}

/** Default resource caps applied to custom containers unless the user overrides them. */
export const DEFAULT_MEMORY_MB = 1024
export const DEFAULT_CPUS = 1
