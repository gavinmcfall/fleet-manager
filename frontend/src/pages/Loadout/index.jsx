import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { RotateCcw, ShoppingCart, ChevronDown, ChevronRight, Star } from 'lucide-react'
import { useShip, useLoadoutComponents, useFleetLoadout, useLoadoutCart, saveFleetLoadout, resetFleetLoadout, addToLoadoutCart } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ShipImage from '../../components/ShipImage'
import ComponentPicker from './ComponentPicker'
import StatsPanel from './StatsPanel'
import CartPanel from './CartPanel'
import { PORT_TYPE_ICONS, PORT_CATEGORY_ORDER, getPortCategory, getPrimaryStat } from './loadoutHelpers'

export default function Loadout() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const fleetId = searchParams.get('fleet_id') ? parseInt(searchParams.get('fleet_id'), 10) : null

  const { data: ship } = useShip(slug)
  const { data: stockComponents, loading: stockLoading, error: stockError } = useLoadoutComponents(slug)
  const { data: fleetLoadout, refetch: refetchFleetLoadout } = useFleetLoadout(fleetId)
  const { data: cartData, loading: cartLoading, refetch: refetchCart } = useLoadoutCart()

  const [overrides, setOverrides] = useState({})
  const [pickerPortId, setPickerPortId] = useState(null)
  const [pickerPortType, setPickerPortType] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    if (fleetLoadout?.overrides) {
      const map = {}
      for (const o of fleetLoadout.overrides) map[o.port_id] = o
      setOverrides(map)
    }
  }, [fleetLoadout])

  const grouped = useMemo(() => {
    if (!stockComponents) return []
    const groups = {}
    for (const comp of stockComponents) {
      const cat = getPortCategory(comp.port_type, comp.category_label)
      if (!groups[cat]) groups[cat] = { label: cat, portType: comp.port_type, items: [] }
      groups[cat].items.push(comp)
    }
    return PORT_CATEGORY_ORDER.filter(cat => groups[cat]).map(cat => groups[cat])
  }, [stockComponents])

  const handleSelectComponent = useCallback(async (portId, component) => {
    const stockComp = stockComponents?.find(c => c.port_id === portId)
    const isResetToStock = stockComp && component.uuid === stockComp.component_uuid
    if (isResetToStock) {
      setOverrides(prev => { const next = { ...prev }; delete next[portId]; return next })
    } else {
      setOverrides(prev => ({
        ...prev,
        [portId]: {
          port_id: portId, component_id: component.id,
          component_name: component.name, component_uuid: component.uuid,
          type: component.type, size: component.size, grade: component.grade,
          manufacturer_name: component.manufacturer_name,
          power_output: component.power_output, cooling_rate: component.cooling_rate,
          shield_hp: component.shield_hp, shield_regen: component.shield_regen,
          dps: component.dps, damage_per_shot: component.damage_per_shot,
          damage_type: component.damage_type,
          quantum_speed: component.quantum_speed, quantum_range: component.quantum_range,
          fuel_rate: component.fuel_rate, spool_time: component.spool_time,
          radar_range: component.radar_range, power_draw: component.power_draw,
          thermal_output: component.thermal_output,
          resist_physical: component.resist_physical, resist_energy: component.resist_energy,
          resist_distortion: component.resist_distortion,
        },
      }))
    }
    setPickerPortId(null)
  }, [stockComponents])

  const handleSave = useCallback(async () => {
    if (!fleetId) return
    const overrideList = Object.entries(overrides).map(([portId, data]) => ({
      port_id: parseInt(portId, 10), component_id: data.component_id,
    }))
    await saveFleetLoadout(fleetId, overrideList)
    refetchFleetLoadout()
  }, [fleetId, overrides, refetchFleetLoadout])

  const handleResetAll = useCallback(async () => {
    setOverrides({})
    if (fleetId) { await resetFleetLoadout(fleetId); refetchFleetLoadout() }
  }, [fleetId, refetchFleetLoadout])

  const handleResetCategory = useCallback((items) => {
    setOverrides(prev => {
      const next = { ...prev }
      for (const item of items) delete next[item.port_id]
      return next
    })
  }, [])

  const handleAddAllToCart = useCallback(async () => {
    const items = Object.values(overrides).map(o => ({ component_id: o.component_id, source_fleet_id: fleetId || undefined }))
    if (items.length === 0) return
    await addToLoadoutCart(items)
    refetchCart()
    setShowCart(true)
  }, [overrides, fleetId, refetchCart])

  const overrideCount = Object.keys(overrides).length
  const cartCount = cartData?.items?.length || 0

  if (stockLoading) return <LoadingState />
  if (stockError) return <div className="p-6 text-red-400">Error: {stockError}</div>
  if (!stockComponents?.length) return <div className="p-6 text-gray-500">No component data found for this ship.</div>

  return (
    <div className="min-h-screen animate-fade-in-up">
      {/* Ship Info Header — HUD style */}
      <div className="relative bg-white/[0.03] backdrop-blur-md border-b border-white/[0.06] px-6 py-4">
        {/* HUD corner brackets */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-sc-accent/20 rounded-tl-lg" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-sc-accent/20 rounded-tr-lg" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-sc-accent/20 rounded-bl-lg" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-sc-accent/20 rounded-br-lg" />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-36 h-20 rounded-lg overflow-hidden border border-white/[0.08]">
            <ShipImage
              src={ship?.image_url_small}
              fallbackSrc={ship?.image_url_medium || ship?.image_url}
              alt={ship?.name || slug}
              aspectRatio="landscape"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
                {ship?.name || slug}
              </h1>
              {fleetId && (
                <span className="text-[10px] bg-sc-accent/10 text-sc-accent px-1.5 py-0.5 rounded border border-sc-accent/20 font-medium">
                  Fleet Ship
                </span>
              )}
              {overrideCount > 0 && (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                  {overrideCount} customized
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {ship?.manufacturer_name && <span className="text-gray-400">{ship.manufacturer_name}</span>}
              {ship?.focus && <span> · {ship.focus}</span>}
              {ship?.size_label && <span> · {ship.size_label}</span>}
              {ship?.crew_min != null && <span> · Crew {ship.crew_min}{ship.crew_max > ship.crew_min ? `–${ship.crew_max}` : ''}</span>}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {fleetId && overrideCount > 0 && (
                <button onClick={handleSave} className="px-2.5 py-1 text-xs bg-sc-accent/20 hover:bg-sc-accent/30 text-sc-accent border border-sc-accent/30 rounded transition-all duration-200 font-medium">
                  Save Loadout
                </button>
              )}
              {overrideCount > 0 && (
                <>
                  <button onClick={handleAddAllToCart} className="px-2.5 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all duration-200 flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" /> Add All to Cart
                  </button>
                  <button onClick={handleResetAll} className="px-2.5 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 border border-white/[0.06] rounded transition-all duration-200 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </>
              )}
              <button
                onClick={() => setShowCart(!showCart)}
                className="relative px-2.5 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 border border-white/[0.06] rounded transition-all duration-200 flex items-center gap-1"
              >
                <ShoppingCart className="w-3 h-3" /> Cart
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-sc-accent text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-[0_0_6px_rgba(34,211,238,0.5)]">
                    {cartCount}
                  </span>
                )}
              </button>
              <Link to={`/ships/${slug}`} className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-300 transition-colors">
                Ship Detail →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Panel — horizontal across top */}
      <StatsPanel stockComponents={stockComponents} overrides={overrides} horizontal />

      {/* Component Slots — masonry flow */}
      <div className="p-3" style={{ columns: 'auto 280px', columnGap: '12px' }}>
          {grouped.map(group => {
            const isCollapsed = collapsed[group.label]
            const categoryOverrides = group.items.filter(i => overrides[i.port_id]).length
            return (
              <div key={group.label} className="bg-white/[0.02] border border-white/[0.05] rounded-lg overflow-hidden mb-3" style={{ breakInside: 'avoid' }}>
                {/* Category header */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.06]">
                  <button
                    onClick={() => setCollapsed(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{group.label}</span>
                  </button>
                  <span className="text-[10px] text-gray-600">{group.items.length}</span>
                  {categoryOverrides > 0 && (
                    <>
                      <span className="text-[10px] text-sc-accent ml-1" style={{ textShadow: '0 0 8px rgba(34,211,238,0.3)' }}>
                        {categoryOverrides} custom
                      </span>
                      <button
                        onClick={() => handleResetCategory(group.items)}
                        className="text-[10px] text-gray-600 hover:text-gray-400 ml-auto transition-colors"
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>

                {/* Slot cards */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/[0.04]">
                    {group.items.map(item => {
                      const override = overrides[item.port_id]
                      const isOverridden = !!override
                      const hasChild = !!(item.mount_name && item.child_name)
                      const Icon = PORT_TYPE_ICONS[item.port_type]
                      const primaryStat = getPrimaryStat(item, override)
                      const sz = item.component_size || item.size_max

                      // Parent-child hierarchy: mount + weapon as two rows
                      if (hasChild) {
                        const mountName = item.mount_name
                        const weaponName = override?.component_name || item.child_name
                        return (
                          <div key={item.port_id} className="border-l-2 border-l-transparent">
                            {/* Mount row (parent) */}
                            <button
                              onClick={() => { setPickerPortId(item.port_id); setPickerPortType(item.port_type) }}
                              className="w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
                            >
                              <span className="badge badge-size text-[9px] w-6 text-center flex-shrink-0">S{item.size_max}</span>
                              {Icon && <Icon className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                              <span className="text-xs text-gray-500 truncate flex-1">{mountName}</span>
                            </button>
                            {/* Weapon row (child, indented) */}
                            <button
                              onClick={() => { setPickerPortId(item.port_id); setPickerPortType(item.port_type) }}
                              className={`w-full flex items-center gap-2 pl-10 pr-3 py-1.5 text-left transition-all duration-200 cursor-pointer
                                ${isOverridden ? 'bg-sc-accent/[0.06] hover:bg-sc-accent/[0.1]' : 'hover:bg-white/[0.03]'}`}
                            >
                              <span className="badge badge-size text-[9px] w-6 text-center flex-shrink-0">S{sz}</span>
                              <span className={`text-xs truncate flex-1 ${isOverridden ? 'text-sc-accent font-medium' : 'text-gray-300'}`}
                                style={isOverridden ? { textShadow: '0 0 8px rgba(34,211,238,0.3)' } : undefined}>
                                {weaponName}
                              </span>
                              {primaryStat && (
                                <span className="text-[11px] font-mono text-gray-500 flex-shrink-0 tabular-nums">{primaryStat}</span>
                              )}
                            </button>
                          </div>
                        )
                      }

                      // Simple row (no parent-child)
                      const displayName = override?.component_name || item.component_name
                      return (
                        <button
                          key={item.port_id}
                          onClick={() => { setPickerPortId(item.port_id); setPickerPortType(item.port_type) }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all duration-200 cursor-pointer
                            ${isOverridden
                              ? 'bg-sc-accent/[0.06] border-l-2 border-l-sc-accent/60 hover:bg-sc-accent/[0.1]'
                              : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}
                        >
                          <span className="badge badge-size text-[9px] w-6 text-center flex-shrink-0">S{sz}</span>
                          {Icon && <Icon className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                          <span className={`text-xs truncate flex-1 ${isOverridden ? 'text-sc-accent font-medium' : 'text-gray-300'}`}
                            style={isOverridden ? { textShadow: '0 0 8px rgba(34,211,238,0.3)' } : undefined}>
                            {displayName || 'Empty'}
                          </span>
                          {primaryStat && (
                            <span className="text-[11px] font-mono text-gray-500 flex-shrink-0 tabular-nums">{primaryStat}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {pickerPortId && (
        <ComponentPicker
          slug={slug} portId={pickerPortId} portType={pickerPortType}
          currentOverride={overrides[pickerPortId]}
          stockComponent={stockComponents?.find(c => c.port_id === pickerPortId)}
          onSelect={(comp) => handleSelectComponent(pickerPortId, comp)}
          onAddToCart={async (comp) => { await addToLoadoutCart([{ component_id: comp.id, source_fleet_id: fleetId || undefined }]); refetchCart() }}
          onClose={() => setPickerPortId(null)}
        />
      )}

      {showCart && (
        <CartPanel cartData={cartData} cartLoading={cartLoading} refetchCart={refetchCart} onClose={() => setShowCart(false)} />
      )}
    </div>
  )
}
