import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Languages, Rocket, Tags, Download, Loader, Save, AlertCircle, CheckCircle, ChevronDown, ChevronUp, GripVertical, X, Eye, EyeOff } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import PanelSection from '../../components/PanelSection'
import {
  useLocalizationConfig,
  saveLocalizationConfig,
  useLocalizationShipOrder,
  saveLocalizationShipOrder,
  useFleet,
} from '../../hooks/useAPI'

// ── Category definitions ────────────────────────────────────────────

const LABEL_CATEGORIES = [
  { key: 'labelsVehicleComponents', dbKey: 'vehicle_components', label: 'Ship Components', desc: 'Power plants, coolers, shields, quantum drives, turrets' },
  { key: 'labelsFpsWeapons', dbKey: 'fps_weapons', label: 'FPS Weapons', desc: 'Rifles, pistols, SMGs, shotguns, sniper rifles' },
  { key: 'labelsFpsArmour', dbKey: 'fps_armour', label: 'FPS Armour', desc: 'Torso, legs, arms, undersuits, backpacks' },
  { key: 'labelsFpsHelmets', dbKey: 'fps_helmets', label: 'Helmets', desc: 'All helmet types' },
  { key: 'labelsFpsAttachments', dbKey: 'fps_attachments', label: 'Weapon Attachments', desc: 'Sights, barrels, underbarrel' },
  { key: 'labelsFpsUtilities', dbKey: 'fps_utilities', label: 'Utilities', desc: 'Gadgets, medical, multitool' },
  { key: 'labelsConsumables', dbKey: 'consumables', label: 'Consumables', desc: 'Food, drinks, medical supplies' },
  { key: 'labelsShipMissiles', dbKey: 'ship_missiles', label: 'Ship Missiles', desc: 'Missiles and torpedoes' },
]

// Only fields with meaningful, varied data per category
const CATEGORY_FIELDS = {
  vehicle_components: ['manufacturer', 'size', 'grade', 'subType'],
  fps_weapons: ['manufacturer', 'size', 'subType'],
  fps_armour: ['manufacturer', 'subType'],
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

const EXAMPLE_DATA = {
  vehicle_components: { name: 'FullStop', manufacturer: 'GODI', size: 2, grade: 'C', subType: 'Cooler' },
  fps_weapons: { name: 'Demeco LMG', manufacturer: 'KRIG', size: 2, grade: null, subType: 'LMG' },
  fps_armour: { name: 'Morozov Core', manufacturer: 'AEGS', size: null, grade: null, subType: 'Torso' },
  fps_helmets: { name: 'Calva Helmet', manufacturer: 'AEGS', size: null, grade: 'A', subType: 'Heavy' },
  fps_attachments: { name: '4x Scope', manufacturer: 'KBAR', size: null, grade: null, subType: 'Sight' },
  fps_utilities: { name: 'ParaMed', manufacturer: 'CRUS', size: null, grade: null, subType: 'Medical' },
  consumables: { name: "Big Benny's", manufacturer: null, size: null, grade: null, subType: 'Food' },
  ship_missiles: { name: 'Dominator II', manufacturer: 'THRT', size: 3, grade: null, subType: 'CS' },
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildPreviewLabel(dbKey, fields, format) {
  const data = EXAMPLE_DATA[dbKey]
  if (!data) return '—'
  const parts = []
  for (const field of fields) {
    if (field === 'manufacturer' && data.manufacturer) parts.push(data.manufacturer)
    if (field === 'size' && data.size != null) parts.push(`S${data.size}`)
    if (field === 'grade' && data.grade) parts.push(`Gr.${data.grade}`)
    if (field === 'subType' && data.subType) parts.push(data.subType)
  }
  const tag = parts.join(' | ')
  if (!tag) return data.name
  return format === 'prefix' ? `[${tag}] ${data.name}` : `${data.name} [${tag}]`
}

// ── Collapsible Section ─────────────────────────────────────────────

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="panel">
      <button
        onClick={() => setOpen(!open)}
        className="panel-header flex items-center gap-2 w-full text-left cursor-pointer hover:text-gray-200 transition-colors"
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="flex-1">{title}</span>
        {badge && <span className="text-[10px] text-sc-accent/70 uppercase tracking-wider mr-2">{badge}</span>}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
      </button>
      {open && children}
    </div>
  )
}

