import { SERVICE_NAMES } from './service_names.js'

/**
 * Supply Depot apps whose admin login NOMAD creates at install time, so none of them starts
 * with a password that is the same on every NOMAD (or, for Kismet, with whoever opens the page
 * first creating the admin). The password is generated once, persisted in the KV store and
 * reused for the life of the install, like the Homebox pepper.
 *
 * `envVar` is passed to the container; Kismet has none and reads `kismet_httpd.conf` instead.
 */
export const APP_CREDENTIALS = {
  [SERVICE_NAMES.PHOTOPRISM]: {
    username: 'admin',
    kvKey: 'apps.photoprism.adminPassword',
    envVar: 'PHOTOPRISM_ADMIN_PASSWORD',
  },
  [SERVICE_NAMES.OPENWEBRX]: {
    username: 'admin',
    kvKey: 'apps.openwebrx.adminPassword',
    envVar: 'OPENWEBRX_ADMIN_PASSWORD',
  },
  [SERVICE_NAMES.KISMET]: {
    username: 'admin',
    kvKey: 'apps.kismet.adminPassword',
    envVar: null,
  },
} as const

export type AppCredentialService = Extract<keyof typeof APP_CREDENTIALS, string>
export type AppCredentialKvKey = (typeof APP_CREDENTIALS)[AppCredentialService]['kvKey']

export function hasAppCredentials(serviceName: string): serviceName is AppCredentialService {
  return Object.hasOwn(APP_CREDENTIALS, serviceName)
}
