import { randomBytes } from 'node:crypto'
import { APP_CREDENTIALS, hasAppCredentials } from '../../constants/app_credentials.js'

export { APP_CREDENTIALS, hasAppCredentials }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
export const APP_PASSWORD_LENGTH = 24

/**
 * Letters and digits only (no look-alikes such as 0/O or l/1) so it can be typed from the
 * screen; 24 of 57 symbols is ~140 bits. Rejection sampling keeps every symbol equally likely.
 */
export function generateAppPassword(length = APP_PASSWORD_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length)
  let out = ''
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && out.length < length) out += ALPHABET[byte % ALPHABET.length]
    }
  }
  return out
}

/** A stored password is reused only if it still looks like one we generated. */
export function isUsableAppPassword(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9]{12,72}$/.test(value)
}

/**
 * The container env with the app's admin password set: any existing value for the variable is
 * replaced (a container from an older catalog carried a fixed default), others are kept.
 */
export function withAppPasswordEnv(serviceName: string, env: string[], password: string): string[] {
  if (!hasAppCredentials(serviceName)) return env
  const { envVar } = APP_CREDENTIALS[serviceName]
  if (!envVar) return env
  return [...env.filter((e) => !e.startsWith(`${envVar}=`)), `${envVar}=${password}`]
}

/** Kismet's web login (~/.kismet/kismet_httpd.conf). */
export function kismetHttpdConf(username: string, password: string): string {
  return `httpd_username=${username}\nhttpd_password=${password}\n`
}
