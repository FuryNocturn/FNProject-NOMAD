import type { CreatorPacksSpec, ZimCategoriesSpec } from '../../types/collections.js'
import { isGatedResource } from './hosted_content.js'

/**
 * Resource ids of ZIMs we host ourselves: gated curated resources plus every Creator Pack
 * (served only by the entitlement Worker, never by the Kiwix catalog). Pure; see
 * CollectionManifestService.getGatedZimResourceIds.
 */
export function collectGatedZimResourceIds(
  zimSpec: ZimCategoriesSpec | null,
  packsSpec: CreatorPacksSpec | null
): Set<string> {
  const ids = new Set<string>()
  for (const category of zimSpec?.categories ?? []) {
    for (const tier of category.tiers) {
      for (const resource of tier.resources) {
        if (isGatedResource(resource)) ids.add(resource.id)
      }
    }
  }
  for (const pack of packsSpec?.packs ?? []) ids.add(pack.resource_id)
  return ids
}
