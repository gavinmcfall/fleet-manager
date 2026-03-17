import React, { useState, useEffect } from 'react'
import { Tags, Save, Loader, ChevronDown, ChevronUp, GripVertical, Eye, EyeOff } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import { saveLocalizationConfig } from '../../hooks/useAPI'

const LABEL_CATEGORIES = [
  { key: 'labelsVehicleComponents', dbKey: 'vehicle_components', label: 'Ship Components', desc: 'Power plants, coolers, shields, quantum drives, turrets, mining equipment' },
  { key: 'labelsFpsWeapons', dbKey: 'fps_weapons', label: 'FPS Weapons', desc: 'Personal weapons — rifles, pistols, SMGs, shotguns, sniper rifles' },
  { key: 'labelsFpsArmour', dbKey: 'fps_armour', label: 'FPS Armour', desc: 'Body armour — torso, legs, arms, undersuits, backpacks' },
  { key: 'labelsFpsHelmets', dbKey: 'fps_helmets', label: 'Helmets', desc: 'All helmet types with grade and manufacturer' },
  { key: 'labelsFpsAttachments', dbKey: 'fps_attachments', label: 'Weapon Attachments', desc: 'Sights, barrels, underbarrel attachments' },
  { key: 'labelsFpsUtilities', dbKey: 'fps_utilities', label: 'Utilities', desc: 'Gadgets, medical pens, multitool attachments' },
  { key: 'labelsConsumables', dbKey: 'consumables', label: 'Consumables', desc: 'Food, drinks, medical supplies' },
  { key: 'labelsShipMissiles', dbKey: 'ship_missiles', label: 'Ship Missiles', desc: 'Ship-mounted missiles and torpedoes' },
]

// Available fields per category (must match backend CATEGORY_AVAILABLE_FIELDS)
const CATEGORY_FIELDS = {
  vehicle_components: ['manufacturer', 'size', 'grade', 'subType'],
  fps_weapons: ['manufacturer', 'size', 'subType'],
  fps_armour: ['manufacturer', 'size', 'grade', 'subType'],
  fps_helmets: ['manufacturer', 'grade', 'subType'],
  fps_attachments: ['manufacturer', 'subType'],
  fps_utilities: ['manufacturer', 'subType'],
  consumables: ['manufacturer', 'subType'],
  ship_missiles: ['manufacturer', 'size', 'subType'],
}

const FIELD_LABELS = {
  manufacturer: 'Manufacturer',
  size: 'Size',
  grade: 'Grade',
  subType: 'Type',
}

// Example data per category for live preview
const EXAMPLE_DATA = {
  vehicle_components: { name: 'FullStop', manufacturer: 'GODI', size: 2, grade: 'C', subType: 'Cooler' },
  fps_weapons: { name: 'Demeco LMG', manufacturer: 'KRIG', size: 2, grade: null, subType: 'LMG' },
  fps_armour: { name: 'Morozov Core', manufacturer: 'AEGS', size: null, grade: 'B', subType: 'Torso' },
  fps_helmets: { name: 'Calva Helmet', manufacturer: 'AEGS', size: null, grade: 'B', subType: 'Heavy' },
  fps_attachments: { name: '4x Scope', manufacturer: 'KBAR', size: null, grade: null, subType: 'Sight' },
  fps_utilities: { name: 'ParaMed', manufacturer: 'CRUS', size: null, grade: null, subType: 'Medical' },
  consumables: { name: 'Big Benny\'s', manufacturer: null, size: null, grade: null, subType: 'Food' },
  ship_missiles: { name: 'Dominator II', manufacturer: 'THRT', size: 3, grade: null, subType: 'CS' },
}

function buildPreviewLabel(dbKey, fields, format) {
  const data = EXAMPLE_DATA[dbKey]
  if (!data) return data?.name || '—'

  const parts = []
  for (const field of fields) {
    switch (field) {
      case 'manufacturer': if (data.manufacturer) parts.push(data.manufacturer); break
      case 'size': if (data.size != null) parts.push(`S${data.size}`); break
      case 'grade': if (data.grade) parts.push(`Gr.${data.grade}`); break
      case 'subType': if (data.subType) parts.push(data.subType); break
    }
  }

  const tag = parts.join(' | ')
  if (!tag) return data.name
  return format === 'prefix' ? `[${tag}] ${data.name}` : `${data.name} [${tag}]`
}

