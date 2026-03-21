import React, { useState, useMemo } from 'react'
import { X, ShoppingCart, Star, Diamond, Package, MapPin, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useCompatibleComponents } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import { getColumnsForPortType, getDefaultSortKey, PORT_TYPE_LABELS } from './loadoutHelpers'

/**
 * Full-width sortable data grid for selecting compatible components.
 * Columns are type-specific (weapons show DPS/alpha/range, shields show HP/regen/resist, etc.)
 */
export default function ComponentPicker({ slug, portId, portType, currentOverride, stockComponent, onSelect, onAddToCart, onClose }) {
  const { data, loading, error } = useCompatibleComponents(slug, portId)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState(() => getDefaultSortKey(portType))
  const [sortDir, setSortDir] = useState('desc')

  const equippedUuid = currentOverride?.component_uuid || stockComponent?.component_uuid || null
  const stockUuid = stockComponent?.component_uuid || null
  const columns = getColumnsForPortType(portType)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'manufacturer_name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    if (!data?.components) return []
    const lowerFilter = filter.toLowerCase()
    let filtered = data.components.filter(c =>
      !lowerFilter || c.name?.toLowerCase().includes(lowerFilter) || c.manufacturer_name?.toLowerCase().includes(lowerFilter)
    )

    filtered.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return filtered
  }, [data, filter, sortKey, sortDir])

  const totalCount = data?.components?.length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div className="bg-gray-950 border border-white/[0.08] rounded-lg shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Select {PORT_TYPE_LABELS[portType] || portType}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Size {data?.size_min === data?.size_max ? data?.size_min : `${data?.size_min}–${data?.size_max}`}
              {' · '}{totalCount} compatible
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Filter..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded text-gray-300 placeholder-zinc-500 focus:outline-none focus:border-sc-accent/50 w-48"
                autoFocus
              />
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-300 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-0 px-5 py-1.5 border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-medium text-gray-500 uppercase tracking-wider flex-shrink-0">
          <div className="w-6 flex-shrink-0" /> {/* status icon */}
          {columns.map(col => (
            <button
              key={col.key}
              onClick={() => handleSort(col.key)}
              className={`${col.width || 'w-16'} flex-shrink-0 flex items-center gap-0.5 cursor-pointer hover:text-zinc-300 transition-colors ${col.align === 'left' ? '' : 'justify-end'}`}
            >
              {col.label}
              {sortKey === col.key ? (
                sortDir === 'desc' ? <ArrowDown className="w-3 h-3 text-sc-accent" /> : <ArrowUp className="w-3 h-3 text-sc-accent" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-30" />
              )}
            </button>
          ))}
          <div className="w-28 flex-shrink-0 text-right">Status</div>
          <div className="w-8 flex-shrink-0" /> {/* cart */}
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {loading && <div className="p-8"><LoadingState /></div>}
          {error && <div className="p-4 text-red-400 text-sm">{error}</div>}

          {!loading && !error && sorted.map(comp => {
            const isEquipped = comp.uuid === equippedUuid
            const isStock = comp.uuid === stockUuid
            const hasBuyShop = comp.shops?.length > 0
            const cheapestShop = hasBuyShop ? comp.shops.reduce((a, b) => (a.buy_price || Infinity) < (b.buy_price || Infinity) ? a : b) : null

            return (
              <div
                key={comp.id}
                onClick={() => onSelect(comp)}
                className={`flex items-center gap-0 px-5 py-2 cursor-pointer transition-colors group border-b border-white/[0.03]
                  ${isEquipped ? 'bg-sc-accent/[0.06] border-l-2 border-l-sc-accent/60' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}
              >
                {/* Status icon */}
                <div className="w-6 flex-shrink-0 flex items-center">
                  {isEquipped && <Star className="w-3.5 h-3.5 text-sc-accent" />}
                  {isStock && !isEquipped && <Diamond className="w-3.5 h-3.5 text-amber-400" />}
                </div>

                {/* Data columns */}
                {columns.map(col => {
                  const raw = comp[col.key]
                  const display = raw != null ? (col.format ? col.format(raw) : String(raw)) : '—'
                  return (
                    <div
                      key={col.key}
                      className={`${col.width || 'w-16'} flex-shrink-0 text-xs font-mono truncate
                        ${col.align === 'left' ? 'text-left' : 'text-right'}
                        ${col.key === 'name' ? (isEquipped ? 'text-sc-accent font-medium font-sans' : 'text-gray-300 font-sans') : 'text-gray-400'}`}
                    >
                      {display}
                    </div>
                  )
                })}

                {/* Availability status */}
                <div className="w-28 flex-shrink-0 text-right">
                  {comp.in_collection ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
                      <Package className="w-3 h-3" /> Collected
                    </span>
                  ) : comp.on_ships?.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-sc-accent bg-sky-900/20 px-1.5 py-0.5 rounded truncate max-w-full" title={`On ${comp.on_ships[0].custom_name || comp.on_ships[0].ship_name}`}>
                      On {comp.on_ships[0].custom_name || comp.on_ships[0].ship_name}
                    </span>
                  ) : hasBuyShop ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-900/20 px-1.5 py-0.5 rounded truncate max-w-full" title={cheapestShop.shop_name}>
                      <MapPin className="w-3 h-3" /> {cheapestShop.buy_price ? `${Number(cheapestShop.buy_price).toLocaleString()}` : 'Buy'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-orange-400 bg-orange-900/20 px-1.5 py-0.5 rounded">
                      Loot
                    </span>
                  )}
                </div>

                {/* Cart button */}
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToCart(comp) }}
                    className="p-1 text-gray-600 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Add to cart"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}

          {!loading && !error && sorted.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">No compatible components found.</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-white/[0.04] text-[11px] text-gray-600 flex items-center justify-between flex-shrink-0">
          <span>{sorted.length} of {totalCount} shown</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-sc-accent" /> Equipped</span>
            <span className="flex items-center gap-1"><Diamond className="w-3 h-3 text-amber-400" /> Stock</span>
          </div>
        </div>
      </div>
    </div>
  )
}
