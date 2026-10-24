import { Head, router } from '@inertiajs/react'
import { useAiAssistantName } from '~/hooks/useAiAssistantName'
import { useRef, useState } from 'react'
import StyledTable from '~/components/StyledTable'
import SettingsLayout from '~/layouts/SettingsLayout'
import { NomadOllamaModel } from '../../../types/ollama'
import StyledButton from '~/components/StyledButton'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import Alert from '~/components/Alert'
import { useNotifications } from '~/context/NotificationContext'
import api from '~/lib/api'
import { useModals } from '~/context/ModalContext'
import StyledModal from '~/components/StyledModal'
import type { NomadInstalledModel } from '../../../types/ollama'
import { SERVICE_NAMES } from '../../../constants/service_names'
import {
  EMBEDDING_MODEL_NAME,
  EMBEDDING_MODELS,
  RAG_MIN_FINAL_SCORE,
  RAG_MIN_RELEVANCE_PRESETS,
  RESPONSE_STYLE_PRESETS,
} from '../../../constants/ollama'
import Switch from '~/components/inputs/Switch'
import Select from '~/components/inputs/Select'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Input from '~/components/inputs/Input'
import { IconSearch, IconRefresh } from '@tabler/icons-react'
import { formatBytes } from '~/lib/util'
import useDebounce from '~/hooks/useDebounce'
import ActiveModelDownloads from '~/components/ActiveModelDownloads'
import { useSystemInfo } from '~/hooks/useSystemInfo'
import GpuPassthroughAlert from '~/components/GpuPassthroughAlert'
import { Trans, useTranslation } from 'react-i18next'

// Translation key per RAG_MIN_RELEVANCE_PRESETS value; labels resolve at render time.
const RELEVANCE_PRESET_KEYS: Record<number, string> = {
  0: 'off',
  0.55: 'lenient',
  [RAG_MIN_FINAL_SCORE]: 'balanced',
  0.66: 'strict',
}

