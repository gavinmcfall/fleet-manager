import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { RotateCcw, ShoppingCart, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useLoadoutComponents, useFleetLoadout, useLoadoutCart, saveFleetLoadout, resetFleetLoadout, addToLoadoutCart } from '../../hooks/useAPI'
import useGameVersion from '../../hooks/useGameVersion'
import LoadingState from '../../components/LoadingState'
import ComponentPicker from './ComponentPicker'
import StatsPanel from './StatsPanel'
import CartPanel from './CartPanel'
import { PORT_TYPE_ICONS, PORT_TYPE_LABELS, PORT_CATEGORY_ORDER, getPortCategory, getPrimaryStat } from './loadoutHelpers'

export default function Loadout() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const fleetId = searchParams.get('fleet_id') ? parseInt(searchParams.get('fleet_id'), 10) : null
  const { activeCode } = useGameVersion()

  // Stock loadout for this ship
  const { data: stockComponents, loading: stockLoading, error: stockError } = useLoadoutComponents(slug)
  // User's custom overrides for fleet ship
  const { data: fleetLoadout, loading: fleetLoading, refetch: refetchFleetLoadout } = useFleetLoadout(fleetId)
  // Shopping cart
  const { data: cartData, loading: cartLoading, refetch: refetchCart } = useLoadoutCart()

  // Local state: overrides keyed by port_id → component data
  const [overrides, setOverrides] = useState({})
  // Component picker state
  const [pickerPortId, setPickerPortId] = useState(null)
  const [pickerPortType, setPickerPortType] = useState(null)
  // Collapsed categories
  const [collapsed, setCollapsed] = useState({})
  // Show cart
  const [showCart, setShowCart] = useState(false)

  // Hydrate overrides from fleet loadout
  useEffect(() => {
    if (fleetLoadout?.overrides) {
      const map = {}
      for (const o of fleetLoadout.overrides) {
        map[o.port_id] = o
      }
      setOverrides(map)
    }
  }, [fleetLoadout])

  // Group stock components by category
  const grouped = useMemo(() => {
    if (!stockComponents) return []
    const groups = {}
    for (const comp of stockComponents) {
      const cat = getPortCategory(comp.port_type, comp.category_label)
      if (!groups[cat]) groups[cat] = { label: cat, items: [] }
      groups[cat].items.push(comp)
    }
    return PORT_CATEGORY_ORDER
      .filter(cat => groups[cat])
      .map(cat => groups[cat])
  }, [stockComponents])

  // Build effective loadout (stock merged with overrides)
  const effectiveLoadout = useMemo(() => {
    if (!stockComponents) return []
    return stockComponents.map(comp => {
      const override = overrides[comp.port_id]
      if (override) {
        return { ...comp, component_name: override.component_name, component_uuid: override.component_uuid, is_overridden: true, override_data: override }
      }
      return { ...comp, is_overridden: false }
    })
  }, [stockComponents, overrides])

  // Handle component selection from picker
  const handleSelectComponent = useCallback(async (portId, component) => {
    // Find the stock component for this port
    const stockComp = stockComponents?.find(c => c.port_id === portId)
    const isResetToStock = stockComp && component.uuid === stockComp.component_uuid

    if (isResetToStock) {
      // Remove override
      setOverrides(prev => {
        const next = { ...prev }
        delete next[portId]
        return next
      })
    } else {
      // Set override
      setOverrides(prev => ({
        ...prev,
        [portId]: {
          port_id: portId,
          component_id: component.id,
          component_name: component.name,
          component_uuid: component.uuid,
          type: component.type,
          size: component.size,
          grade: component.grade,
          manufacturer_name: component.manufacturer_name,
          // Carry through stats for the stats panel
          power_output: component.power_output,
          cooling_rate: component.cooling_rate,
          shield_hp: component.shield_hp,
          shield_regen: component.shield_regen,
          dps: component.dps,
          quantum_speed: component.quantum_speed,
          quantum_range: component.quantum_range,
          fuel_rate: component.fuel_rate,
          spool_time: component.spool_time,
          radar_range: component.radar_range,
          power_draw: component.power_draw,
          thermal_output: component.thermal_output,
          resist_physical: component.resist_physical,
          resist_energy: component.resist_energy,
          resist_distortion: component.resist_distortion,
        },
      }))
    }
    setPickerPortId(null)
  }, [stockComponents])

  // Save to DB (fleet ships only)
  const handleSave = useCallback(async () => {
    if (!fleetId) return
    const overrideList = Object.entries(overrides).map(([portId, data]) => ({
      port_id: parseInt(portId, 10),
      component_id: data.component_id,
    }))
    await saveFleetLoadout(fleetId, overrideList)
    refetchFleetLoadout()
  }, [fleetId, overrides, refetchFleetLoadout])

  // Reset all to stock
  const handleResetAll = useCallback(async () => {
    setOverrides({})
    if (fleetId) {
      await resetFleetLoadout(fleetId)
      refetchFleetLoadout()
    }
  }, [fleetId, refetchFleetLoadout])

  // Add all non-stock to cart
  const handleAddAllToCart = useCallback(async () => {
    const items = Object.values(overrides).map(o => ({
      component_id: o.component_id,
      source_fleet_id: fleetId || undefined,
    }))
    if (items.length === 0) return
    await addToLoadoutCart(items)
    refetchCart()
    setShowCart(true)
  }, [overrides, fleetId, refetchCart])

  const toggleCategory = (cat) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const overrideCount = Object.keys(overrides).length
  const cartCount = cartData?.items?.length || 0

  if (stockLoading) return <LoadingState />
  if (stockError) return <div className="p-6 text-red-400">Error loading ship data: {stockError}</div>
  if (!stockComponents || stockComponents.length === 0) {
    return <div className="p-6 text-zinc-400">No component data found for this ship. Component data may not be available yet.</div>
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Loadout Builder</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              <Link to={`/ships/${slug}`} className="text-sky-400 hover:text-sky-300">{slug}</Link>
              {fleetId && <span className="ml-2 text-xs bg-sky-900/40 text-sky-300 px-2 py-0.5 rounded">Fleet Ship</span>}
              {overrideCount > 0 && <span className="ml-2 text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">{overrideCount} customized</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {fleetId && overrideCount > 0 && (
              <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors">
                Save Loadout
              </button>
            )}
            {overrideCount > 0 && (
              <>
                <button onClick={handleAddAllToCart} className="px-3 py-1.5 text-sm bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Add All to Cart
                </button>
                <button onClick={handleResetAll} className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset All
                </button>
              </>
            )}
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-0">
        {/* Left: Component slots */}
        <div className="flex-1 min-w-0 border-r border-zinc-700/30">
          <div className="p-4 space-y-1">
            {grouped.map(group => {
              const isCollapsed = collapsed[group.label]
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleCategory(group.label)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 rounded transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    <span className="uppercase tracking-wider text-xs">{group.label}</span>
                    <span className="text-[10px] text-zinc-500 ml-1">({group.items.length})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5 ml-2">
                      {group.items.map(item => {
                        const override = overrides[item.port_id]
                        const displayName = override ? override.component_name : item.component_name
                        const isOverridden = !!override
                        const Icon = PORT_TYPE_ICONS[item.port_type]
                        const primaryStat = getPrimaryStat(item, override)

                        return (
                          <button
                            key={item.port_id}
                            onClick={() => {
                              setPickerPortId(item.port_id)
                              setPickerPortType(item.port_type)
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-colors group
                              ${isOverridden ? 'bg-sky-950/30 hover:bg-sky-950/50 border border-sky-800/30' : 'hover:bg-zinc-800/50 border border-transparent'}`}
                          >
                            <div className="flex-shrink-0 w-5 h-5 text-zinc-500 group-hover:text-zinc-300">
                              {Icon && <Icon className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm truncate ${isOverridden ? 'text-sky-300 font-medium' : 'text-zinc-200'}`}>
                                  {displayName || 'Empty'}
                                </span>
                                {isOverridden && <span className="text-[10px] text-sky-400 bg-sky-900/30 px-1 rounded">Custom</span>}
                                {!isOverridden && item.component_name && <span className="text-[10px] text-zinc-600">Stock</span>}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                <span>S{item.size_min === item.size_max ? item.size_min : `${item.size_min}-${item.size_max}`}</span>
                                {item.grade && <span>Grade {item.grade}</span>}
                                {primaryStat && <span className="text-zinc-400">{primaryStat}</span>}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Stats panel */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <StatsPanel
            stockComponents={stockComponents}
            overrides={overrides}
            slug={slug}
          />
        </div>
      </div>

      {/* Component Picker Modal */}
      {pickerPortId && (
        <ComponentPicker
          slug={slug}
          portId={pickerPortId}
          portType={pickerPortType}
          currentOverride={overrides[pickerPortId]}
          stockComponent={stockComponents?.find(c => c.port_id === pickerPortId)}
          onSelect={(comp) => handleSelectComponent(pickerPortId, comp)}
          onAddToCart={async (comp) => {
            await addToLoadoutCart([{ component_id: comp.id, source_fleet_id: fleetId || undefined }])
            refetchCart()
          }}
          onClose={() => setPickerPortId(null)}
        />
      )}

      {/* Cart Panel */}
      {showCart && (
        <CartPanel
          cartData={cartData}
          cartLoading={cartLoading}
          refetchCart={refetchCart}
          onClose={() => setShowCart(false)}
        />
      )}
    </div>
  )
}
