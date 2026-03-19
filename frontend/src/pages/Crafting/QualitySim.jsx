import React, { useState, useMemo } from 'react'
import { Gem } from 'lucide-react'
import {
  interpolateModifier, formatModifierChange,
  resourceColor, resourceBgColor, resourceBorderColor,
  STAT_DESCRIPTIONS,
} from './craftingUtils'

function QualitySlider({ slot, value, onChange }) {
  const pct = (value / 1000) * 100
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">{slot.name}</span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
            style={{
              backgroundColor: resourceBgColor(slot.resource_name),
              borderColor: resourceBorderColor(slot.resource_name),
              color: resourceColor(slot.resource_name),
            }}
          >
            <Gem className="w-2.5 h-2.5" />
            {slot.resource_name}
          </span>
        </div>
        <span className="text-sm font-mono text-sc-accent">{value}</span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)' }}>
          <div className="h-full bg-transparent" />
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
          style={{ top: '0' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-sc-accent shadow-[0_0_6px_rgba(34,211,238,0.5)] pointer-events-none transition-all duration-100"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-600">
        <span>0 (worst)</span>
        <span>500</span>
        <span>1000 (best)</span>
      </div>
    </div>
  )
}

function StatRow({ name, statKey, baseMultiplier, craftedMultiplier, bestMultiplier }) {
  const baseChange = formatModifierChange(baseMultiplier)
  const craftedChange = formatModifierChange(craftedMultiplier)
  const isChanged = Math.abs(craftedMultiplier - baseMultiplier) > 0.0001
  const description = STAT_DESCRIPTIONS[statKey]

  // Color based on how close to best (Q1000) outcome
  const totalRange = bestMultiplier - baseMultiplier
  const progress = Math.abs(totalRange) > 0.0001
    ? (craftedMultiplier - baseMultiplier) / totalRange
    : 0.5
  // 0 = worst (Q0), 1 = best (Q1000)
  const colorClass = !isChanged ? 'text-gray-400'
    : progress > 0.6 ? 'text-sc-accent'
    : progress > 0.3 ? 'text-amber-400'
    : 'text-red-400'
  const glowColor = !isChanged ? undefined
    : progress > 0.6 ? 'rgba(34,211,238,0.3)'
    : progress > 0.3 ? 'rgba(245,158,11,0.3)'
    : 'rgba(239,68,68,0.3)'

  return (
    <div className="group flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-400 truncate block">{name}</span>
        {description && (
          <span className="text-[10px] text-gray-600 truncate block opacity-0 group-hover:opacity-100 transition-opacity">
            {description}
          </span>
        )}
      </div>
      <span className="text-xs text-red-400/70 font-mono w-16 text-right">
        {baseChange}
      </span>
      <span className="text-gray-600">→</span>
      <span
        className={`text-xs font-mono w-16 text-right font-medium ${colorClass}`}
        style={glowColor ? { textShadow: `0 0 8px ${glowColor}` } : undefined}
      >
        {craftedChange}
      </span>
    </div>
  )
}

export default function QualitySim({ blueprint }) {
  const slots = blueprint.slots || []

  const [qualities, setQualities] = useState(() =>
    Object.fromEntries(slots.map((s, i) => [i, 500]))
  )

  const setSlotQuality = (index, value) => {
    setQualities(prev => ({ ...prev, [index]: value }))
  }

  // Compute all unique modifiers across all slots
  const statPreview = useMemo(() => {
    const statMap = new Map()

    slots.forEach((slot, slotIndex) => {
      if (!slot.modifiers) return
      slot.modifiers.forEach(mod => {
        const key = mod.key || mod.name
        if (!statMap.has(key)) {
          statMap.set(key, { name: mod.name, key, base: 1, crafted: 1, best: 1 })
        }
        const entry = statMap.get(key)
        // Multipliers compound across slots
        entry.base *= mod.modifier_at_start
        entry.crafted *= interpolateModifier(mod, qualities[slotIndex] || 0)
        entry.best *= mod.modifier_at_end  // Q1000 = best possible
      })
    })

    return [...statMap.values()].sort((a, b) => {
      const aDiff = Math.abs(a.crafted - a.base)
      const bDiff = Math.abs(b.crafted - b.base)
      return bDiff - aDiff
    })
  }, [slots, qualities])

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No material slots to simulate.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Quality sliders */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Material Quality</h4>
        <p className="text-[10px] text-gray-600 mb-3">
          Higher quality resources produce better stats. Drag to preview the effect.
        </p>
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <QualitySlider
              key={i}
              slot={slot}
              value={qualities[i] || 0}
              onChange={v => setSlotQuality(i, v)}
            />
          ))}
        </div>
      </div>

      {/* Right: Stat preview */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Combined Stat Effect</h4>
        <p className="text-[10px] text-gray-600 mb-3">
          Shows the combined change to each stat vs the base weapon. Hover stats for descriptions.
        </p>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
          {statPreview.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No modifiers on this blueprint.</p>
          ) : (
            <div>
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-white/[0.06]">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 flex-1">Stat</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-600 w-16 text-right">Q0</span>
                <span className="w-4" />
                <span className="text-[10px] uppercase tracking-wider text-gray-600 w-16 text-right">Current</span>
              </div>
              {statPreview.map(stat => (
                <StatRow
                  key={stat.key}
                  name={stat.name}
                  statKey={stat.key}
                  baseMultiplier={stat.base}
                  craftedMultiplier={stat.crafted}
                  bestMultiplier={stat.best}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
