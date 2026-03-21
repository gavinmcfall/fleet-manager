import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { RotateCcw, ShoppingCart, ChevronDown, ChevronRight, Star } from 'lucide-react'
import { useShip, useLoadoutComponents, useFleetLoadout, useLoadoutCart, saveFleetLoadout, resetFleetLoadout, addToLoadoutCart } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ShipImage from '../../components/ShipImage'
import ComponentPicker from './ComponentPicker'
import StatsPanel from './StatsPanel'
import CartPanel from './CartPanel'
import { PORT_TYPE_ICONS, PORT_TYPE_LABELS, PORT_CATEGORY_ORDER, getPortCategory, getPrimaryStat } from './loadoutHelpers'

export default function Loadout() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const fleetId = searchParams.get('fleet_id') ? parseInt(searchParams.get('fleet_id'), 10) : null

  // Ship info
  const { data: ship } = useShip(slug)
  // Stock loadout for this ship
  const { data: stockComponents, loading: stockLoading, error: stockError } = useLoadoutComponents(slug)
  // User's custom overrides for fleet ship
  const { data: fleetLoadout, refetch: refetchFleetLoadout } = useFleetLoadout(fleetId)
  // Shopping cart
  const { data: cartData, loading: cartLoading, refetch: refetchCart } = useLoadoutCart()

  const [overrides, setOverrides] = useState({})
  const [pickerPortId, setPickerPortId] = useState(null)
  const [pickerPortType, setPickerPortType] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [showCart, setShowCart] = useState(false)

  // Hydrate overrides from fleet loadout
  useEffect(() => {
    if (fleetLoadout?.overrides) {
      const map = {}
      for (const o of fleetLoadout.overrides) map[o.port_id] = o
      setOverrides(map)
    }
  }, [fleetLoadout])

  // Group stock components by category
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
  if (stockError) return <div className="p-6 text-red-400">Error loading ship data: {stockError}</div>
  if (!stockComponents?.length) return <div className="p-6 text-zinc-400">No component data found for this ship.</div>

  return (
    <div className="min-h-screen animate-fade-in-up">
      {/* Ship Info Header */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/60 px-6 py-4">
        <div className="flex items-start gap-4">
          {/* Ship Image */}
          <div className="flex-shrink-0 w-36 h-20 rounded overflow-hidden border border-zinc-700/50">
            <ShipImage
              src={ship?.image_url_small}
              fallbackSrc={ship?.image_url_medium || ship?.image_url}
              alt={ship?.name || slug}
              aspectRatio="landscape"
            />
          </div>
          {/* Ship Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-100">{ship?.name || slug}</h1>
              {fleetId && <span className="text-[10px] bg-sky-900/40 text-sky-300 px-1.5 py-0.5 rounded font-medium">Fleet Ship</span>}
              {overrideCount > 0 && <span className="text-[10px] bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded font-medium">{overrideCount} customized</span>}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {ship?.manufacturer_name && <span className="text-zinc-400">{ship.manufacturer_name}</span>}
              {ship?.focus && <span> · {ship.focus}</span>}
              {ship?.size_label && <span> · {ship.size_label}</span>}
              {ship?.crew_min != null && <span> · Crew {ship.crew_min}{ship.crew_max > ship.crew_min ? `–${ship.crew_max}` : ''}</span>}
            </p>
            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-2">
              {fleetId && overrideCount > 0 && (
                <button onClick={handleSave} className="px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors font-medium">
                  Save Loadout
                </button>
              )}
              {overrideCount > 0 && (
                <>
                  <button onClick={handleAddAllToCart} className="px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" /> Add All to Cart
                  </button>
                  <button onClick={handleResetAll} className="px-2.5 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </>
              )}
              <button
                onClick={() => setShowCart(!showCart)}
                className="relative px-2.5 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors flex items-center gap-1"
              >
                <ShoppingCart className="w-3 h-3" /> Cart
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>
                )}
              </button>
              <Link to={`/ships/${slug}`} className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Ship Detail →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Left: Component Slots */}
        <div className="flex-1 min-w-0 border-r border-zinc-700/30">
          <div className="p-3 space-y-0.5">
            {grouped.map(group => {
              const isCollapsed = collapsed[group.label]
              const categoryOverrides = group.items.filter(i => overrides[i.port_id]).length
              return (
                <div key={group.label}>
                  {/* Category header */}
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <button
                      onClick={() => setCollapsed(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span className="text-[11px] font-semibold uppercase tracking-wider">{group.label}</span>
                    </button>
                    <span className="text-[10px] text-zinc-600">{group.items.length}</span>
                    {categoryOverrides > 0 && (
                      <>
                        <span className="text-[10px] text-sky-400 ml-1">{categoryOverrides} custom</span>
                        <button
                          onClick={() => handleResetCategory(group.items)}
                          className="text-[10px] text-zinc-600 hover:text-zinc-400 ml-auto transition-colors"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>

                  {/* Slot cards */}
                  {!isCollapsed && (
                    <div className="space-y-px ml-1">
                      {group.items.map(item => {
                        const override = overrides[item.port_id]
                        const displayName = override?.component_name || item.component_name
                        const displayMfr = override?.manufacturer_name || item.manufacturer_name
                        const isOverridden = !!override
                        const Icon = PORT_TYPE_ICONS[item.port_type]
                        const primaryStat = getPrimaryStat(item, override)
                        const sz = item.component_size || item.size_max

                        return (
                          <button
                            key={item.port_id}
                            onClick={() => { setPickerPortId(item.port_id); setPickerPortType(item.port_type) }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-left transition-colors cursor-pointer group
                              ${isOverridden
                                ? 'bg-sky-950/25 border-l-2 border-l-sky-500 hover:bg-sky-950/40'
                                : 'border-l-2 border-l-transparent hover:bg-zinc-800/40'}`}
                          >
                            {/* Size badge */}
                            <span className="badge badge-size text-[10px] w-7 text-center flex-shrink-0">S{sz}</span>

                            {/* Icon */}
                            {Icon && <Icon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}

                            {/* Name + manufacturer */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-sm truncate ${isOverridden ? 'text-sky-300 font-medium' : 'text-zinc-200'}`}>
                                  {displayName || 'Empty'}
                                </span>
                                {isOverridden && <Star className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                              </div>
                              {displayMfr && (
                                <span className="text-[10px] text-zinc-600 block truncate">{displayMfr}</span>
                              )}
                            </div>

                            {/* Primary stat */}
                            {primaryStat && (
                              <span className="text-xs font-mono text-zinc-400 flex-shrink-0 tabular-nums">
                                {primaryStat}
                              </span>
                            )}

                            {/* Grade */}
                            {item.grade && (
                              <span className="text-[10px] text-zinc-600 flex-shrink-0 w-5 text-center">{item.grade}</span>
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
        </div>

        {/* Right: Stats Panel */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <StatsPanel stockComponents={stockComponents} overrides={overrides} />
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
        <CartPanel cartData={cartData} cartLoading={cartLoading} refetchCart={refetchCart} onClose={() => setShowCart(false)} />
      )}
    </div>
  )
}
