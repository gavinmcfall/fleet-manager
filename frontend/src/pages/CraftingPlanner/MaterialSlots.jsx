import React from 'react'
import { Gem, ChevronRight } from 'lucide-react'
import { interpolateModifier, formatTime, TYPE_LABELS, SUBTYPE_LABELS } from './plannerHelpers'

function ModifierPreview({ mod }) {
  const range = mod.modifier_at_end - mod.modifier_at_start
  const isPositive = range > 0
  const pct = Math.abs(range * 100).toFixed(1)
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-gray-500 truncate flex-1">{mod.name}</span>
      <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(Math.abs(range) * 100, 100)}%` }}
        />
      </div>
      <span className={`w-12 text-right shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{pct}%
      </span>
    </div>
  )
}

function MaterialCard({ slot, isSelected, onSelect, resourceElementMap }) {
  const hasElement = resourceElementMap && resourceElementMap[slot.resource_name]
  const modifiers = slot.modifiers || []

  return (
    <button
      onClick={() => onSelect(slot.resource_name)}
      className={`flex-shrink-0 w-64 text-left rounded-lg p-4 transition-all duration-200 ${
        isSelected
          ? 'bg-cyan-500/10 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
          : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Gem className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-cyan-500/60'}`} />
          <span className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-100' : 'text-gray-200'}`}>
            {slot.resource_name}
          </span>
        </div>
        <span className="text-xs text-gray-500 shrink-0">&times;{slot.quantity}</span>
      </div>

      {slot.min_quality > 0 && (
        <p className="text-[10px] text-amber-400 font-mono mb-2">Min Quality: {slot.min_quality}</p>
      )}

      {modifiers.length > 0 && (
        <div className="space-y-1 border-t border-gray-700/50 pt-2">
          {modifiers.slice(0, 4).map((mod, i) => (
            <ModifierPreview key={i} mod={mod} />
          ))}
          {modifiers.length > 4 && (
            <p className="text-[10px] text-gray-600">+{modifiers.length - 4} more</p>
          )}
        </div>
      )}

      {hasElement && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-cyan-500/70">
          <span>Find sources</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </button>
  )
}

export default function MaterialSlots({ blueprint, selectedMaterial, onSelectMaterial, resourceElementMap }) {
  if (!blueprint) return null

  const slots = blueprint.slots || []

  return (
    <div className="space-y-4">
      {/* Collapsed blueprint summary */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/30 rounded-lg border border-gray-700/30">
        <div className="w-6 h-6 rounded-full bg-cyan-500/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400 text-xs font-bold shrink-0">1</div>
        <span className="text-sm text-cyan-300 font-medium">{blueprint.name}</span>
        <span className="text-xs text-gray-500">
          {TYPE_LABELS[blueprint.type] || blueprint.type} &middot; {formatTime(blueprint.craft_time_seconds)}
        </span>
      </div>

      {/* Stage connector */}
      <div className="flex justify-center">
        <div className="w-px h-6 bg-gradient-to-b from-cyan-500/40 to-cyan-500/10" />
      </div>

      {/* Stage 2 header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-sm font-bold shrink-0">2</div>
        <div>
          <h3 className="font-display font-bold text-white tracking-wide text-sm uppercase">Material Requirements</h3>
          <p className="text-xs font-mono text-gray-500">{slots.length} material{slots.length !== 1 ? 's' : ''} needed &mdash; click to find mining sources</p>
        </div>
      </div>

      {/* Horizontal scrollable material cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {slots.map((slot, i) => (
          <MaterialCard
            key={i}
            slot={slot}
            isSelected={selectedMaterial === slot.resource_name}
            onSelect={onSelectMaterial}
            resourceElementMap={resourceElementMap}
          />
        ))}
      </div>
    </div>
  )
}
