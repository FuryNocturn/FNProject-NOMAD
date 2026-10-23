import { Head } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import SettingsLayout from '~/layouts/SettingsLayout'
import { SystemInformationResponse } from '../../../types/system'
import { formatBytes } from '~/lib/util'
import { getAllDiskDisplayItems } from '~/hooks/useDiskDisplayData'
import CircularGauge from '~/components/systeminfo/CircularGauge'
import HorizontalBarChart from '~/components/HorizontalBarChart'
import InfoCard from '~/components/systeminfo/InfoCard'
import Alert from '~/components/Alert'
import GpuPassthroughAlert from '~/components/GpuPassthroughAlert'
import { useSystemInfo } from '~/hooks/useSystemInfo'
import StatusCard from '~/components/systeminfo/StatusCard'
import { IconCpu, IconDatabase, IconServer, IconDeviceDesktop, IconComponents } from '@tabler/icons-react'

export default function SettingsPage(props: {
  system: { info: SystemInformationResponse | undefined }
}) {
  const { t } = useTranslation()
  const { data: info } = useSystemInfo({
    initialData: props.system.info,
  })

  // Use (total - available) to reflect actual memory pressure.
  // mem.used includes reclaimable buff/cache on Linux, which inflates the number.
  const memoryUsed = info?.mem.total && info?.mem.available != null
    ? info.mem.total - info.mem.available
    : info?.mem.used || 0
  const memoryUsagePercent = info?.mem.total
    ? ((memoryUsed / info.mem.total) * 100).toFixed(1)
    : 0

  const swapUsagePercent = info?.mem.swaptotal
    ? ((info.mem.swapused / info.mem.swaptotal) * 100).toFixed(1)
    : 0

  const uptimeSeconds = info?.uptime.uptime || 0
  const uptimeDays = Math.floor(uptimeSeconds / 86400)
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600)
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)
  const uptimeDisplay = uptimeDays > 0
    ? `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
    : uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes}m`
      : `${uptimeMinutes}m`

  // Build storage display items - fall back to fsSize when disk array is empty
  const storageItems = getAllDiskDisplayItems(info?.disk, info?.fsSize)

  return (
    <SettingsLayout>
      <Head title={t('settingsSystem.system.title')} />
      <div className="xl:pl-72 w-full">
        <main className="px-6 lg:px-12 py-6 lg:py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-desert-green mb-2">{t('settingsSystem.system.title')}</h1>
            <p className="text-desert-stone-dark">
              {t('settingsSystem.system.subtitle', { time: new Date().toLocaleString() })}
            </p>
          </div>
          {Number(memoryUsagePercent) > 90 && (
            <div className="mb-6">
              <Alert
                type="error"
                title={t('settingsSystem.system.highMemory.title')}
                message={t('settingsSystem.system.highMemory.message')}
                variant="bordered"
              />
            </div>
          )}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              {t('settingsSystem.system.resourceUsage')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
                <CircularGauge
                  value={info?.currentLoad.currentLoad || 0}
                  label={t('settingsSystem.system.cpuUsage')}
                  size="lg"
                  variant="cpu"
                  subtext={t('settingsSystem.system.cores', { count: info?.cpu.cores || 0 })}
                  icon={<IconCpu className="w-8 h-8" />}
                />
              </div>
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
                <CircularGauge
                  value={Number(memoryUsagePercent)}
                  label={t('settingsSystem.system.memoryUsage')}
                  size="lg"
                  variant="memory"
                  subtext={`${formatBytes(memoryUsed)} / ${formatBytes(info?.mem.total || 0)}`}
                  icon={<IconDatabase className="w-8 h-8" />}
                />
              </div>
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
                <CircularGauge
                  value={Number(swapUsagePercent)}
                  label={t('settingsSystem.system.swapUsage')}
                  size="lg"
                  variant="disk"
                  subtext={`${formatBytes(info?.mem.swapused || 0)} / ${formatBytes(info?.mem.swaptotal || 0)}`}
                  icon={<IconServer className="w-8 h-8" />}
                />
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              {t('settingsSystem.system.systemDetails')}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InfoCard
                title={t('settingsSystem.system.os.title')}
                icon={<IconDeviceDesktop className="w-6 h-6" />}
                variant="elevated"
                data={[
                  { label: t('settingsSystem.system.os.distribution'), value: info?.os.distro },
                  { label: t('settingsSystem.system.os.kernel'), value: info?.os.kernel },
                  { label: t('settingsSystem.system.os.architecture'), value: info?.os.arch },
                  { label: t('settingsSystem.system.os.hostname'), value: info?.os.hostname },
                  { label: t('settingsSystem.system.os.platform'), value: info?.os.platform },
                ]}
              />
              <InfoCard
                title={t('settingsSystem.system.processor.title')}
                icon={<IconCpu className="w-6 h-6" />}
                variant="elevated"
                data={[
                  { label: t('settingsSystem.system.processor.manufacturer'), value: info?.cpu.manufacturer },
                  { label: t('settingsSystem.system.processor.brand'), value: info?.cpu.brand },
                  { label: t('settingsSystem.system.processor.cores'), value: info?.cpu.cores },
                  { label: t('settingsSystem.system.processor.physicalCores'), value: info?.cpu.physicalCores },
                  {
                    label: t('settingsSystem.system.processor.virtualization'),
                    value: info?.cpu.virtualization
                      ? t('settingsSystem.system.processor.enabled')
                      : t('settingsSystem.system.processor.disabled'),
                  },
                ]}
              />
              {info?.gpuHealth?.status === 'passthrough_failed' && (
                <div className="lg:col-span-2">
                  <GpuPassthroughAlert gpuHealth={info.gpuHealth} assistantName={t('settingsSystem.system.aiAssistant')} />
                </div>
              )}
              {info?.graphics?.controllers && info.graphics.controllers.length > 0 && (
                <InfoCard
                  title={t('settingsSystem.system.graphics.title')}
                  icon={<IconComponents className="w-6 h-6" />}
                  variant="elevated"
                  data={info.graphics.controllers.map((gpu, i) => {
                    const multi = info.graphics.controllers.length > 1
                    const n = i + 1
                    return [
                      {
                        label: multi ? t('settingsSystem.system.graphics.modelN', { n }) : t('settingsSystem.system.graphics.model'),
                        value: gpu.model,
                      },
                      {
                        label: multi ? t('settingsSystem.system.graphics.vendorN', { n }) : t('settingsSystem.system.graphics.vendor'),
                        value: gpu.vendor,
                      },
                      {
                        label: multi ? t('settingsSystem.system.graphics.vramN', { n }) : t('settingsSystem.system.graphics.vram'),
                        value: gpu.vram ? `${gpu.vram} MB` : t('settingsSystem.common.na'),
                      },
                    ]
                  }).flat()}
                />
              )}
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              {t('settingsSystem.system.memoryAllocation')}
            </h2>
            <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-desert-green mb-1">
                    {formatBytes(info?.mem.total || 0)}
                  </div>
                  <div className="text-sm text-desert-stone-dark uppercase tracking-wide">
                    {t('settingsSystem.system.totalRam')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-desert-green mb-1">
                    {formatBytes(memoryUsed)}
                  </div>
                  <div className="text-sm text-desert-stone-dark uppercase tracking-wide">
                    {t('settingsSystem.system.usedRam')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-desert-green mb-1">
                    {formatBytes(info?.mem.available || 0)}
                  </div>
                  <div className="text-sm text-desert-stone-dark uppercase tracking-wide">
                    {t('settingsSystem.system.availableRam')}
                  </div>
                </div>
              </div>
              <div className="relative h-12 bg-desert-stone-lighter rounded-lg overflow-hidden border border-desert-stone-light">
                <div
                  className="absolute left-0 top-0 h-full bg-desert-orange transition-all duration-1000"
                  style={{ width: `${memoryUsagePercent}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-white drop-shadow-md z-10">
                    {t('settingsSystem.system.utilized', { percent: memoryUsagePercent })}
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              {t('settingsSystem.system.storageDevices')}
            </h2>

            <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
              {storageItems.length > 0 ? (
                <HorizontalBarChart
                  items={storageItems}
                  progressiveBarColor={true}
                  statuses={[
                    {
                      label: t('settingsSystem.system.storageNormal'),
                      min_threshold: 0,
                      color_class: 'bg-desert-olive',
                    },
                    {
                      label: t('settingsSystem.system.storageWarning'),
                      min_threshold: 75,
                      color_class: 'bg-desert-orange',
                    },
                    {
                      label: t('settingsSystem.system.storageCritical'),
                      min_threshold: 90,
                      color_class: 'bg-desert-red',
                    },
                  ]}
                />
              ) : (
                <div className="text-center text-desert-stone-dark py-8">
                  {t('settingsSystem.system.noStorage')}
                </div>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              {t('settingsSystem.system.systemStatus')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard title={t('settingsSystem.system.uptime')} value={uptimeDisplay} />
              <StatusCard title={t('settingsSystem.system.cpuCores')} value={info?.cpu.cores || 0} />
              <StatusCard title={t('settingsSystem.system.storageDevices')} value={storageItems.length} />
            </div>
          </section>
        </main>
      </div>
    </SettingsLayout>
  )
}
