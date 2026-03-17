import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Languages, Rocket, Tags, Download, Loader, Save, AlertCircle, CheckCircle } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import PanelSection from '../../components/PanelSection'
import {
  useLocalizationConfig,
  saveLocalizationConfig,
  useLocalizationShipOrder,
  saveLocalizationShipOrder,
  useLocalizationPreview,
  useFleet,
} from '../../hooks/useAPI'
import AsopOrderTab from './AsopOrderTab'
import LabelSettingsTab from './LabelSettingsTab'

const TABS = [
  { key: 'asop', label: 'ASOP Ordering', icon: Rocket },
  { key: 'labels', label: 'Item Labels', icon: Tags },
]

export default function LocalizationBuilder() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'asop'

  const { data: config, loading: configLoading, refetch: refetchConfig } = useLocalizationConfig()
  const { data: shipOrder, loading: orderLoading, refetch: refetchOrder } = useLocalizationShipOrder()
  const { data: fleet, loading: fleetLoading } = useFleet()
  const { data: preview, loading: previewLoading, refetch: refetchPreview } = useLocalizationPreview()

  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const showNotification = useCallback((msg, variant = 'info') => {
    setNotification({ msg, variant })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  const setTab = (tab) => {
    setSearchParams({ tab })
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/localization/download', { credentials: 'same-origin' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download failed' }))
        throw new Error(err.error || 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'global.ini'
      a.click()
      URL.revokeObjectURL(url)
      showNotification('Downloaded global.ini', 'success')
    } catch (e) {
      showNotification(e.message, 'error')
    } finally {
      setDownloading(false)
    }
  }

  const hasAnyEnabled = config && (
    config.asopEnabled || config.labelsVehicleComponents || config.labelsFpsWeapons ||
    config.labelsFpsArmour || config.labelsFpsHelmets || config.labelsFpsAttachments ||
    config.labelsFpsUtilities || config.labelsConsumables || config.labelsShipMissiles
  )

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-5 h-5 animate-spin text-sc-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Localization Builder"
        subtitle="Customize your Star Citizen global.ini with ASOP ordering and enriched item labels"
        actions={
          <button
            onClick={handleDownload}
            disabled={downloading || !hasAnyEnabled}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {downloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download global.ini
          </button>
        }
      />

      {notification && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded text-sm ${
          notification.variant === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
          notification.variant === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>
          {notification.variant === 'success' ? <CheckCircle className="w-4 h-4" /> :
           notification.variant === 'error' ? <AlertCircle className="w-4 h-4" /> : null}
          {notification.msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-sc-border">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-display uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'text-sc-accent border-sc-accent'
                  : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'asop' && (
        <AsopOrderTab
          config={config}
          shipOrder={shipOrder}
          fleet={fleet}
          loading={orderLoading || fleetLoading}
          saving={saving}
          setSaving={setSaving}
          showNotification={showNotification}
          refetchConfig={refetchConfig}
          refetchOrder={refetchOrder}
          refetchPreview={refetchPreview}
        />
      )}

      {activeTab === 'labels' && (
        <LabelSettingsTab
          config={config}
          preview={preview}
          previewLoading={previewLoading}
          saving={saving}
          setSaving={setSaving}
          showNotification={showNotification}
          refetchConfig={refetchConfig}
          refetchPreview={refetchPreview}
        />
      )}

      {/* Installation instructions */}
      <PanelSection title="Installation" icon={Languages}>
        <div className="p-4 text-sm text-gray-400 space-y-3">
          <p>After downloading, place the <code className="text-gray-300 bg-white/5 px-1.5 py-0.5 rounded">global.ini</code> file in your Star Citizen installation folder:</p>
          <pre className="bg-black/30 rounded p-3 text-xs text-gray-300 overflow-x-auto">
{`StarCitizen/
└── LIVE/           (or PTU/ or EPTU/)
    ├── user.cfg
    └── data/
        └── Localization/
            └── english/
                └── global.ini   ← place file here`}
          </pre>
          <p>
            If <code className="text-gray-300 bg-white/5 px-1.5 py-0.5 rounded">user.cfg</code> doesn't exist, create it with:
          </p>
          <pre className="bg-black/30 rounded p-3 text-xs text-gray-300">g_language = english</pre>
          <p className="text-yellow-400/80 text-xs">
            Game updates will overwrite your global.ini. Re-download from here after each patch.
          </p>
        </div>
      </PanelSection>
    </div>
  )
}
