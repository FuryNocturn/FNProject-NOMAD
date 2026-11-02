import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import StyledModal from './StyledModal'
import api from '~/lib/api'
import { copyText } from '~/lib/util'

interface ServiceCredentialsModalProps {
  serviceName: string
  friendlyName: string
  open: boolean
  onClose: () => void
}

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div className="text-xs font-medium text-text-primary mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-surface-secondary px-3 py-2 font-mono text-sm text-text-primary break-all select-all">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(value)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }
          }}
          className="inline-flex items-center gap-1 rounded border border-border-default px-2 py-2 text-xs text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-desert-green"
        >
          {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
          {copied ? t('apps.access.copied') : t('apps.access.copy')}
        </button>
      </div>
    </div>
  )
}

/** Shows the admin login NOMAD generated for an app (PhotoPrism, OpenWebRX, Kismet). */
export default function ServiceCredentialsModal({
  serviceName,
  friendlyName,
  open,
  onClose,
}: ServiceCredentialsModalProps) {
  const { t } = useTranslation()
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(
    null
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCredentials(null)
    setFailed(false)
    api.getServiceCredentials(serviceName).then((res) => {
      if (cancelled) return
      if (res?.success) setCredentials({ username: res.username, password: res.password })
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [open, serviceName])

  return (
    <StyledModal
      title={t('apps.access.title', { name: friendlyName })}
      open={open}
      onCancel={onClose}
      cancelText={t('apps.access.close')}
    >
      <div className="space-y-4 text-sm text-left">
        {credentials ? (
          <>
            <CopyField label={t('apps.access.username')} value={credentials.username} />
            <CopyField label={t('apps.access.password')} value={credentials.password} />
            <p className="text-xs text-text-muted">{t('apps.access.note')}</p>
          </>
        ) : (
          <p className="text-text-muted text-center py-6">
            {failed ? t('apps.access.failed') : t('apps.access.loading')}
          </p>
        )}
      </div>
    </StyledModal>
  )
}