export default function ModelsPage(props: {
  models: {
    availableModels: NomadOllamaModel[]
    installedModels: NomadInstalledModel[]
    settings: { chatSuggestionsEnabled: boolean; aiAssistantCustomName: string; remoteOllamaUrl: string; ollamaFlashAttention: boolean; autoThinking: boolean; tasksModel: string; ragEnabled: boolean; contextWindow: string; minRelevance: number; defaultMinRelevance: number; embeddingModel: string; embeddingModelIndexed: string; relevanceCheck: boolean; responseStyle: string }
    /** Effective window per installed model, as resolved by ContextWindowService. */
    resolvedContextWindows?: Record<string, number>
  }
}) {
  const { t } = useTranslation()
  const aiAssistantName = useAiAssistantName()
  const { isInstalled } = useServiceInstalledStatus(SERVICE_NAMES.OLLAMA)
  const { addNotification } = useNotifications()
  const { openModal, closeAllModals } = useModals()
  const { debounce } = useDebounce()
  const { data: systemInfo } = useSystemInfo({})
  const queryClient = useQueryClient()

  const [chatSuggestionsEnabled, setChatSuggestionsEnabled] = useState(
    props.models.settings.chatSuggestionsEnabled
  )
  const [ollamaFlashAttention, setOllamaFlashAttention] = useState(
    props.models.settings.ollamaFlashAttention
  )
  const [autoThinking, setAutoThinking] = useState(props.models.settings.autoThinking)
  const [ragEnabled, setRagEnabled] = useState(props.models.settings.ragEnabled)
  const [tasksModel, setTasksModel] = useState(props.models.settings.tasksModel)
  const [contextWindow, setContextWindow] = useState(props.models.settings.contextWindow)
  const [minRelevance, setMinRelevance] = useState(String(props.models.settings.minRelevance))
  const [embeddingModel, setEmbeddingModel] = useState(props.models.settings.embeddingModel)
  const [embeddingSaving, setEmbeddingSaving] = useState(false)
  const [relevanceCheck, setRelevanceCheck] = useState(props.models.settings.relevanceCheck)
  const [responseStyle, setResponseStyle] = useState(props.models.settings.responseStyle)
  const [aiAssistantCustomName, setAiAssistantCustomName] = useState(
    props.models.settings.aiAssistantCustomName
  )
  const [remoteOllamaUrl, setRemoteOllamaUrl] = useState(props.models.settings.remoteOllamaUrl)
  const [remoteOllamaError, setRemoteOllamaError] = useState<string | null>(null)
  const [remoteOllamaSaving, setRemoteOllamaSaving] = useState(false)

  async function handleSaveRemoteOllama() {
    setRemoteOllamaError(null)
    setRemoteOllamaSaving(true)
    try {
      const res = await api.configureRemoteOllama(remoteOllamaUrl || null)
      if (res?.success) {
        addNotification({ message: res.message, type: 'success' })
        router.reload()
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || t('settingsModels.models.toasts.remoteConfigFailed')
      setRemoteOllamaError(msg)
    } finally {
      setRemoteOllamaSaving(false)
    }
  }

  async function handleClearRemoteOllama() {
    setRemoteOllamaError(null)
    setRemoteOllamaSaving(true)
    try {
      const res = await api.configureRemoteOllama(null)
      if (res?.success) {
        setRemoteOllamaUrl('')
        addNotification({ message: t('settingsModels.models.toasts.remoteCleared'), type: 'success' })
        router.reload()
      }
    } catch (error: any) {
      setRemoteOllamaError(error?.message || t('settingsModels.models.toasts.remoteClearFailed'))
    } finally {
      setRemoteOllamaSaving(false)
    }
  }

  const [query, setQuery] = useState('')
  const [queryUI, setQueryUI] = useState('')
  const [limit, setLimit] = useState(15)

  const debouncedSetQuery = debounce((val: string) => {
    setQuery(val)
  }, 300)

  const forceRefreshRef = useRef(false)
  const [isForceRefreshing, setIsForceRefreshing] = useState(false)

  const { data: availableModelData, isFetching, refetch } = useQuery({
    queryKey: ['ollama', 'availableModels', query, limit],
    queryFn: async () => {
      const force = forceRefreshRef.current
      forceRefreshRef.current = false
      const res = await api.getAvailableModels({
        query,
        recommendedOnly: false,
        limit,
        force: force || undefined,
      })
      if (!res) {
        return {
          models: [],
          hasMore: false,
        }
      }
      return res
    },
    // The server-rendered list is only the answer for the initial query; searches keep
    // showing the previous results until theirs arrive instead of the unfiltered list.
    initialData:
      query === '' && limit === 15 ? { models: props.models.availableModels, hasMore: false } : undefined,
    placeholderData: keepPreviousData,
  })

  async function handleForceRefresh() {
    forceRefreshRef.current = true
    setIsForceRefreshing(true)
    await refetch()
    setIsForceRefreshing(false)
    addNotification({ message: t('settingsModels.models.toasts.listRefreshed'), type: 'success' })
  }

  async function handleInstallModel(modelName: string) {
    try {
      const res = await api.downloadModel(modelName)
      if (res.success) {
        addNotification({
          message: t('settingsModels.models.toasts.installStarted', { model: modelName }),
          type: 'success',
        })
      }
    } catch (error) {
      console.error('Error installing model:', error)
      addNotification({
        message: t('settingsModels.models.toasts.installFailed', { model: modelName }),
        type: 'error',
      })
    }
  }

  async function handleDeleteModel(modelName: string) {
    try {
      // Close first: the modal element is stored once, so its confirm button stays clickable.
      closeAllModals()
      const res = await api.deleteModel(modelName)
      // catchInternal returns undefined on failure instead of throwing
      if (!res?.success) throw new Error(res?.message ?? 'Delete failed')
      addNotification({
        message: t('settingsModels.models.toasts.deleted', { model: modelName }),
        type: 'success',
      })
      router.reload()
    } catch (error) {
      console.error('Error deleting model:', error)
      addNotification({
        message: t('settingsModels.models.toasts.deleteFailed', { model: modelName }),
        type: 'error',
      })
    }
  }

  async function confirmDeleteModel(model: string) {
    openModal(
      <StyledModal
        title={t('settingsModels.models.deleteModal.title')}
        onConfirm={() => {
          handleDeleteModel(model)
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText={t('settingsModels.models.deleteModal.confirm')}
        cancelText={t('common.cancel')}
        confirmVariant="primary"
      >
        <p className="text-text-primary">
          {t('settingsModels.models.deleteModal.body')}
        </p>
      </StyledModal>,
      'confirm-delete-model-modal'
    )
  }

  // A model can be deleted after being picked here. Surface the stale name as a
  // disabled option instead of letting the select silently render empty — the
  // backend already falls back to the chat model at call time.
  // "Auto" sizes each model's window from its own trained context and what the
  // hardware can afford. An explicit choice is a cap, never a boost — asking for
  // more than a model or a GPU can support just degrades or fails to load.
  const contextWindowOptions = [
    'auto',
    '4096',
    '8192',
    '16384',
    '32768',
    '65536',
    '131072',
  ].map((value) => ({ value, label: t(`settingsModels.models.contextWindowOptions.${value}`) }))

  // Presets rather than a raw 0-1 number: the value is a cosine-similarity
  // floor, which is not a thing anyone can reason about directly. The stored
  // setting is still the number, so retuning these labels later cannot orphan a
  // saved value.
  // The presets are calibrated for nomic-embed-text; other embedding models score
  // on a different scale, so they get only "Off" and their own calibrated floor.
  const { defaultMinRelevance } = props.models.settings
  const relevancePresets: { value: number; label: string }[] =
    defaultMinRelevance === RAG_MIN_FINAL_SCORE
      ? [...RAG_MIN_RELEVANCE_PRESETS]
      : [RAG_MIN_RELEVANCE_PRESETS[0], { value: defaultMinRelevance, label: 'Balanced (recommended)' }]
  const presetKey = (value: number) =>
    value === defaultMinRelevance ? 'balanced' : RELEVANCE_PRESET_KEYS[value]
  const minRelevanceOptions = [
    ...relevancePresets.map((preset) => ({
      value: String(preset.value),
      // Unknown (newly added) presets show their English label until translated
      label: presetKey(preset.value)
        ? t(`settingsModels.models.relevancePresets.${presetKey(preset.value)}`)
        : preset.label,
    })),
    // The setting is API-writable to any value in [0,1], so a value off the
    // preset ladder is reachable. Surface it as a disabled option rather than
    // letting the select render empty — same treatment the tasks model gets when
    // the chosen model has since been deleted.
    ...(relevancePresets.some((p) => String(p.value) === minRelevance)
      ? []
      : [{ value: minRelevance, label: t('settingsModels.models.relevanceCustom', { value: minRelevance }), disabled: true }]),
  ]

  const embeddingModelOptions = Object.keys(EMBEDDING_MODELS).map((name) => ({
    value: name,
    label: t(
      name === EMBEDDING_MODEL_NAME
        ? 'settingsModels.models.embeddingModels.english'
        : 'settingsModels.models.embeddingModels.multilingual',
      { name }
    ),
  }))
  // Searches return nothing until the knowledge base is rebuilt with the chosen model
  const embeddingRebuildNeeded = embeddingModel !== props.models.settings.embeddingModelIndexed

  // Floors are not comparable between embedding models, so a switch also clears
  // rag.minRelevance back to the new model's own default.
  async function handleEmbeddingModelChange(name: string) {
    const previous = embeddingModel
    setEmbeddingModel(name)
    setEmbeddingSaving(true)
    const saved = await api.updateSetting('rag.embeddingModel', name)
    if (!saved?.success) {
      setEmbeddingModel(previous)
      setEmbeddingSaving(false)
      return
    }
    await api.updateSetting('rag.minRelevance', '')
    queryClient.invalidateQueries({ queryKey: ['system-setting', 'rag.embeddingModel'] })
    addNotification({ message: t('settingsModels.models.toasts.settingUpdated'), type: 'success' })
    router.reload({
      only: ['models'],
      onSuccess: (page) => {
        setMinRelevance(String((page.props as any).models.settings.minRelevance))
      },
      onFinish: () => setEmbeddingSaving(false),
    })
  }

  const responseStyleOptions = RESPONSE_STYLE_PRESETS.map((preset) => ({
    value: preset.value,
    label: t(`settingsModels.models.responseStyles.${preset.value}`),
  }))

  const resolvedWindows = props.models.resolvedContextWindows ?? {}
  const formatWindow = (tokens: number) =>
    tokens >= 1024 ? `${Math.round(tokens / 1024)}K` : String(tokens)

  const tasksModelOptions = [
    { value: '', label: t('settingsModels.models.tasksModelDefault') },
    ...props.models.installedModels.map((model) => ({ value: model.name, label: model.name })),
    ...(tasksModel && !props.models.installedModels.some((m) => m.name === tasksModel)
      ? [{ value: tasksModel, label: t('settingsModels.models.tasksModelNotInstalled', { model: tasksModel }), disabled: true }]
      : []),
  ]

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean | string }) => {
      return await api.updateSetting(key, value)
    },
    onSuccess: (_data, { key }) => {
      // Anything reading this key through useSystemSetting (e.g. the chat
      // window's own copy of the retrieval toggle) should pick the change up
      // without a reload.
      queryClient.invalidateQueries({ queryKey: ['system-setting', key] })
      addNotification({
        message: t('settingsModels.models.toasts.settingUpdated'),
        type: 'success',
      })
    },
    onError: (error) => {
      console.error('Error updating setting:', error)
      addNotification({
        message: t('settingsModels.models.toasts.settingFailed'),
        type: 'error',
      })
    },
  })

  return (
    <SettingsLayout>
      <Head title={t('settingsModels.models.headTitle', { name: aiAssistantName })} />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <h1 className="text-4xl font-semibold mb-4">{aiAssistantName}</h1>
          <p className="text-text-muted mb-4">
            {t('settingsModels.models.intro', { name: aiAssistantName })}
          </p>
          {!isInstalled && (
            <Alert
              title={t('settingsModels.models.depsMissing', { name: aiAssistantName })}
              type="warning"
              variant="solid"
              className="!mt-6"
            />
          )}
          {isInstalled && (
            <GpuPassthroughAlert
              gpuHealth={systemInfo?.gpuHealth}
              assistantName={aiAssistantName}
              className="!mt-6"
            />
          )}

          <StyledSectionHeader title={t('settingsModels.models.sections.settings')} className="mt-8 mb-4" />
          <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-6">
            <div className="space-y-4">
              <Switch
                checked={chatSuggestionsEnabled}
                onChange={(newVal) => {
                  setChatSuggestionsEnabled(newVal)
                  updateSettingMutation.mutate({ key: 'chat.suggestionsEnabled', value: newVal })
                }}
                label={t('settingsModels.models.settings.chatSuggestions.label')}
                description={t('settingsModels.models.settings.chatSuggestions.description')}
              />
              <Switch
                checked={ollamaFlashAttention}
                onChange={(newVal) => {
                  setOllamaFlashAttention(newVal)
                  updateSettingMutation.mutate({ key: 'ai.ollamaFlashAttention', value: newVal })
                }}
                label={t('settingsModels.models.settings.flashAttention.label')}
                description={t('settingsModels.models.settings.flashAttention.description')}
              />
              <Switch
                checked={autoThinking}
                onChange={(newVal) => {
                  setAutoThinking(newVal)
                  updateSettingMutation.mutate({ key: 'ai.autoThinking', value: newVal })
                }}
                label={t('settingsModels.models.settings.autoThinking.label')}
                description={t('settingsModels.models.settings.autoThinking.description')}
              />
              <Switch
                checked={ragEnabled}
                onChange={(newVal) => {
                  setRagEnabled(newVal)
                  updateSettingMutation.mutate({ key: 'rag.enabled', value: newVal })
                }}
                label={t('settingsModels.models.settings.rag.label')}
                description={t('settingsModels.models.settings.rag.description')}
              />
              <Input
                name="aiAssistantCustomName"
                label={t('settingsModels.models.settings.assistantName.label')}
                helpText={t('settingsModels.models.settings.assistantName.help')}
                placeholder={t('settingsModels.models.settings.assistantName.placeholder')}
                value={aiAssistantCustomName}
                onChange={(e) => setAiAssistantCustomName(e.target.value)}
                onBlur={() =>
                  updateSettingMutation.mutate({
                    key: 'ai.assistantCustomName',
                    value: aiAssistantCustomName,
                  })
                }
              />
              <Select
                name="tasksModel"
                label={t('settingsModels.models.settings.tasksModel.label')}
                helpText={t('settingsModels.models.settings.tasksModel.help')}
                value={tasksModel}
                options={tasksModelOptions}
                onChange={(newVal) => {
                  setTasksModel(newVal)
                  updateSettingMutation.mutate({ key: 'ai.tasksModel', value: newVal })
                }}
              />
              <Select
                name="embeddingModel"
                label={t('settingsModels.models.settings.embeddingModel.label')}
                helpText={t('settingsModels.models.settings.embeddingModel.help')}
                value={embeddingModel}
                options={embeddingModelOptions}
                disabled={!ragEnabled || embeddingSaving}
                onChange={handleEmbeddingModelChange}
              />
              {embeddingRebuildNeeded && (
                <Alert
                  type="warning"
                  variant="bordered"
                  title={t('settingsModels.models.embeddingRebuild.title')}
                  message={t('settingsModels.models.embeddingRebuild.message')}
                />
              )}
              <Select
                name="minRelevance"
                label={t('settingsModels.models.settings.minRelevance.label')}
                helpText={t('settingsModels.models.settings.minRelevance.help')}
                value={minRelevance}
                options={minRelevanceOptions}
                disabled={!ragEnabled}
                onChange={(newVal) => {
                  setMinRelevance(newVal)
                  updateSettingMutation.mutate({ key: 'rag.minRelevance', value: newVal })
                }}
              />
              <Switch
                checked={relevanceCheck}
                disabled={!ragEnabled}
                onChange={(newVal) => {
                  setRelevanceCheck(newVal)
                  updateSettingMutation.mutate({ key: 'rag.relevanceCheck', value: newVal })
                }}
                label={t('settingsModels.models.settings.relevanceCheck.label')}
                description={t('settingsModels.models.settings.relevanceCheck.description')}
              />
              <Select
                name="responseStyle"
                label={t('settingsModels.models.settings.responseStyle.label')}
                helpText={t('settingsModels.models.settings.responseStyle.help')}
                value={responseStyle}
                options={responseStyleOptions}
                onChange={(newVal) => {
                  setResponseStyle(newVal)
                  updateSettingMutation.mutate({ key: 'ai.responseStyle', value: newVal })
                }}
              />
              <Select
                name="contextWindow"
                label={t('settingsModels.models.settings.contextWindow.label')}
                helpText={t('settingsModels.models.settings.contextWindow.help')}
                value={contextWindow}
                options={contextWindowOptions}
                onChange={(newVal) => {
                  setContextWindow(newVal)
                  updateSettingMutation.mutate({ key: 'ai.contextWindow', value: newVal })
                }}
              />
              {Object.keys(resolvedWindows).length > 0 && (
                <p className="text-xs text-text-muted">
                  {t('settingsModels.models.settings.inEffect', {
                    windows: Object.entries(resolvedWindows)
                      .map(([name, tokens]) => `${name} → ${formatWindow(tokens)}`)
                      .join(', '),
                  })}
                </p>
              )}
            </div>
          </div>

          <StyledSectionHeader title={t('settingsModels.models.sections.installed')} className="mt-12 mb-4" />
          <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-6">
            {props.models.installedModels.length === 0 ? (
              <p className="text-text-muted">
                {t('settingsModels.models.installed.empty')}
              </p>
            ) : (
              <table className="min-w-full divide-y divide-border-subtle">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t('settingsModels.models.installed.model')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t('settingsModels.models.installed.parameters')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t('settingsModels.models.installed.diskSize')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t('settingsModels.models.installed.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {props.models.installedModels.map((model) => (
                    <tr key={model.name} className="hover:bg-surface-secondary">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-text-primary">{model.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">
                          {model.details?.parameter_size || t('settingsModels.models.installed.na')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">
                          {formatBytes(model.size)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StyledButton
                          variant="danger"
                          size="sm"
                          onClick={() => confirmDeleteModel(model.name)}
                          icon="IconTrash"
                        >
                          {t('settingsModels.models.installed.delete')}
                        </StyledButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <StyledSectionHeader title={t('settingsModels.models.sections.remote')} className="mt-8 mb-4" />
          <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-6">
            <p className="text-sm text-text-secondary mb-4">
              {t('settingsModels.models.remote.description')}{' '}
              <Trans
                i18nKey="settingsModels.models.remote.ollamaHostNote"
                components={{ code: <code className="bg-surface-secondary px-1 rounded" /> }}
              />
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  name="remoteOllamaUrl"
                  label={t('settingsModels.models.remote.urlLabel')}
                  placeholder={t('settingsModels.models.remote.urlPlaceholder')}
                  value={remoteOllamaUrl}
                  onChange={(e) => {
                    setRemoteOllamaUrl(e.target.value)
                    setRemoteOllamaError(null)
                  }}
                />
                {remoteOllamaError && (
                  <p className="text-sm text-red-600 mt-1">{remoteOllamaError}</p>
                )}
              </div>
              <StyledButton
                variant="primary"
                onClick={handleSaveRemoteOllama}
                loading={remoteOllamaSaving}
                disabled={remoteOllamaSaving || !remoteOllamaUrl}
                className="mb-0.5"
              >
                {t('settingsModels.models.remote.saveTest')}
              </StyledButton>
              {props.models.settings.remoteOllamaUrl && (
                <StyledButton
                  variant="danger"
                  onClick={handleClearRemoteOllama}
                  loading={remoteOllamaSaving}
                  disabled={remoteOllamaSaving}
                  className="mb-0.5"
                >
                  {t('settingsModels.models.remote.clear')}
                </StyledButton>
              )}
            </div>
          </div>

          <ActiveModelDownloads withHeader />

          <StyledSectionHeader title={t('settingsModels.models.sections.models')} className="mt-12 mb-4" />
          <Alert
            type="info"
            variant="bordered"
            title={t('settingsModels.models.catalog.alertTitle')}
            message={t('settingsModels.models.catalog.alertMessage')}
            className="mb-4"
          />
          <div className="flex justify-start items-center gap-3 mt-4">
            <Input
              name="search"
              label=""
              placeholder={t('settingsModels.models.catalog.searchPlaceholder')}
              value={queryUI}
              onChange={(e) => {
                setQueryUI(e.target.value)
                debouncedSetQuery(e.target.value)
              }}
              className="w-1/3"
              leftIcon={<IconSearch className="w-5 h-5 text-text-muted" />}
            />
            <StyledButton
              variant="secondary"
              onClick={handleForceRefresh}
              icon="IconRefresh"
              loading={isForceRefreshing}
              className='mt-1'
            >
              {t('settingsModels.models.catalog.refresh')}
            </StyledButton>
          </div>
          <StyledTable<NomadOllamaModel>
            className="font-semibold mt-4"
            rowLines={true}
            columns={[
              {
                accessor: 'name',
                title: t('settingsModels.models.catalog.name'),
                render(record) {
                  return (
                    <div className="flex flex-col">
                      <p className="text-lg font-semibold">{record.name}</p>
                      <p className="text-sm text-text-muted">{record.description}</p>
                    </div>
                  )
                },
              },
              {
                accessor: 'estimated_pulls',
                title: t('settingsModels.models.catalog.estimatedPulls'),
              },
              {
                accessor: 'model_last_updated',
                title: t('settingsModels.models.catalog.lastUpdated'),
              },
            ]}
            data={availableModelData?.models || []}
            loading={isFetching}
            expandable={{
              expandedRowRender: (record) => (
                <div className="pl-14">
                  <div className="bg-surface-primary overflow-hidden">
                    <table className="min-w-full divide-y divide-border-subtle">
                      <thead className="bg-surface-primary">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                            {t('settingsModels.models.catalog.tag')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                            {t('settingsModels.models.catalog.inputType')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                            {t('settingsModels.models.catalog.contextSize')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                            {t('settingsModels.models.catalog.modelSize')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                            {t('settingsModels.models.catalog.action')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-surface-primary divide-y divide-border-subtle">
                        {record.tags.map((tag, tagIndex) => {
                          const isInstalled = props.models.installedModels.some(
                            (mod) => mod.name === tag.name
                          )
                          return (
                            <tr key={tagIndex} className="hover:bg-surface-secondary">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-text-primary">
                                  {tag.name}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-text-secondary">{tag.input || t('settingsModels.models.installed.na')}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-text-secondary">
                                  {tag.context || t('settingsModels.models.installed.na')}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-text-secondary">{tag.size || t('settingsModels.models.installed.na')}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <StyledButton
                                  variant={isInstalled ? 'danger' : 'primary'}
                                  onClick={() => {
                                    if (!isInstalled) {
                                      handleInstallModel(tag.name)
                                    } else {
                                      confirmDeleteModel(tag.name)
                                    }
                                  }}
                                  icon={isInstalled ? 'IconTrash' : 'IconDownload'}
                                >
                                  {isInstalled ? t('settingsModels.models.catalog.delete') : t('settingsModels.models.catalog.install')}
                                </StyledButton>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ),
            }}
          />
          <div className="flex justify-center mt-6">
            {availableModelData?.hasMore && (
              <StyledButton
                variant="primary"
                onClick={() => {
                  setLimit((prev) => prev + 15)
                }}
              >
                {t('settingsModels.models.catalog.loadMore')}
              </StyledButton>
            )}
          </div>
        </main>
      </div>
    </SettingsLayout>
  )
}
