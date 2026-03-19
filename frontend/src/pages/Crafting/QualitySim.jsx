import React, { useState, useMemo } from 'react'
import { Gem } from 'lucide-react'
import {
  interpolateModifier, multiplierToImprovement, formatImprovementWithWord, formatImprovementPct,
  getStatLabel, getStatDescription,
  resourceColor, resourceBgColor, resourceBorderColor,
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

function StatRow({ statKey, fallbackName, worstImprovement, currentImprovement, bestImprovement }) {
  const label = getStatLabel(statKey, fallbackName)
  const description = getStatDescription(statKey)

  // Progress: how much of the max improvement are we getting? (0–1)
  const totalRange = bestImprovement - worstImprovement
  const progress = Math.abs(totalRange) > 0.01
    ? (currentImprovement - worstImprovement) / totalRange
    : 0.5
  const progressPct = Math.round(progress * 100)

  // Color: red at Q0 side, amber mid, cyan at Q1000 side
  const barColor = progress > 0.6 ? 'bg-sc-accent' : progress > 0.3 ? 'bg-amber-400' : 'bg-red-400'
  const textColor = progress > 0.6 ? 'text-sc-accent' : progress > 0.3 ? 'text-amber-400' : 'text-red-400'
  const glowColor = progress > 0.6 ? 'rgba(34,211,238,0.3)' : progress > 0.3 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'

  return (
    <div className="group py-2.5 border-b border-white/[0.03] last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-300 font-medium">{label}</span>
          {description && (
            <span className="text-[10px] text-gray-600 block opacity-0 group-hover:opacity-100 transition-opacity">
              {description}
            </span>
          )}
        </div>
        <span
          className={`text-sm font-bold ${textColor}`}
          style={{ textShadow: `0 0 8px ${glowColor}` }}
        >
          {formatImprovementWithWord(statKey, currentImprovement)}
        </span>
      </div>
      {/* Progress bar: worst → best */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-red-400/60 w-12">
          {formatImprovementPct(worstImprovement)}
        </span>
        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-200`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-[10px] text-sc-accent/60 w-12 text-right">
          {formatImprovementPct(bestImprovement)}
        </span>
      </div>
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

  // Compute improvement values for each stat
  const statPreview = useMemo(() => {
    const statMap = new Map()

    slots.forEach((slot, slotIndex) => {
      if (!slot.modifiers) return
      slot.modifiers.forEach(mod => {
        const key = mod.key || mod.name
        if (!statMap.has(key)) {
          statMap.set(key, { name: mod.name, key, worst: 1, crafted: 1, best: 1 })
        }
        const entry = statMap.get(key)
        entry.worst *= mod.modifier_at_start
        entry.crafted *= interpolateModifier(mod, qualities[slotIndex] || 0)
        entry.best *= mod.modifier_at_end
      })
    })

    // Convert compounded multipliers → user-facing improvement percentages
    return [...statMap.values()]
      .map(stat => ({
        key: stat.key,
        name: stat.name,
        worstImprovement: multiplierToImprovement(stat.key, stat.worst),
        currentImprovement: multiplierToImprovement(stat.key, stat.crafted),
        bestImprovement: multiplierToImprovement(stat.key, stat.best),
      }))
      .sort((a, b) => Math.abs(b.bestImprovement) - Math.abs(a.bestImprovement))
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

      {/* Right: Stat effects */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Crafted vs Base</h4>
        <p className="text-[10px] text-gray-600 mb-3">
          How the crafted item compares to an unmodified weapon. Positive = better than stock.
        </p>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
          {statPreview.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No modifiers on this blueprint.</p>
          ) : (
            statPreview.map(stat => (
              <StatRow
                key={stat.key}
                statKey={stat.key}
                fallbackName={stat.name}
                worstImprovement={stat.worstImprovement}
                currentImprovement={stat.currentImprovement}
                bestImprovement={stat.bestImprovement}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
