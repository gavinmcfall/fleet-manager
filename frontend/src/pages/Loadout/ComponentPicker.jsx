import React, { useState, useMemo } from 'react'
import { X, ShoppingCart, Star, ArrowUp, ArrowDown, Diamond, Package, MapPin, Search } from 'lucide-react'
import { useCompatibleComponents } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import { SORT_STAT_KEY, getPrimaryStat, PORT_TYPE_LABELS } from './loadoutHelpers'

/**
 * Modal showing all compatible components for a port, sorted by primary stat.
 * Sections: Better / Equipped / Worse / Stock Default
 */
export default function ComponentPicker({ slug, portId, portType, currentOverride, stockComponent, onSelect, onAddToCart, onClose }) {
  const { data, loading, error } = useCompatibleComponents(slug, portId)
  const [filter, setFilter] = useState('')

  const equippedUuid = currentOverride?.component_uuid || stockComponent?.component_uuid || null
  const stockUuid = stockComponent?.component_uuid || null

  // Get the primary stat value for the currently equipped component
  const equippedStatKey = data ? SORT_STAT_KEY[data.port_type] : null
  const equippedStatVal = useMemo(() => {
    if (!data?.components || !equippedUuid || !equippedStatKey) return null
    const comp = data.components.find(c => c.uuid === equippedUuid)
    return comp ? Number(comp[equippedStatKey]) || 0 : 0
  }, [data, equippedUuid, equippedStatKey])

  // Filter and section components
  const { better, equipped, worse, stockDefault } = useMemo(() => {
    if (!data?.components) return { better: [], equipped: [], worse: [], stockDefault: [] }

    const lowerFilter = filter.toLowerCase()
    const filtered = data.components.filter(c =>
      !lowerFilter || c.name?.toLowerCase().includes(lowerFilter) || c.manufacturer_name?.toLowerCase().includes(lowerFilter)
    )

    const sections = { better: [], equipped: [], worse: [], stockDefault: [] }

    for (const comp of filtered) {
      if (comp.uuid === equippedUuid) {
        sections.equipped.push(comp)
      } else if (comp.uuid === stockUuid && comp.uuid !== equippedUuid) {
        sections.stockDefault.push(comp)
      } else if (equippedStatKey && equippedStatVal != null) {
        const val = Number(comp[equippedStatKey]) || 0
        if (val > equippedStatVal) {
          sections.better.push(comp)
        } else {
          sections.worse.push(comp)
        }
      } else {
        sections.worse.push(comp)
      }
    }

    return sections
  }, [data, filter, equippedUuid, stockUuid, equippedStatKey, equippedStatVal])

  const totalCount = (data?.components?.length) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700/50">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">
              Select {PORT_TYPE_LABELS[portType] || portType}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Size {data?.size_min === data?.size_max ? data?.size_min : `${data?.size_min}–${data?.size_max}`}
              {' · '}{totalCount} compatible
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-zinc-800/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter components..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-700"
              autoFocus
            />
          </div>
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6"><LoadingState /></div>}
          {error && <div className="p-4 text-red-400 text-sm">{error}</div>}

          {!loading && !error && (
            <div className="divide-y divide-zinc-800/30">
              <ComponentSection
                label="Better than equipped"
                icon={<ArrowUp className="w-3 h-3" />}
                items={better}
                color="text-emerald-400"
                equippedUuid={equippedUuid}
                stockUuid={stockUuid}
                portType={portType}
                statKey={equippedStatKey}
                onSelect={onSelect}
                onAddToCart={onAddToCart}
              />
              <ComponentSection
                label="Currently equipped"
                icon={<Star className="w-3 h-3" />}
                items={equipped}
                color="text-sky-400"
                equippedUuid={equippedUuid}
                stockUuid={stockUuid}
                portType={portType}
                statKey={equippedStatKey}
                onSelect={onSelect}
                onAddToCart={onAddToCart}
              />
              <ComponentSection
                label="Worse than equipped"
                icon={<ArrowDown className="w-3 h-3" />}
                items={worse}
                color="text-zinc-500"
                equippedUuid={equippedUuid}
                stockUuid={stockUuid}
                portType={portType}
                statKey={equippedStatKey}
                onSelect={onSelect}
                onAddToCart={onAddToCart}
              />
              {stockDefault.length > 0 && (
                <ComponentSection
                  label="Stock default"
                  icon={<Diamond className="w-3 h-3" />}
                  items={stockDefault}
                  color="text-amber-400"
                  equippedUuid={equippedUuid}
                  stockUuid={stockUuid}
                  portType={portType}
                  statKey={equippedStatKey}
                  onSelect={onSelect}
                  onAddToCart={onAddToCart}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ComponentSection({ label, icon, items, color, equippedUuid, stockUuid, portType, statKey, onSelect, onAddToCart }) {
  if (items.length === 0) return null

  return (
    <div>
      <div className={`px-5 py-1.5 text-[11px] font-medium uppercase tracking-wider ${color} bg-zinc-800/30 flex items-center gap-1.5`}>
        {icon} {label}
      </div>
      {items.map(comp => (
        <ComponentRow
          key={comp.id}
          comp={comp}
          isEquipped={comp.uuid === equippedUuid}
          isStock={comp.uuid === stockUuid}
          portType={portType}
          statKey={statKey}
          onSelect={onSelect}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  )
}

function ComponentRow({ comp, isEquipped, isStock, portType, statKey, onSelect, onAddToCart }) {
  const statVal = statKey ? comp[statKey] : null
  const hasBuyShop = comp.shops?.length > 0
  const cheapestShop = hasBuyShop ? comp.shops.reduce((a, b) => (a.buy_price || Infinity) < (b.buy_price || Infinity) ? a : b) : null

  return (
    <div
      className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors group
        ${isEquipped ? 'bg-sky-950/20' : 'hover:bg-zinc-800/40'}`}
      onClick={() => onSelect(comp)}
    >
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate ${isEquipped ? 'text-sky-300 font-medium' : 'text-zinc-200'}`}>
            {comp.name}
          </span>
          {isEquipped && <Star className="w-3 h-3 text-sky-400 flex-shrink-0" />}
          {isStock && !isEquipped && <Diamond className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
          {comp.manufacturer_name && <span>{comp.manufacturer_name}</span>}
          <span>S{comp.size}</span>
          {comp.grade && <span>Grade {comp.grade}</span>}
          {comp.class && <span className="text-zinc-600">{comp.class}</span>}
        </div>
      </div>

      {/* Primary stat */}
      {statVal != null && (
        <div className="text-right flex-shrink-0 w-20">
          <span className="text-sm font-mono text-zinc-300">
            {formatStatValue(statKey, statVal)}
          </span>
        </div>
      )}

      {/* Availability status */}
      <div className="flex-shrink-0 w-32 text-right">
        {comp.in_collection && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
            <Package className="w-3 h-3" /> In collection
          </span>
        )}
        {!comp.in_collection && comp.on_ships?.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 bg-sky-900/20 px-1.5 py-0.5 rounded truncate max-w-full">
            On {comp.on_ships[0].custom_name || comp.on_ships[0].ship_name}
          </span>
        )}
        {!comp.in_collection && comp.on_ships?.length === 0 && hasBuyShop && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-900/20 px-1.5 py-0.5 rounded truncate max-w-full">
            <MapPin className="w-3 h-3" /> {cheapestShop.shop_name}
            {cheapestShop.buy_price && ` · ${Number(cheapestShop.buy_price).toLocaleString()} aUEC`}
          </span>
        )}
        {!comp.in_collection && comp.on_ships?.length === 0 && !hasBuyShop && (
          <span className="inline-flex items-center gap-1 text-[11px] text-orange-400 bg-orange-900/20 px-1.5 py-0.5 rounded">
            Loot only
          </span>
        )}
      </div>

      {/* Cart button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddToCart(comp)
        }}
        className="flex-shrink-0 p-1.5 text-zinc-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all"
        title="Add to cart"
      >
        <ShoppingCart className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function formatStatValue(key, val) {
  const v = Number(val)
  if (key === 'shield_hp') return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} HP`
  if (key === 'cooling_rate') return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}/s`
  if (key === 'power_output') return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} pwr`
  if (key === 'quantum_speed') return `${(v / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} Mm/s`
  if (key === 'dps') return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} DPS`
  if (key === 'radar_range') return `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
  if (key === 'qed_range') return `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
