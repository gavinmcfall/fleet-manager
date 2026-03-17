import React, { useState } from 'react'
import { Tags, Save, Loader, Eye } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import { saveLocalizationConfig } from '../../hooks/useAPI'

const LABEL_CATEGORIES = [
  { key: 'labelsVehicleComponents', label: 'Ship Components', desc: 'Power plants, coolers, shields, quantum drives, turrets, mining equipment' },
  { key: 'labelsFpsWeapons', label: 'FPS Weapons', desc: 'Personal weapons — rifles, pistols, SMGs, shotguns, sniper rifles' },
  { key: 'labelsFpsArmour', label: 'FPS Armour', desc: 'Body armour — torso, legs, arms, undersuits, backpacks' },
  { key: 'labelsFpsHelmets', label: 'Helmets', desc: 'All helmet types with grade and manufacturer' },
  { key: 'labelsFpsAttachments', label: 'Weapon Attachments', desc: 'Sights, barrels, underbarrel attachments' },
  { key: 'labelsFpsUtilities', label: 'Utilities', desc: 'Gadgets, medical pens, multitool attachments' },
  { key: 'labelsConsumables', label: 'Consumables', desc: 'Food, drinks, medical supplies' },
  { key: 'labelsShipMissiles', label: 'Ship Missiles', desc: 'Ship-mounted missiles and torpedoes' },
]

const FORMAT_OPTIONS = [
  { key: 'suffix', label: 'Name [details]', example: 'FullStop [Gorgon | S2 | Gr.C | Cooler]' },
  { key: 'prefix', label: '[details] Name', example: '[Gorgon | S2 | Gr.C | Cooler] FullStop' },
]

export default function LabelSettingsTab({
  config, preview, previewLoading, saving, setSaving,
  showNotification, refetchConfig, refetchPreview,
}) {
  const [localConfig, setLocalConfig] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Use local config for edits, fall back to server config
  const current = localConfig || config || {}

  const toggleCategory = (key) => {
    const next = { ...current, [key]: !current[key] }
    setLocalConfig(next)
    setDirty(true)
  }

  const setFormat = (format) => {
    const next = { ...current, labelFormat: format }
    setLocalConfig(next)
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveLocalizationConfig(current)
      refetchConfig()
      refetchPreview()
      setDirty(false)
      setLocalConfig(null)
      showNotification('Label settings saved', 'success')
    } catch (e) {
      showNotification(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const anyEnabled = LABEL_CATEGORIES.some(cat => current[cat.key])

  return (
    <div className="space-y-4">
      <PanelSection title="Item Label Categories" icon={Tags}>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            Enable categories to add metadata (manufacturer, size, grade) to item names in-game.
          </p>

          {/* Category toggles */}
          <div className="grid gap-2">
            {LABEL_CATEGORIES.map(cat => (
              <label
                key={cat.key}
                className={`flex items-center gap-3 px-4 py-3 rounded border cursor-pointer transition-colors ${
                  current[cat.key]
                    ? 'bg-sc-accent/5 border-sc-accent/30 hover:border-sc-accent/50'
                    : 'bg-black/20 border-sc-border hover:border-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={current[cat.key] || false}
                  onChange={() => toggleCategory(cat.key)}
                  className="sr-only peer"
                />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  current[cat.key] ? 'bg-sc-accent border-sc-accent' : 'border-gray-600'
                }`}>
                  {current[cat.key] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{cat.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </PanelSection>

      {/* Format selector */}
      <PanelSection title="Label Format">
        <div className="p-4 space-y-3">
          {FORMAT_OPTIONS.map(opt => (
            <label
              key={opt.key}
              className={`flex items-center gap-3 px-4 py-3 rounded border cursor-pointer transition-colors ${
                (current.labelFormat || 'suffix') === opt.key
                  ? 'bg-sc-accent/5 border-sc-accent/30'
                  : 'bg-black/20 border-sc-border hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="labelFormat"
                checked={(current.labelFormat || 'suffix') === opt.key}
                onChange={() => setFormat(opt.key)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                (current.labelFormat || 'suffix') === opt.key ? 'border-sc-accent' : 'border-gray-600'
              }`}>
                {(current.labelFormat || 'suffix') === opt.key && (
                  <div className="w-2 h-2 rounded-full bg-sc-accent" />
                )}
              </div>
              <div>
                <span className="text-sm text-gray-200">{opt.label}</span>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{opt.example}</p>
              </div>
            </label>
          ))}
        </div>
      </PanelSection>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        {anyEnabled && (
          <button
            onClick={() => { setShowPreview(!showPreview); if (!showPreview) refetchPreview() }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* Preview panel */}
      {showPreview && preview && (
        <PanelSection title={`Preview (${preview.count || 0} overrides)`}>
          <div className="p-4">
            {previewLoading ? (
              <div className="flex justify-center py-4">
                <Loader className="w-4 h-4 animate-spin text-sc-accent" />
              </div>
            ) : preview.overrides?.length > 0 ? (
              <div className="bg-black/40 rounded p-3 space-y-1 font-mono text-xs max-h-80 overflow-y-auto">
                {preview.overrides.slice(0, 100).map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-500 truncate max-w-48">{o.key}</span>
                    <span className="text-gray-600">=</span>
                    <span className="text-gray-300 truncate">{o.value}</span>
                  </div>
                ))}
                {preview.overrides.length > 100 && (
                  <div className="text-gray-500 pt-2">... and {preview.overrides.length - 100} more</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No overrides. Enable categories and save to generate labels.
              </p>
            )}
          </div>
        </PanelSection>
      )}
    </div>
  )
}