// ── Toggle Switch ───────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-sc-accent' : 'bg-gray-700'}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-[2px] ${checked ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  )
}

// ── Category Field Config ───────────────────────────────────────────

function CategoryFieldConfig({ dbKey, catFormat, onChange }) {
  const available = CATEGORY_FIELDS[dbKey] || []
  const { fields, format } = catFormat
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const toggleField = (field) => {
    const next = fields.includes(field)
      ? fields.filter(f => f !== field)
      : [...fields, field]
    onChange({ ...catFormat, fields: next })
  }

  const setFormat = (fmt) => onChange({ ...catFormat, format: fmt })

  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(idx)
  }

  const handleDrop = (e, dropIdx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === dropIdx) return
    const next = [...fields]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(dropIdx, 0, moved)
    onChange({ ...catFormat, fields: next })
    setDragIdx(null)
    setOverIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setOverIdx(null)
  }

  const preview = buildPreviewLabel(dbKey, fields, format)
  const inactive = available.filter(f => !fields.includes(f))

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Live preview */}
      <div className="bg-black/40 rounded px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Preview</p>
        <p className="text-sm font-mono text-sc-accent">{preview}</p>
      </div>

      <div className="flex gap-4">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Position</p>
          <div className="flex gap-1">
            {[['suffix', 'Name [...]'], ['prefix', '[...] Name']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  format === key
                    ? 'bg-sc-accent/10 border-sc-accent/30 text-sc-accent'
                    : 'border-sc-border text-gray-400 hover:border-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active fields — drag to reorder */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Fields (drag to reorder, click eye to remove)</p>
        {fields.map((field, idx) => (
          <div
            key={field}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 bg-sc-accent/5 border rounded px-2.5 py-1.5 transition-all select-none ${
              dragIdx === idx ? 'opacity-40 border-sc-accent/40' :
              overIdx === idx && dragIdx !== null ? 'border-sc-accent border-t-2' :
              'border-sc-accent/20'
            }`}
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-500 shrink-0 cursor-grab active:cursor-grabbing" />
            <span className="text-xs text-gray-200 flex-1">{FIELD_LABELS[field]}</span>
            <button
              onClick={() => toggleField(field)}
              className="p-0.5 rounded hover:bg-red-500/20"
              title="Remove field"
            >
              <EyeOff className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
            </button>
          </div>
        ))}

        {/* Inactive fields */}
        {inactive.map(field => (
          <button
            key={field}
            onClick={() => toggleField(field)}
            className="flex items-center gap-2 w-full bg-black/20 border border-dashed border-sc-border rounded px-2.5 py-1.5 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs flex-1 text-left">{FIELD_LABELS[field]}</span>
            <span className="text-[10px]">click to add</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────

export default function LocalizationBuilder() {
  const { data: serverConfig, loading: configLoading, refetch: refetchConfig } = useLocalizationConfig()
  const { data: shipOrder, loading: orderLoading, refetch: refetchOrder } = useLocalizationShipOrder()
  const { data: fleet, loading: fleetLoading } = useFleet()

  const [localConfig, setLocalConfig] = useState(null)
  const [orderedShips, setOrderedShips] = useState([])
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [notification, setNotification] = useState(null)
  const [dirty, setDirty] = useState(false)

  const config = localConfig || serverConfig || {}

  // ── Fleet dedup ─────────────────────────────────────────────────
  const fleetVehicles = useMemo(() => {
    if (!fleet) return []
    const seen = new Set()
    return fleet.filter(f => {
      if (seen.has(f.vehicle_id)) return false
      seen.add(f.vehicle_id)
      return true
    }).map(f => ({
      vehicleId: f.vehicle_id,
      vehicleName: f.vehicle_name || f.name,
      customName: f.custom_name,
    }))
  }, [fleet])

  // ── Init ship order ─────────────────────────────────────────────
  useEffect(() => {
    if (orderLoading || fleetLoading) return
    if (shipOrder?.items?.length > 0) {
      setOrderedShips(shipOrder.items.map(item => ({
        vehicleId: item.vehicle_id,
        vehicleName: item.vehicle_name,
        customLabel: item.custom_label,
        sortPosition: item.sort_position,
      })))
    } else if (fleetVehicles.length > 0) {
      setOrderedShips(fleetVehicles.map((v, idx) => ({
        vehicleId: v.vehicleId,
        vehicleName: v.vehicleName,
        customLabel: v.customName || null,
        sortPosition: idx + 1,
      })))
    }
  }, [shipOrder, fleetVehicles, orderLoading, fleetLoading])

  // ── Notification ────────────────────────────────────────────────
  const showNotification = useCallback((msg, variant = 'info') => {
    setNotification({ msg, variant })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // ── Config helpers ──────────────────────────────────────────────
  const updateConfig = (patch) => {
    setLocalConfig(prev => ({ ...(prev || serverConfig || {}), ...patch }))
    setDirty(true)
  }

  const getCatFormat = (dbKey) => {
    const formats = config.categoryFormats || {}
    if (formats[dbKey]) return formats[dbKey]
    return { fields: [...(CATEGORY_FIELDS[dbKey] || [])], format: config.labelFormat || 'suffix' }
  }

  const updateCatFormat = (dbKey, fmt) => {
    const formats = { ...(config.categoryFormats || {}), [dbKey]: fmt }
    updateConfig({ categoryFormats: formats })
  }

  // ── Ship order helpers ──────────────────────────────────────────
  const moveShip = (idx, direction) => {
    const target = idx + direction
    if (target < 0 || target >= orderedShips.length) return
    const next = [...orderedShips]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    next.forEach((s, i) => { s.sortPosition = i + 1 })
    setOrderedShips(next)
    setDirty(true)
  }

  const removeShip = (idx) => {
    const next = orderedShips.filter((_, i) => i !== idx)
    next.forEach((s, i) => { s.sortPosition = i + 1 })
    setOrderedShips(next)
    setDirty(true)
  }

  // ── Save all ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      await saveLocalizationConfig(config)
      if (config.asopEnabled && orderedShips.length > 0) {
        await saveLocalizationShipOrder(
          orderedShips.map(s => ({
            vehicleId: s.vehicleId,
            sortPosition: s.sortPosition,
            customLabel: s.customLabel || null,
          }))
        )
        refetchOrder()
      }
      refetchConfig()
      setLocalConfig(null)
      setDirty(false)
      showNotification('Settings saved', 'success')
    } catch (e) {
      showNotification(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Download ────────────────────────────────────────────────────
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

  const hasAnyEnabled = config.asopEnabled || LABEL_CATEGORIES.some(c => config[c.key])
  const enabledCount = LABEL_CATEGORIES.filter(c => config[c.key]).length

  if (configLoading) {
    return <div className="flex items-center justify-center py-20"><Loader className="w-5 h-5 animate-spin text-sc-accent" /></div>
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Localization Builder"
        subtitle="Customize your Star Citizen global.ini"
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading || !hasAnyEnabled}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {downloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download
            </button>
          </div>
        }
      />

      {notification && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded text-sm ${
          notification.variant === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
          notification.variant === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>
          {notification.variant === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {notification.variant === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
          {notification.msg}
        </div>
      )}

      {/* ── ASOP Ordering ──────────────────────────────────────────── */}
      <CollapsibleSection
        title="ASOP Terminal Ship Order"
        icon={Rocket}
        defaultOpen={config.asopEnabled}
        badge={config.asopEnabled ? `${orderedShips.length} ships` : null}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Number your ships to control ASOP terminal sort order</p>
              <p className="text-xs text-gray-500 mt-0.5">Ships appear as "1. Carrack", "2. Idris-P", etc.</p>
            </div>
            <Toggle checked={config.asopEnabled || false} onChange={() => updateConfig({ asopEnabled: !config.asopEnabled })} />
          </div>

          {config.asopEnabled && (
            <>
              {orderedShips.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No fleet data. Import your fleet first.</p>
              ) : (
                <>
                  {/* Preview */}
                  <div className="bg-black/40 rounded px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">ASOP Preview</p>
                    <div className="font-mono text-sm space-y-0.5">
                      {orderedShips.slice(0, 5).map((ship, idx) => (
                        <div key={idx} className="text-gray-300">
                          <span className="text-sc-accent">{ship.sortPosition}.</span> {ship.customLabel || ship.vehicleName}
                        </div>
                      ))}
                      {orderedShips.length > 5 && <div className="text-gray-500">... +{orderedShips.length - 5} more</div>}
                    </div>
                  </div>

                  {/* Ship list */}
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {orderedShips.map((ship, idx) => (
                      <div key={`${ship.vehicleId}-${idx}`} className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/20 border border-sc-border hover:border-sc-accent/30 transition-colors group">
                        <span className="text-sc-accent font-mono text-xs w-6 text-right shrink-0">{ship.sortPosition}.</span>
                        <GripVertical className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                        <span className="text-xs text-gray-200 flex-1 truncate">{ship.customLabel || ship.vehicleName}</span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveShip(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20">
                            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button onClick={() => moveShip(idx, 1)} disabled={idx === orderedShips.length - 1} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20">
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button onClick={() => removeShip(idx)} className="p-0.5 rounded hover:bg-red-500/20">
                            <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Item Labels ────────────────────────────────────────────── */}
      <CollapsibleSection
        title="Item Labels"
        icon={Tags}
        defaultOpen={enabledCount > 0}
        badge={enabledCount > 0 ? `${enabledCount} categories` : null}
      >
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-400 mb-3">
            Add metadata to item names in-game. Configure each category independently.
          </p>

          {LABEL_CATEGORIES.map(cat => {
            const enabled = config[cat.key] || false
            const catFormat = getCatFormat(cat.dbKey)
            return (
              <div key={cat.key}>
                {/* Category header with toggle */}
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 border transition-colors ${
                    enabled
                      ? 'bg-sc-accent/5 border-sc-accent/30 rounded-t'
                      : 'bg-black/20 border-sc-border hover:border-gray-600 rounded'
                  }`}
                >
                  <Toggle checked={enabled} onChange={() => updateConfig({ [cat.key]: !enabled })} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-200">{cat.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.desc}</p>
                  </div>
                  {enabled && (
                    <span className="text-xs font-mono text-sc-accent/80 shrink-0">
                      {buildPreviewLabel(cat.dbKey, catFormat.fields, catFormat.format)}
                    </span>
                  )}
                </div>

                {/* Expanded config */}
                {enabled && (
                  <div className="border border-t-0 border-sc-accent/20 rounded-b bg-black/10 pt-3">
                    <CategoryFieldConfig
                      dbKey={cat.dbKey}
                      catFormat={catFormat}
                      onChange={(fmt) => updateCatFormat(cat.dbKey, fmt)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CollapsibleSection>

      {/* ── Installation ───────────────────────────────────────────── */}
      <CollapsibleSection title="Installation Instructions" icon={Languages}>
        <div className="p-4 text-sm text-gray-400 space-y-3">
          <p>After downloading, place <code className="text-gray-300 bg-white/5 px-1.5 py-0.5 rounded">global.ini</code> in your Star Citizen folder:</p>
          <pre className="bg-black/30 rounded p-3 text-xs text-gray-300 overflow-x-auto">
{`StarCitizen/
└── LIVE/           (or PTU/ or EPTU/)
    ├── user.cfg
    └── data/
        └── Localization/
            └── english/
                └── global.ini   ← place file here`}
          </pre>
          <p>If <code className="text-gray-300 bg-white/5 px-1.5 py-0.5 rounded">user.cfg</code> doesn't exist, create it with:</p>
          <pre className="bg-black/30 rounded p-3 text-xs text-gray-300">g_language = english</pre>
          <p className="text-yellow-400/80 text-xs">Game updates overwrite global.ini — re-download after each patch.</p>
        </div>
      </CollapsibleSection>

      {/* Floating save bar when dirty */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-black/50 disabled:opacity-50">
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Changes
          </button>
        </div>
      )}
    </div>
  )
}
