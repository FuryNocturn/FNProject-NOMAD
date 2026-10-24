import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { isDiskFullError } from '../../app/utils/disk_errors.js'
import { collectGatedZimResourceIds } from '../../app/utils/gated_resource_ids.js'

test('isDiskFullError matches ENOSPC/EDQUOT directly or wrapped in cause', () => {
  const enospc = Object.assign(new Error('no space'), { code: 'ENOSPC' })
  assert.equal(isDiskFullError(enospc), true)
  assert.equal(isDiskFullError(new Error('wrapped', { cause: enospc })), true)
  assert.equal(isDiskFullError(Object.assign(new Error('quota'), { code: 'EDQUOT' })), true)
  assert.equal(isDiskFullError(Object.assign(new Error('reset'), { code: 'ECONNRESET' })), false)
  assert.equal(isDiskFullError(undefined), false)
})

test('gated ZIM ids include Creator Pack resource ids', () => {
  const specs: Record<string, any> = {
    zim_categories: {
      categories: [
        {
          tiers: [
            {
              resources: [
                { id: 'public-zim', url: 'https://download.kiwix.org/zim/a.zim' },
                { id: 'hosted-zim', url: 'https://example.invalid/b.zim', auth: 'nomad_app_key' },
              ],
            },
          ],
        },
      ],
    },
    creator_packs: { packs: [{ id: 'crosstalk', resource_id: 'crosstalk-solutions' }] },
  }
  const ids = collectGatedZimResourceIds(specs.zim_categories, specs.creator_packs)
  assert.equal(ids.has('crosstalk-solutions'), true)
  assert.equal(ids.has('hosted-zim'), true)
  assert.equal(ids.has('public-zim'), false)
})

test('gated ZIM ids degrade to empty when nothing is cached', () => {
  assert.equal(collectGatedZimResourceIds(null, null).size, 0)
})
