import React, { useMemo } from 'react'
import { Hammer, Clock, FlaskConical } from 'lucide-react'
import SearchInput from '../../components/SearchInput'
import { formatTime, TYPE_LABELS, SUBTYPE_LABELS } from './plannerHelpers'

export default function BlueprintPicker({
  blueprints,
  resources,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  subtypeFilter,
  onSubtypeChange,
}) {
  const types = useMemo(() => [...new Set(blueprints.map(b => b.type))].sort(), [blueprints])
  const subtypes = useMemo(() => {
    const filtered = typeFilter ? blueprints.filter(b => b.type === typeFilter) : blueprints
    return [...new Set(filtered.map(b => b.sub_type))].sort()
  }, [blueprints, typeFilter])

  const filtered = useMemo(() => {
    let items = blueprints
    if (typeFilter) items = items.filter(b => b.type === typeFilter)
    if (subtypeFilter) items = items.filter(b => b.sub_type === subtypeFilter)
    if (search.trim()) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
      items = items.filter(b => {
        const haystack = `${b.name} ${b.type} ${b.sub_type}`.toLowerCase()
        return tokens.every(t => haystack.includes(t))
      })
    }
    return items
  }, [blueprints, typeFilter, subtypeFilter, search])

  return (
    <div className="space-y-4">
      {/* Stage header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-sm font-bold shrink-0">1</div>
        <div>
          <h3 className="font-display font-bold text-white tracking-wide text-sm uppercase">Target Selection</h3>
          <p className="text-xs font-mono text-gray-500">Choose a blueprint to craft</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search blueprints..."
          className="flex-1 min-w-[200px]"
        />
        <select
          value={typeFilter}
          onChange={e => { onTypeChange(e.target.value); onSubtypeChange('') }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Types</option>
          {types.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>
        <select
          value={subtypeFilter}
          onChange={e => onSubtypeChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Subtypes</option>
          {subtypes.map(t => (
            <option key={t} value={t}>{SUBTYPE_LABELS[t] || t}</option>
          ))}
        </select>
      </div>

      <p className="text-xs font-mono text-gray-500">{filtered.length} blueprints</p>

      {/* Blueprint list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No blueprints match your filters.</p>
          </div>
        ) : (
          filtered.map(bp => {
            const isSelected = selectedId === bp.id
            return (
              <button
                key={bp.id}
                onClick={() => onSelect(bp.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-cyan-500/10 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Hammer className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-amber-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-100' : 'text-gray-200'}`}>{bp.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {TYPE_LABELS[bp.type] || bp.type} &middot; {SUBTYPE_LABELS[bp.sub_type] || bp.sub_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(bp.craft_time_seconds)}
                  </span>
                  <span className="text-xs text-gray-600">{bp.slots?.length || 0} slots</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
