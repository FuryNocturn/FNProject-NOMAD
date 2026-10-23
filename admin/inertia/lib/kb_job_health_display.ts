import type { TFunction } from 'i18next'
import { computeJobHealth, type JobHealthStatus } from '../../app/utils/kb_job_health.js'

export { computeJobHealth, type JobHealthStatus } from '../../app/utils/kb_job_health.js'

/**
 * Visual presentation for each health status — pill color, dot color, and the
 * short label rendered alongside the dot. `label` / `ariaLabel` are translation
 * keys: resolve them with `t()`. Kept in one place so backend health
 * decisions (`computeJobHealth`) and frontend rendering stay in sync.
 */
export const JOB_HEALTH_DISPLAY: Record<
  JobHealthStatus,
  { dot: string; label: string; ariaLabel: string }
> = {
  waiting: {
    dot: 'bg-gray-400 dark:bg-gray-500',
    label: 'knowledgeBase.jobs.health.waiting.label',
    ariaLabel: 'knowledgeBase.jobs.health.waiting.aria',
  },
  healthy: {
    dot: 'bg-green-500',
    label: 'knowledgeBase.jobs.health.healthy.label',
    ariaLabel: 'knowledgeBase.jobs.health.healthy.aria',
  },
  slow: {
    dot: 'bg-yellow-500',
    label: 'knowledgeBase.jobs.health.slow.label',
    ariaLabel: 'knowledgeBase.jobs.health.slow.aria',
  },
  stalled: {
    dot: 'bg-red-500',
    label: 'knowledgeBase.jobs.health.stalled.label',
    ariaLabel: 'knowledgeBase.jobs.health.stalled.aria',
  },
  failed: {
    dot: 'bg-red-700',
    label: 'knowledgeBase.jobs.health.failed.label',
    ariaLabel: 'knowledgeBase.jobs.health.failed.aria',
  },
}

/**
 * Format a relative timestamp as "Xs ago", "Xm ago", "Xh ago" with sensible
 * thresholds for the KB Processing Queue's "Last activity" line.
 */
export function formatTimeAgo(timestampMs: number, now: number, t: TFunction): string {
  const seconds = Math.max(0, Math.floor((now - timestampMs) / 1000))
  if (seconds < 5) return t('knowledgeBase.jobs.timeAgo.justNow')
  if (seconds < 60) return t('knowledgeBase.jobs.timeAgo.seconds', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('knowledgeBase.jobs.timeAgo.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  return t('knowledgeBase.jobs.timeAgo.hours', { count: hours })
}

/**
 * Convenience wrapper that resolves a job's health status without the caller
 * having to remember to pass `now`. Mostly for ergonomic frontend use.
 */
export function computeJobHealthNow(
  input: Omit<Parameters<typeof computeJobHealth>[0], 'now'>
): JobHealthStatus {
  return computeJobHealth({ ...input, now: Date.now() })
}
