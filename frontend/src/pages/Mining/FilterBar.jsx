import React from 'react'
import { Search, X } from 'lucide-react'
import { SYSTEM_COLORS, LOCATION_TYPE_COLORS, CATEGORY_STYLES, EQUIPMENT_TYPE_COLORS } from './miningUtils'

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

const accentPill = { bg: 'bg-sc-accent/15', text: 'text-sc-accent', border: 'border-sc-accent/30' }

export default function FilterBar({ search, onSearchChange, tab, systemFilter, typeFilter, sizeFilter, onFilterChange }) {
  // Show system pills for locations tab and ores tab
  const showSystemPills = tab === 'locations' || tab === 'ores'
  // Show type pills based on tab
  const showTypePills = tab === 'locations' || tab === 'equipment'

  const typeOptions = tab === 'locations'
    ? Object.keys(LOCATION_TYPE_COLORS)
    : tab === 'equipment'
    ? ['laser', 'module', 'gadget']
    : []

  const typeColorMap = tab === 'locations' ? LOCATION_TYPE_COLORS : EQUIPMENT_TYPE_COLORS

  const hasActiveFilters = systemFilter || typeFilter

  const placeholders = {
    ores: 'Search elements...',
    locations: 'Search locations...',
    equipment: 'Search equipment...',
    calculator: 'Search compositions...',
    compositions: 'Search compositions...',
    refining: 'Search refining processes...',
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={placeholders[tab] || 'Search...'}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-sc-accent/40 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)] transition-all duration-200"
        />
      </div>

      {/* System pills */}
      {showSystemPills && (
        <div className="flex flex-wrap gap-2">
          <TypePill
            label="All Systems"
            active={!systemFilter}
            color={accentPill}
            onClick={() => onFilterChange({ system: '' })}
          />
          {Object.entries(SYSTEM_COLORS).map(([sys, color]) => (
            <TypePill
              key={sys}
              label={sys}
              active={systemFilter === sys}
              color={color}
              onClick={() => onFilterChange({ system: systemFilter === sys ? '' : sys })}
            />
          ))}
        </div>
      )}

      {/* Ores category pills */}
      {tab === 'ores' && (
        <div className="flex flex-wrap gap-2">
          <TypePill
            label="All Categories"
            active={!typeFilter}
            color={accentPill}
            onClick={() => onFilterChange({ type: '' })}
          />
          {Object.entries(CATEGORY_STYLES).map(([cat, color]) => (
            <TypePill
              key={cat}
              label={cat.charAt(0).toUpperCase() + cat.slice(1)}
              active={typeFilter === cat}
              color={color}
              onClick={() => onFilterChange({ type: typeFilter === cat ? '' : cat })}
            />
          ))}
        </div>
      )}

      {/* Type pills (location_type or equipment_type) */}
      {showTypePills && typeOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <TypePill
            label={`All ${tab === 'locations' ? 'Types' : 'Equipment'}`}
            active={!typeFilter}
            color={accentPill}
            onClick={() => onFilterChange({ type: '' })}
          />
          {typeOptions.map(t => (
            <TypePill
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              active={typeFilter === t}
              color={typeColorMap[t] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }}
              onClick={() => onFilterChange({ type: typeFilter === t ? '' : t })}
            />
          ))}
        </div>
      )}

      {/* Size pills (equipment only) */}
      {tab === 'equipment' && (
        <div className="flex flex-wrap gap-2">
          <TypePill
            label="All Sizes"
            active={!sizeFilter && sizeFilter !== '0'}
            color={accentPill}
            onClick={() => onFilterChange({ size: '' })}
          />
          {['0', '1', '2'].map(s => (
            <TypePill
              key={s}
              label={`Size ${s}`}
              active={sizeFilter === s}
              color={{ bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }}
              onClick={() => onFilterChange({ size: sizeFilter === s ? '' : s })}
            />
          ))}
        </div>
      )}

      {/* Active filter tags */}
      {(hasActiveFilters || sizeFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600">Active:</span>
          {systemFilter && <ActiveTag label={systemFilter} onRemove={() => onFilterChange({ system: '' })} />}
          {typeFilter && <ActiveTag label={typeFilter} onRemove={() => onFilterChange({ type: '' })} />}
          {sizeFilter && <ActiveTag label={`Size ${sizeFilter}`} onRemove={() => onFilterChange({ size: '' })} />}
          <button
            onClick={() => onFilterChange({ system: '', type: '', size: '' })}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