function CategoryConfig({ cat, catFormat, onChange }) {
  const available = CATEGORY_FIELDS[cat.dbKey] || []
  const fields = catFormat.fields
  const format = catFormat.format

  const moveField = (idx, direction) => {
    const next = [...fields]
    const target = idx + direction
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange({ ...catFormat, fields: next })
  }

  const toggleField = (field) => {
    const isActive = fields.includes(field)
    let next
    if (isActive) {
      next = fields.filter(f => f !== field)
    } else {
      // Add at end
      next = [...fields, field]
    }
    onChange({ ...catFormat, fields: next })
  }

  const toggleFormat = () => {
    onChange({ ...catFormat, format: format === 'suffix' ? 'prefix' : 'suffix' })
  }

  const preview = buildPreviewLabel(cat.dbKey, fields, format)

  return (
    <div className="mt-3 space-y-3 pl-7 border-l-2 border-sc-accent/20 ml-2">
      {/* Live preview */}
      <div className="bg-black/40 rounded px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Preview</p>
        <p className="text-sm font-mono text-sc-accent">{preview}</p>
      </div>

      {/* Format toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Position:</span>
        <button
          onClick={toggleFormat}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            format === 'suffix'
              ? 'bg-sc-accent/10 border-sc-accent/30 text-sc-accent'
              : 'border-sc-border text-gray-400 hover:border-gray-500'
          }`}
        >
          Name [...]
        </button>
        <button
          onClick={toggleFormat}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            format === 'prefix'
              ? 'bg-sc-accent/10 border-sc-accent/30 text-sc-accent'
              : 'border-sc-border text-gray-400 hover:border-gray-500'
          }`}
        >
          [...] Name
        </button>
      </div>

      {/* Field chips — active (ordered) then inactive */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Fields (drag to reorder, click to toggle)</p>
        {/* Active fields in order */}
        {fields.map((field, idx) => (
          <div
            key={field}
            className="flex items-center gap-2 bg-sc-accent/5 border border-sc-accent/20 rounded px-2.5 py-1.5 group"
          >
            <GripVertical className="w-3 h-3 text-gray-600" />
            <span className="text-xs text-gray-200 flex-1">{FIELD_LABELS[field]}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => moveField(idx, -1)}
                disabled={idx === 0}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                title="Move up"
              >
                <ChevronUp className="w-3 h-3 text-gray-400" />
              </button>
              <button
                onClick={() => moveField(idx, 1)}
                disabled={idx === fields.length - 1}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
            </div>
            <button
              onClick={() => toggleField(field)}
              className="p-0.5 rounded hover:bg-red-500/20"
              title="Remove field"
            >
              <EyeOff className="w-3 h-3 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        ))}
        {/* Inactive fields */}
        {available.filter(f => !fields.includes(f)).map(field => (
          <button
            key={field}
            onClick={() => toggleField(field)}
            className="flex items-center gap-2 w-full bg-black/20 border border-sc-border border-dashed rounded px-2.5 py-1.5 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
          >
            <Eye className="w-3 h-3" />
            <span className="text-xs">{FIELD_LABELS[field]}</span>
            <span className="text-[10px] ml-auto">click to add</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LabelSettingsTab({
  config, preview, previewLoading, saving, setSaving,
  showNotification, refetchConfig, refetchPreview,
}) {
  const [localConfig, setLocalConfig] = useState(null)
  const [dirty, setDirty] = useState(false)

  const current = localConfig || config || {}

  // Get category format (per-category or fallback)
  const getCatFormat = (dbKey) => {
    const formats = current.categoryFormats || {}
    if (formats[dbKey]) return formats[dbKey]
    return {
      fields: [...(CATEGORY_FIELDS[dbKey] || [])],
      format: current.labelFormat || 'suffix',
    }
  }

  const toggleCategory = (key) => {
    const next = { ...current, [key]: !current[key] }
    setLocalConfig(next)
    setDirty(true)
  }

  const updateCatFormat = (dbKey, newFormat) => {
    const formats = { ...(current.categoryFormats || {}) }
    formats[dbKey] = newFormat
    const next = { ...current, categoryFormats: formats }
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

  return (
    <div className="space-y-4">
      <PanelSection title="Item Label Categories" icon={Tags}>
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-400 mb-3">
            Enable categories and configure which metadata fields appear in each label.
          </p>

          {LABEL_CATEGORIES.map(cat => {
            const enabled = current[cat.key] || false
            return (
              <div key={cat.key} className="space-y-0">
                {/* Category toggle */}
                <label
                  className={`flex items-center gap-3 px-4 py-3 rounded-t border cursor-pointer transition-colors ${
                    enabled
                      ? 'bg-sc-accent/5 border-sc-accent/30 hover:border-sc-accent/50'
                      : 'bg-black/20 border-sc-border hover:border-gray-600 rounded-b'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleCategory(cat.key)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                    enabled ? 'bg-sc-accent border-sc-accent' : 'border-gray-600'
                  }`}>
                    {enabled && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-200">{cat.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.desc}</p>
                  </div>
                  {enabled && (
                    <span className="text-[10px] text-sc-accent/70 uppercase tracking-wider shrink-0">
                      {getCatFormat(cat.dbKey).fields.length} fields
                    </span>
                  )}
                </label>

                {/* Per-category config (when enabled) */}
                {enabled && (
                  <div className="border border-t-0 border-sc-accent/20 rounded-b bg-black/10 px-4 py-3">
                    <CategoryConfig
                      cat={cat}
                      catFormat={getCatFormat(cat.dbKey)}
                      onChange={(fmt) => updateCatFormat(cat.dbKey, fmt)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </PanelSection>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  )
}
