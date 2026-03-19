import React, { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { TYPE_LABELS, SUBTYPE_LABELS, TYPE_COLORS, resourceColor, resourceBgColor, resourceBorderColor } from './craftingUtils'

function TypePill({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border whitespace-nowrap ${
        active
          ? `${color.bg} ${color.text} ${color.border} shadow-[0_0_8px_rgba(34,211,238,0.15)]`
          : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function ResourceChip({ name, active, onClick }) {
  const style = active
    ? { backgroundColor: resourceBgColor(name), borderColor: resourceBorderColor(name), color: resourceColor(name) }
    : {}

  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border whitespace-nowrap ${
        active
          ? ''
          : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-400'
      }`}
      style={active ? style : undefined}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: resourceColor(name) }}
      />
      {name}
    </button>
  )
}

function ActiveTag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

export default function FilterBar({
  search, onSearchChange,
  typeFilter, subtypeFilter, resourceFilter,
  onFilterChange,
  blueprints, resources,
}) {
  const types = useMemo(() => [...new Set(blueprints.map(b => b.type))].sort(), [blueprints])
  const subtypes = useMemo(() => {
    const filtered = typeFilter ? blueprints.filter(b => b.type === typeFilter) : blueprints
    return [...new Set(filtered.map(b => b.sub_type))].sort()
  }, [blueprints, typeFilter])

  const hasActiveFilters = typeFilter || subtypeFilter || resourceFilter

  return (
    <div className="space-y-4 mb-8">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search blueprints..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-sc-accent/40 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)] transition-all duration-200"
        />
      </div>

      {/* Type pills */}
      <div className="flex flex-wrap gap-2">
        <TypePill
          label="All Types"
          active={!typeFilter}
          color={{ bg: 'bg-sc-accent/15', text: 'text-sc-accent', border: 'border-sc-accent/30' }}
          onClick={() => onFilterChange({ type: '', subtype: '' })}
        />
        {types.map(t => (
          <TypePill
            key={t}
            label={TYPE_LABELS[t] || t}
            active={typeFilter === t}
            color={TYPE_COLORS[t] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }}
            onClick={() => onFilterChange({ type: typeFilter === t ? '' : t, subtype: '' })}
          />
        ))}
      </div>

      {/* Subtype pills (shown when type selected) */}
      {typeFilter && subtypes.length > 1 && (
        <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-white/[0.06]">
          <TypePill
            label="All Subtypes"
            active={!subtypeFilter}
            color={{ bg: 'bg-sc-accent/15', text: 'text-sc-accent', border: 'border-sc-accent/30' }}
            onClick={() => onFilterChange({ subtype: '' })}
          />
          {subtypes.map(st => (
            <TypePill
              key={st}
              label={SUBTYPE_LABELS[st] || st}
              active={subtypeFilter === st}
              color={TYPE_COLORS[typeFilter] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }}
              onClick={() => onFilterChange({ subtype: subtypeFilter === st ? '' : st })}
            />
          ))}
        </div>
      )}

      {/* Resource chips */}
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
        {resources.map(r => (
          <ResourceChip
            key={r}
            name={r}
            active={resourceFilter === r}
            onClick={() => onFilterChange({ resource: resourceFilter === r ? '' : r })}
          />
        ))}
      </div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600">Active:</span>
          {typeFilter && <ActiveTag label={TYPE_LABELS[typeFilter] || typeFilter} onRemove={() => onFilterChange({ type: '', subtype: '' })} />}
          {subtypeFilter && <ActiveTag label={SUBTYPE_LABELS[subtypeFilter] || subtypeFilter} onRemove={() => onFilterChange({ subtype: '' })} />}
          {resourceFilter && <ActiveTag label={resourceFilter} onRemove={() => onFilterChange({ resource: '' })} />}
          <button
            onClick={() => onFilterChange({ type: '', subtype: '', resource: '' })}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
