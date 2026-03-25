import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { RotateCcw, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react'
import { useShip, useLoadoutComponents, useShipModules, useFleetLoadout, useLoadoutCart, saveFleetLoadout, resetFleetLoadout, addToLoadoutCart } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ComponentPicker from './ComponentPicker'
import CartPanel from './CartPanel'
import WeaponBlock from './WeaponBlock'
import DamageBreakdown, { DamageTypeLegend } from './DamageBreakdown'
import PowerPips from './PowerPips'
import { PORT_TYPE_ICONS, PORT_CATEGORY_ORDER, getPortCategory, getPrimaryStat, aggregateCombatStats, fmtInt, fmtDec1, fmtSpeed } from './loadoutHelpers'

export default function Loadout() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const fleetId = searchParams.get('fleet_id') ? parseInt(searchParams.get('fleet_id'), 10) : null

  const { data: ship } = useShip(slug)
  const { data: stockComponents, loading: stockLoading, error: stockError } = useLoadoutComponents(slug)
  const { data: modules } = useShipModules(slug)
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

  // Group components by category, re-parenting turret children into the Turrets group
  const grouped = useMemo(() => {
    if (!stockComponents) return []

    // Build set of turret port_ids so we can re-parent their children
    const turretIds = new Set(
      stockComponents
        .filter(c => c.port_type === 'turret' && !c.parent_port_id)
        .map(c => c.port_id)
    )

    const groups = {}
    for (const comp of stockComponents) {
      // If this component's parent is a turret, force it into the Turrets group
      const isTurretChild = comp.parent_port_id && turretIds.has(comp.parent_port_id)
      // Missile racks on turret mounts should go in Missiles, not Turrets
      const isMissileRack = comp.component_type === 'MissileLauncher'
      const cat = isMissileRack ? 'Missiles' : isTurretChild ? 'Turrets' : getPortCategory(comp.port_type, comp.category_label)
      if (!groups[cat]) groups[cat] = { label: cat, portType: isTurretChild ? 'turret' : comp.port_type, items: [] }
      groups[cat].items.push(comp)
    }
    return PORT_CATEGORY_ORDER.filter(cat => groups[cat]).map(cat => groups[cat])
  }, [stockComponents])

  // Aggregate combat stats
  const combat = useMemo(() => {
    if (!stockComponents) return null
    return aggregateCombatStats(stockComponents)
  }, [stockComponents])

  // Split groups into left (weapons/turrets/missiles) and right (systems)
  const leftCategories = ['Weapons', 'Turrets', 'Missiles']
  const leftGroups = grouped.filter(g => leftCategories.includes(g.label))
  const rightGroups = grouped.filter(g => !leftCategories.includes(g.label) && g.label !== 'Modules')
  const moduleGroup = grouped.find(g => g.label === 'Modules')

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

  const handleAddNonStockToCart = useCallback(async () => {
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

  const hasComponents = stockComponents?.length > 0

  return (
    <div className="min-h-screen animate-fade-in-up">
      {/* ============================================================ */}
      {/* SHIP HERO HEADER                                              */}
      {/* ============================================================ */}
      <div className="relative bg-sc-panel border-b border-sc-border">
        <div className="max-w-[1400px] mx-auto flex items-stretch">
          <div className="w-80 h-44 flex-shrink-0 overflow-hidden relative hidden md:block">
            {(ship?.image_url_large || ship?.image_url_medium || ship?.image_url) && (
              <img
                src={ship.image_url_large || ship.image_url_medium || ship.image_url}
                alt={ship?.name || slug}
                className="w-full h-full object-cover opacity-80"
                onError={(e) => {
                  if (ship.image_url_medium && e.target.src !== ship.image_url_medium) {
                    e.target.src = ship.image_url_medium
                  } else if (ship.image_url && e.target.src !== ship.image_url) {
                    e.target.src = ship.image_url
                  }
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-sc-panel" />
          </div>
          <div className="flex-1 px-6 py-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-hud text-2xl text-white tracking-wide" style={{ textShadow: '0 0 20px rgba(34,211,238,0.15)' }}>
                  {ship?.name || slug}
                </h1>
                {fleetId && (
                  <span className="text-[11px] bg-sc-accent/10 text-sc-accent px-2 py-0.5 rounded border border-sc-accent/20 font-medium">Fleet Ship</span>
                )}
                {overrideCount > 0 && (
                  <span className="text-[11px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-medium">{overrideCount} customized</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {ship?.manufacturer_name && <span className="text-gray-400">{ship.manufacturer_name}</span>}
                {ship?.focus && <span> · {ship.focus}</span>}
                {ship?.size_label && <span> · {ship.size_label}</span>}
                {ship?.crew_min != null && <span> · Crew {ship.crew_min}{ship.crew_max > ship.crew_min ? `–${ship.crew_max}` : ''}</span>}
              </p>
              {ship && (
                <div className="flex items-center gap-4 mt-2 text-[12px] text-gray-500 font-mono flex-wrap">
                  {ship.health > 0 && <span>HP <span className="text-gray-300">{fmtInt(ship.health)}</span></span>}
                  {ship.speed_scm > 0 && <span>SCM <span className="text-gray-300">{ship.speed_scm}</span> m/s</span>}
                  {ship.mass > 0 && <span>Mass <span className="text-gray-300">{fmtInt(ship.mass)}</span> kg</span>}
                  {ship.cargo > 0 && <span>Cargo <span className="text-gray-300">{ship.cargo}</span> SCU</span>}
                </div>
              )}
            </div>
            {hasComponents && <div className="flex items-center gap-2 mt-3 flex-wrap">
              {fleetId && overrideCount > 0 && (
                <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-sc-accent/20 hover:bg-sc-accent/30 text-sc-accent border border-sc-accent/30 rounded transition-all font-medium cursor-pointer">
                  Save Loadout
                </button>
              )}
              {overrideCount > 0 && (
                <>
                  <button onClick={handleAddNonStockToCart} className="px-3 py-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all flex items-center gap-1 cursor-pointer">
                    <ShoppingCart className="w-3 h-3" /> Non-Stock to Cart
                  </button>
                  <button onClick={handleResetAll} className="px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 border border-white/[0.06] rounded transition-all flex items-center gap-1 cursor-pointer">
                    <RotateCcw className="w-3 h-3" /> Reset All
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setShowCart(!showCart)}
                  className="relative px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 border border-white/[0.06] rounded transition-all flex items-center gap-1 cursor-pointer">
                  <ShoppingCart className="w-3 h-3" /> Cart
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-sc-accent text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ boxShadow: '0 0 6px rgba(34,211,238,0.5)' }}>
                      {cartCount}
                    </span>
                  )}
                </button>
                <Link to={`/ships/${slug}`} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors">
                  Ship Detail →
                </Link>
              </div>
            </div>}
          </div>
        </div>
      </div>

      {/* No loadout data — concept ship or not yet in game */}
      {!hasComponents && (
        <div className="max-w-[1400px] mx-auto p-8 text-center">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-8 max-w-lg mx-auto">
            <div className="text-gray-500 text-sm mb-2">No loadout data available</div>
            <div className="text-gray-600 text-xs">
              This ship doesn't have component data in the game files yet.
              {ship?.classification && <> It's listed as <span className="text-gray-400">{ship.classification}</span>.</>}
            </div>
            <Link to={`/ships/${slug}`} className="inline-block mt-4 px-4 py-2 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 border border-white/[0.06] rounded transition-colors">
              ← Back to Ship Detail
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STATS SUMMARY BAR                                             */}
      {/* ============================================================ */}
      {hasComponents && <div className="bg-sc-dark/80 backdrop-blur border-b border-sc-border">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-stretch gap-4">
            {/* LEFT: DPS + Alpha + Damage breakdown */}
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-stretch gap-px">
                <div className="flex-1 flex flex-col items-center justify-center min-h-[56px] bg-white/[0.02] rounded-l-md">
                  <div className="flex items-baseline gap-1">
                    <span className="font-hud text-[36px] text-sc-accent leading-none" style={{ textShadow: '0 0 12px rgba(34,211,238,0.3)' }}>
                      {combat ? fmtInt(Math.round(combat.totalDps)) : '—'}
                    </span>
                    <span className="text-[15px] text-gray-500 ml-1">dps</span>
                  </div>
                  <div className="text-[11px] text-gray-600 uppercase tracking-wider mt-1">Sustained DPS</div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center min-h-[56px] bg-white/[0.02] rounded-r-md">
                  <div className="flex items-baseline gap-1">
                    <span className="font-hud text-[36px] text-white leading-none">
                      {combat ? fmtInt(Math.round(combat.totalAlpha)) : '—'}
                    </span>
                    <span className="text-[15px] text-gray-500 ml-1">dmg</span>
                  </div>
                  <div className="text-[11px] text-gray-600 uppercase tracking-wider mt-1">Alpha Strike</div>
                </div>
              </div>
              {combat && (
                <DamageBreakdown
                  dpsPhysical={combat.dpsPhysical}
                  dpsEnergy={combat.dpsEnergy}
                  dpsDistortion={combat.dpsDistortion}
                  dpsThermal={combat.dpsThermal}
                  totalAlpha={combat.totalAlpha}
                />
              )}
              <DamageTypeLegend />
            </div>

            {/* CENTER: Power Pips */}
            <PowerPips weaponPoolSize={ship?.weapon_pool_size || 4} />

            {/* RIGHT: 3×2 stat grid */}
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-px bg-white/[0.03] rounded-md overflow-hidden h-full">
                <StatCell label="Shield HP" value={combat?.totalShieldHp} format={fmtInt} color="text-blue-400" unit="hp" />
                <StatCell label="Hull HP" value={ship?.armor_hp || ship?.health} format={fmtInt} color="text-amber-400" unit="hp" />
                <StatCell label="QT Fuel" value={ship?.fuel_capacity_quantum} format={fmtDec1} color="text-purple-400" unit="SCU" />
                <StatCell label="Shield Regen" value={combat?.totalShieldRegen} format={fmtInt} color="text-blue-300" unit="hp/s" />
                <StatCell label="H2 Fuel" value={ship?.fuel_capacity_hydrogen} format={fmtInt} color="text-orange-400" unit="SCU" />
                <StatCell label="SCM Speed" value={ship?.speed_scm} format={fmtInt} color="text-gray-300" unit="m/s" />
              </div>
            </div>
          </div>
        </div>
      </div>}

      {hasComponents && <>
      {/* ============================================================ */}
      {/* MAIN CONTENT: TWO-COLUMN LAYOUT                               */}
      {/* ============================================================ */}
      <div className="max-w-[1400px] mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT: Weapons / Turrets / Missiles */}
          <div className="space-y-4">
            {leftGroups.map(group => (
              <SectionCard
                key={group.label}
                group={group}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                overrides={overrides}
                onOpenPicker={(portId, portType) => { setPickerPortId(portId); setPickerPortType(portType) }}
                onAddToCart={async (comp) => { await addToLoadoutCart([{ component_id: comp.component_id || comp.id }]); refetchCart() }}
                isWeaponSection
              />
            ))}
          </div>

          {/* RIGHT: Systems */}
          <div className="space-y-4">
            {rightGroups.map(group => (
              <SectionCard
                key={group.label}
                group={group}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                overrides={overrides}
                onOpenPicker={(portId, portType) => { setPickerPortId(portId); setPickerPortType(portType) }}
                onAddToCart={async (comp) => { await addToLoadoutCart([{ component_id: comp.component_id || comp.id }]); refetchCart() }}
              />
            ))}
          </div>
        </div>

        {/* MODULES (full-width) */}
        {moduleGroup && moduleGroup.items.length > 0 && (
          <div className="mt-4">
            <SectionCard
              group={moduleGroup}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              overrides={overrides}
              onOpenPicker={(portId, portType) => { setPickerPortId(portId); setPickerPortType(portType) }}
              modules={modules}
            />
          </div>
        )}
      </div>
      </>}

      {/* Component Picker Modal */}
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

      {/* Cart Panel */}
      {showCart && (
        <CartPanel cartData={cartData} cartLoading={cartLoading} refetchCart={refetchCart} onClose={() => setShowCart(false)} />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({ label, value, format, color, unit }) {
  const formatted = value != null && value > 0 ? (format ? format(value) : String(value)) : '—'
  return (
    <div className="flex flex-col items-center justify-center min-h-[56px] bg-sc-dark">
      <div className="flex items-baseline gap-1">
        <span className={`font-hud text-[24px] leading-none whitespace-nowrap ${color}`}>{formatted}</span>
        {unit && value > 0 && <span className="text-[13px] text-gray-500 ml-0.5">{unit}</span>}
      </div>
      <div className="text-[11px] text-gray-600 uppercase tracking-wider mt-1">{label}</div>
    </div>
  )
}

function SectionCard({ group, collapsed, setCollapsed, overrides, onOpenPicker, onAddToCart, modules, isWeaponSection }) {
  const isCollapsed = collapsed[group.label]
  const Icon = PORT_TYPE_ICONS[group.portType]
  const categoryOverrides = group.items.filter(i => overrides[i.port_id]).length

  const iconColors = {
    weapon: 'text-sc-accent', turret: 'text-orange-400', missile: 'text-red-400',
    shield: 'text-blue-400', power: 'text-yellow-400', cooler: 'text-cyan-300',
    quantum_drive: 'text-purple-400', jump_drive: 'text-purple-300', sensor: 'text-green-400',
    countermeasure: 'text-gray-400', module: 'text-purple-400',
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.02] border-b border-white/[0.06]">
        <button
          onClick={() => setCollapsed(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {Icon && <Icon className={`w-4 h-4 ${iconColors[group.portType] || 'text-gray-400'}`} />}
          <span className="text-[12px] font-semibold uppercase tracking-wider font-hud">{group.label}</span>
        </button>
        <span className="text-[11px] text-gray-600">{group.items.length}</span>
        {categoryOverrides > 0 && (
          <span className="text-[11px] text-sc-accent ml-1" style={{ textShadow: '0 0 8px rgba(34,211,238,0.3)' }}>
            {categoryOverrides} custom
          </span>
        )}
        <button className="text-[11px] text-gray-600 hover:text-gray-400 cursor-pointer transition-colors ml-auto">RESET</button>
      </div>

      {!isCollapsed && (
        <div>
          {group.items.map(item => {
            const override = overrides[item.port_id]
            const isOverridden = !!override

            // Turret housing (top-level turret) — render as section header, not interactive
            if (item.port_type === 'turret' && !item.parent_port_id) {
              // Find children of this turret in the same group
              const children = group.items.filter(c => c.parent_port_id === item.port_id)
              const turretLabel = item.mount_name || item.component_name || item.port_name
              // Friendly position from port name
              const posHint = item.port_name?.replace('hardpoint_turret_', '').replace(/_/g, ' ')
              return (
                <div key={item.port_id}>
                  <div className="px-3 py-1 text-[12px] text-gray-600 bg-white/[0.01] font-medium uppercase tracking-wider border-t border-white/[0.04] first:border-t-0">
                    {turretLabel}{posHint ? ` · ${posHint}` : ''}
                    {item.weapon_count > 0 && <span className="text-gray-700 ml-1">({item.weapon_count}× weapons)</span>}
                  </div>
                  {children.length > 0 ? children.map(child => {
                    const childOverride = overrides[child.port_id]
                    return (
                      <WeaponBlock
                        key={child.port_id}
                        item={childOverride ? { ...child, ...childOverride } : child}
                        isCustomized={!!childOverride}
                        weaponGroups={[]}
                        onClickMount={() => onOpenPicker(child.port_id, child.port_type)}
                        onClickWeapon={() => onOpenPicker(child.port_id, child.port_type)}
                        onAddToCart={() => onAddToCart?.(child)}
                      />
                    )
                  }) : (
                    // Turret with no separate mount children — show the resolved weapon directly
                    <WeaponBlock
                      key={`${item.port_id}-weapon`}
                      item={override ? { ...item, ...override } : item}
                      isCustomized={isOverridden}
                      weaponGroups={[]}
                      onClickMount={() => onOpenPicker(item.port_id, item.port_type)}
                      onClickWeapon={() => onOpenPicker(item.port_id, item.port_type)}
                      onAddToCart={() => onAddToCart?.(item)}
                    />
                  )}
                </div>
              )
            }

            // Skip turret children — they're rendered inside their parent above
            if (item.parent_port_id && group.items.some(p => p.port_id === item.parent_port_id && p.port_type === 'turret')) {
              return null
            }

            // Weapon/missile sections use WeaponBlock for parent-child rendering
            if (isWeaponSection || item.port_type === 'weapon') {
              return (
                <WeaponBlock
                  key={item.port_id}
                  item={override ? { ...item, ...override } : item}
                  isCustomized={isOverridden}
                  weaponGroups={[]}
                  onClickMount={() => onOpenPicker(item.port_id, item.port_type)}
                  onClickWeapon={() => onOpenPicker(item.port_id, item.port_type)}
                  onAddToCart={() => onAddToCart?.(item)}
                />
              )
            }

            // Missile racks — show rack name + missile count
            if (item.component_type === 'MissileLauncher') {
              const rackName = item.mount_name || item.component_name || 'Missile Rack'
              const missileCount = item.missile_count || 0
              const missileName = item.child_name
              return (
                <div key={item.port_id} className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => onOpenPicker(item.port_id, 'missile')}>
                  <span className="text-[11px] w-7 text-center flex-shrink-0 font-mono bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-px text-gray-400">
                    S{item.size_max}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 font-medium">{rackName}</div>
                    {missileName && missileCount > 0 && (
                      <div className="text-[11px] text-gray-500 mt-0.5">{missileCount}× {missileName} · S{item.component_size}</div>
                    )}
                    {!missileName && missileCount > 0 && (
                      <div className="text-[11px] text-gray-500 mt-0.5">{missileCount} missiles</div>
                    )}
                  </div>
                  <span className="font-mono text-[12px] text-gray-500 flex-shrink-0">{missileCount}×</span>
                </div>
              )
            }

            // Empty/locked ports (door turrets, etc.) — show with padlock
            if (!item.component_name && !item.child_name && !item.mount_name) {
              return (
                <div key={item.port_id} className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.03] opacity-40">
                  <span className="text-[11px] w-7 text-center flex-shrink-0 font-mono bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-px text-gray-500">
                    S{item.size_max}
                  </span>
                  <span className="text-sm text-gray-600">Empty</span>
                  <span className="text-[11px] text-gray-700 ml-auto">🔒</span>
                </div>
              )
            }

            // System components — simple row
            const displayName = override?.component_name || item.component_name
            const primaryStat = getPrimaryStat(item, override)
            const sz = item.component_size || item.size_max

            return (
              <button
                key={item.port_id}
                onClick={() => onOpenPicker(item.port_id, item.port_type)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-200 cursor-pointer border-b border-white/[0.03]
                  ${isOverridden
                    ? 'bg-sc-accent/[0.04] border-l-2 border-l-sc-accent/60 hover:bg-sc-accent/[0.08]'
                    : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}
              >
                <span className="text-[11px] w-7 text-center flex-shrink-0 font-mono bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-px text-gray-400">
                  S{sz}
                </span>
                <span className={`text-sm truncate flex-1 ${isOverridden ? 'text-sc-accent font-medium' : 'text-gray-300'}`}
                  style={isOverridden ? { textShadow: '0 0 8px rgba(34,211,238,0.3)' } : undefined}>
                  {displayName || 'Empty'}
                </span>
                {item.grade && (
                  <span className="font-mono text-[11px] px-1 py-px rounded flex-shrink-0 bg-gray-500/10 text-gray-400 border border-gray-500/20">
                    {item.grade}
                  </span>
                )}
                {item.manufacturer_name && <span className="text-[11px] text-gray-600 flex-shrink-0">{item.manufacturer_name}</span>}
                {primaryStat && (
                  <span className="text-[12px] font-mono text-gray-500 flex-shrink-0 tabular-nums ml-auto">{primaryStat}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
