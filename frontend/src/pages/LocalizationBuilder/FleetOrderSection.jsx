import React, { useMemo } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'
import SearchInput from '../../components/SearchInput'
import useDragReorder from './useDragReorder'

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-sc-accent' : 'bg-gray-700'}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-[2px] ${checked ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  )
}

export default function FleetOrderSection({
  config, orderedShips, allShips, shipSearch, setShipSearch,
  onToggle, onReorder, onRemove, onAdd,
}) {
  const shipDrag = useDragReorder(orderedShips, onReorder)

  const padPos = (n) => {
    const width = orderedShips.length >= 10 ? 2 : 1
    return String(n).padStart(width, '0')
  }

  const shipSearchResults = useMemo(() => {
    if (!allShips || !shipSearch || shipSearch.length < 2) return []
    const term = shipSearch.toLowerCase()
    const existing = new Set(orderedShips.map(s => s.vehicleId))
    return allShips
      .filter(s => !existing.has(s.id) && (
        s.name?.toLowerCase().includes(term) ||
        s.manufacturer_name?.toLowerCase().includes(term)
      ))
      .slice(0, 8)
  }, [allShips, shipSearch, orderedShips])

  return (
    <div className="panel">
      <div className="px-5 py-4 border-b border-sc-border flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-sm text-white">ASOP Terminal Ship Order</h3>
          <p className="text-xs text-gray-500 mt-0.5">Number your ships to control ASOP terminal sort order</p>
        </div>
        <Toggle checked={config.asopEnabled || false} onChange={onToggle} />
      </div>

      {config.asopEnabled && (
        <div className="p-4 space-y-3">
          {/* Ship list — drag to reorder */}
          {orderedShips.length > 0 && (
            <div ref={shipDrag.containerRef} className="space-y-1 max-h-96 overflow-y-auto">
              {orderedShips.map((ship, idx) => (
                <div
                  key={`${ship.vehicleId}-${idx}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border select-none transition-colors group ${
                    shipDrag.dragIdx === idx ? 'opacity-40 bg-black/20 border-sc-accent/40' :
                    shipDrag.overIdx === idx && shipDrag.dragIdx !== null ? 'bg-sc-accent/10 border-sc-accent' :
                    'bg-black/20 border-sc-border hover:border-sc-accent/30'
                  }`}
                >
                  <span className="text-sc-accent font-mono text-xs w-6 text-right shrink-0">{padPos(ship.sortPosition)}.</span>
                  <GripVertical
                    className="w-3.5 h-3.5 text-gray-500 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                    onPointerDown={(e) => shipDrag.startDrag(e, idx)}
                  />
                  <span className="text-xs text-gray-200 flex-1 truncate">
                    {ship.vehicleName}{ship.customLabel && <span className="text-gray-400"> &ldquo;{ship.customLabel}&rdquo;</span>}
                  </span>
                  <button onClick={() => onRemove(idx)} className="p-0.5 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 hover:!opacity-100 cursor-pointer">
                    <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add ship search */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              {orderedShips.length === 0
                ? 'Search and add your ships to set ASOP terminal order'
                : 'Add ships purchased in-game with aUEC'}
            </p>
            <SearchInput
              value={shipSearch}
              onChange={setShipSearch}
              placeholder="Search ships to add..."
            />
            {shipSearchResults.length > 0 && (
              <div className="border border-sc-border rounded bg-black/40 overflow-hidden max-h-48 overflow-y-auto">
                {shipSearchResults.map(ship => (
                  <button
                    key={ship.id}
                    onClick={() => onAdd(ship)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-sc-accent/10 transition-colors border-b border-sc-border last:border-b-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-sc-accent shrink-0" />
                    <span className="text-xs text-gray-200 flex-1">{ship.name}</span>
                    {ship.manufacturer_name && (
                      <span className="text-[10px] text-gray-500">{ship.manufacturer_name}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
