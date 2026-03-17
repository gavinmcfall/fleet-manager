import React, { useState, useEffect, useMemo } from 'react'
import { ChevronUp, ChevronDown, Rocket, Save, Loader, GripVertical, X } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import { saveLocalizationConfig, saveLocalizationShipOrder } from '../../hooks/useAPI'

export default function AsopOrderTab({
  config, shipOrder, fleet, loading, saving, setSaving,
  showNotification, refetchConfig, refetchOrder, refetchPreview,
}) {
  // Build ordered list from saved order + fleet
  const [orderedShips, setOrderedShips] = useState([])
  const [dirty, setDirty] = useState(false)

  // Get unique vehicles from user's fleet (deduplicate by vehicle_id, keep first)
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
      imageUrl: f.image_url,
      manufacturerCode: f.manufacturer_code,
    }))
  }, [fleet])

  // Initialize order from saved data or fleet
  useEffect(() => {
    if (loading) return
    if (shipOrder?.items?.length > 0) {
      setOrderedShips(shipOrder.items.map((item, idx) => ({
        vehicleId: item.vehicle_id,
        vehicleName: item.vehicle_name,
        customLabel: item.custom_label,
        sortPosition: item.sort_position,
        className: item.class_name,
      })))
    } else if (fleetVehicles.length > 0) {
      // Default: fleet order
      setOrderedShips(fleetVehicles.map((v, idx) => ({
        vehicleId: v.vehicleId,
        vehicleName: v.vehicleName,
        customLabel: v.customName || null,
        sortPosition: idx + 1,
      })))
    }
  }, [shipOrder, fleetVehicles, loading])

  const moveUp = (idx) => {
    if (idx === 0) return
    const next = [...orderedShips]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    next.forEach((s, i) => { s.sortPosition = i + 1 })
    setOrderedShips(next)
    setDirty(true)
  }

  const moveDown = (idx) => {
    if (idx === orderedShips.length - 1) return
    const next = [...orderedShips]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
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

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save the order
      await saveLocalizationShipOrder(
        orderedShips.map(s => ({
          vehicleId: s.vehicleId,
          sortPosition: s.sortPosition,
          customLabel: s.customLabel || null,
        }))
      )

      // Enable ASOP if not already
      if (!config?.asopEnabled) {
        await saveLocalizationConfig({ ...config, asopEnabled: true })
        refetchConfig()
      }

      refetchOrder()
      refetchPreview()
      setDirty(false)
      showNotification('ASOP order saved', 'success')
    } catch (e) {
      showNotification(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async () => {
    setSaving(true)
    try {
      await saveLocalizationConfig({ ...config, asopEnabled: !config?.asopEnabled })
      refetchConfig()
      refetchPreview()
      showNotification(config?.asopEnabled ? 'ASOP ordering disabled' : 'ASOP ordering enabled', 'success')
    } catch (e) {
      showNotification(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader className="w-5 h-5 animate-spin text-sc-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PanelSection title="ASOP Terminal Ship Order" icon={Rocket}>
        <div className="p-4 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Number your ships to control ASOP terminal display order</p>
              <p className="text-xs text-gray-500 mt-1">Ships will appear as "1. Carrack", "2. Idris-P", etc.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.asopEnabled || false}
                onChange={toggleEnabled}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sc-accent" />
            </label>
          </div>

          {config?.asopEnabled && (
            <>
              {orderedShips.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No fleet data. Import your fleet first to set ASOP order.
                </p>
              ) : (
                <>
                  {/* Ship list */}
                  <div className="space-y-1">
                    {orderedShips.map((ship, idx) => (
                      <div
                        key={`${ship.vehicleId}-${idx}`}
                        className="flex items-center gap-3 px-3 py-2 rounded bg-black/20 border border-sc-border hover:border-sc-accent/30 transition-colors group"
                      >
                        <span className="text-sc-accent font-mono text-sm w-8 text-right">
                          {ship.sortPosition}.
                        </span>
                        <GripVertical className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-200 flex-1 truncate">
                          {ship.customLabel || ship.vehicleName}
                        </span>
                        {ship.customLabel && (
                          <span className="text-xs text-gray-500 truncate max-w-32">
                            ({ship.vehicleName})
                          </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveUp(idx)}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button
                            onClick={() => moveDown(idx)}
                            disabled={idx === orderedShips.length - 1}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button
                            onClick={() => removeShip(idx)}
                            className="p-1 rounded hover:bg-red-500/20"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSave}
                      disabled={saving || !dirty}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Order
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </PanelSection>

      {/* Preview */}
      {config?.asopEnabled && orderedShips.length > 0 && (
        <PanelSection title="Preview">
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3">How your ships will appear in the ASOP terminal:</p>
            <div className="bg-black/40 rounded p-3 space-y-1 font-mono text-sm">
              {orderedShips.slice(0, 10).map((ship, idx) => (
                <div key={idx} className="text-gray-300">
                  <span className="text-sc-accent">{ship.sortPosition}.</span>{' '}
                  {ship.customLabel || ship.vehicleName}
                </div>
              ))}
              {orderedShips.length > 10 && (
                <div className="text-gray-500">... and {orderedShips.length - 10} more</div>
              )}
            </div>
          </div>
        </PanelSection>
      )}
    </div>
  )
}
