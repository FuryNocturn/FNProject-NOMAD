import { Head } from '@inertiajs/react'
import { useQuery } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconFileText, IconSearch } from '@tabler/icons-react'
import AppLayout from '~/layouts/AppLayout'
import StyledButton from '~/components/StyledButton'
import Input from '~/components/inputs/Input'
import api from '~/lib/api'

type IndexStatus = {
  running: boolean
  documents: number
  lastRun: { at: string; indexed: number; removed: number; failed: number } | null
}
type Hit = { source: string; fileName: string; snippet: string }

/** Keyword search over knowledge-base documents; works without AI (#1182). */
export default function Documents(props: { status: IndexStatus }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  // Poll while the background reindex the page started is still running
  const { data: status = props.status, refetch: refetchStatus } = useQuery({
    queryKey: ['document-index-status'],
    queryFn: async () => (await api.getDocumentIndexStatus()) ?? props.status,
    initialData: props.status,
    refetchInterval: (q) => (q.state.data?.running ? 3000 : false),
  })

  const { data: results, isFetching } = useQuery({
    queryKey: ['document-search', submitted],
    queryFn: async () => (await api.searchDocuments(submitted)) ?? [],
    enabled: submitted.length > 0,
  })

  // Enter in the field submits the form; StyledButton is always type="button"
  const onSubmit = (e: FormEvent | React.MouseEvent) => {
    e.preventDefault()
    setSubmitted(query.trim())
  }

  const reindex = async () => {
    await api.reindexDocuments()
    refetchStatus()
  }

  return (
    <AppLayout compact>
      <Head title={t('documents.headTitle')} />
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-1">{t('documents.title')}</h1>
        <p className="text-text-muted mb-4">{t('documents.subtitle')}</p>

        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-text-secondary">
          <span>
            {status.running
              ? t('documents.indexing')
              : t('documents.indexed', { count: status.documents })}
          </span>
          <StyledButton size="sm" variant="outline" onClick={reindex} disabled={status.running}>
            {t('documents.reindex')}
          </StyledButton>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 mb-6">
          <Input
            name="q"
            label=""
            placeholder={t('documents.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            leftIcon={<IconSearch className="w-5 h-5 text-text-muted" />}
          />
          <StyledButton onClick={onSubmit} disabled={!query.trim()}>
            {t('documents.search')}
          </StyledButton>
        </form>

        {submitted && !isFetching && results && results.length === 0 && (
          <p className="text-text-muted">{t('documents.noResults', { query: submitted })}</p>
        )}
        {status.documents === 0 && !status.running && (
          <p className="text-text-muted text-sm">{t('documents.empty')}</p>
        )}

        <ul className="space-y-3">
          {(results ?? []).map((hit: Hit) => (
            <li
              key={hit.source}
              className="rounded-lg border border-border-subtle bg-surface-primary p-4"
            >
              <a
                href={`/api/rag/files/download?source=${encodeURIComponent(hit.source)}`}
                className="flex items-center gap-2 font-medium text-desert-green underline hover:no-underline"
              >
                <IconFileText className="size-4 shrink-0" />
                {hit.fileName}
              </a>
              <p className="mt-1 text-sm text-text-secondary break-words">{hit.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    </AppLayout>
  )
}
