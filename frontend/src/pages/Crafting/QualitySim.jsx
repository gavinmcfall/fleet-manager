import React, { useState, useMemo } from 'react'
import { Gem } from 'lucide-react'
import {
  interpolateModifier, multiplierToImprovement, formatImprovementWithWord, formatImprovementPct,
  getStatLabel, getStatDescription,
  resourceColor, resourceBgColor, resourceBorderColor,
  computeActualValue, formatActualValue, computeDPS, BASE_STAT_DISPLAY,
} from './craftingUtils'

function QualitySlider({ slot, value, onChange }) {
  const pct = (value / 1000) * 100
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">{slot.name}</span>
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
        <span className="text-xs font-mono text-sc-accent">{value}</span>
      </div>
      <div className="relative">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)' }}>
          <div className="h-full bg-transparent" />
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer"
          style={{ top: '0' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-sc-accent shadow-[0_0_6px_rgba(34,211,238,0.5)] pointer-events-none transition-all duration-100"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-600">
        <span>0</span>
        <span>1000</span>
      </div>
    </div>
  )
}

function progressColor(progress) {
  if (progress > 0.6) return {
    bar: 'bg-sc-accent', text: 'text-sc-accent',
    glow: 'rgba(34,211,238,0.3)',
  }
  if (progress > 0.3) return {
    bar: 'bg-amber-400', text: 'text-amber-400',
    glow: 'rgba(245,158,11,0.3)',
  }
  return {
    bar: 'bg-red-400', text: 'text-red-400',
    glow: 'rgba(239,68,68,0.3)',
  }
}

function StatRow({ statKey, fallbackName, worstImprovement, currentImprovement, bestImprovement, actualValues, multiplier }) {
  const label = getStatLabel(statKey, fallbackName)
  const description = getStatDescription(statKey)

  const totalRange = bestImprovement - worstImprovement
  const progress = Math.abs(totalRange) > 0.01
    ? (currentImprovement - worstImprovement) / totalRange
    : 0.5
  const progressPct = Math.round(progress * 100)
  const colors = progressColor(progress)

  return (
    <div className="group py-2 border-b border-white/[0.04] last:border-0">
      {/* Main row: label | base → crafted | improvement */}
      <div className="flex items-center gap-3">
        {/* Stat name */}
        <div className="w-28 shrink-0">
          <span className="text-xs text-gray-300 font-medium">{label}</span>
          {description && (
            <span className="text-[10px] text-gray-600 block opacity-0 group-hover:opacity-100 transition-opacity leading-tight">
              {description}
            </span>
          )}
        </div>

        {/* Base → Crafted values */}
        <div className="flex-1 min-w-0">
          {actualValues ? (
            <div className="flex items-baseline gap-1.5 font-mono text-xs">
              <span className="text-gray-500">{formatActualValue(actualValues.base, actualValues.decimals)}</span>
              <span className="text-gray-600">→</span>
              <span className={colors.text} style={{ textShadow: `0 0 6px ${colors.glow}` }}>
                {formatActualValue(actualValues.crafted, actualValues.decimals)}
              </span>
              <span className="text-gray-600 text-[10px]">{actualValues.unit}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 font-mono text-xs">
              <span className="text-gray-600">base</span>
              <span className="text-gray-600">×</span>
              <span className={colors.text} style={{ textShadow: `0 0 6px ${colors.glow}` }}>
                {multiplier.toFixed(3)}
              </span>
            </div>
          )}
        </div>

        {/* Improvement badge */}
        <div className="w-24 text-right shrink-0">
          <span
            className={`text-xs font-bold ${colors.text}`}
            style={{ textShadow: `0 0 8px ${colors.glow}` }}
          >
            {formatImprovementWithWord(statKey, currentImprovement)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mt-1">
        <div className="w-28 shrink-0" />
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[9px] text-red-400/50 w-8 tabular-nums">{formatImprovementPct(worstImprovement)}</span>
          <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${colors.bar} transition-all duration-200`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[9px] text-sc-accent/50 w-8 text-right tabular-nums">{formatImprovementPct(bestImprovement)}</span>
        </div>
        <div className="w-24 shrink-0" />
      </div>
    </div>
  )
}

function DPSRow({ baseStats, dmgMultiplier, rpmMultiplier }) {
  const baseDPS = baseStats?.dps
  if (!baseDPS) return null

  const craftedDPS = computeDPS(
    (baseStats.damage || 0) * dmgMultiplier,
    (baseStats.rounds_per_minute || 0) * rpmMultiplier
  )
  if (!craftedDPS) return null

  const improvement = ((craftedDPS / baseDPS) - 1) * 100
  const progress = Math.max(0, Math.min(1, improvement / 30))
  const colors = progressColor(progress)
  const word = improvement >= 0.05 ? 'more' : improvement <= -0.05 ? 'less' : ''
  const label = Math.abs(improvement) < 0.05 ? 'no change' : `${Math.abs(improvement).toFixed(0)}% ${word}`

  return (
    <div className="group py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-28 shrink-0">
          <span className="text-xs text-gray-300 font-medium">DPS</span>
          <span className="text-[10px] text-gray-600 block opacity-0 group-hover:opacity-100 transition-opacity leading-tight">
            Derived from damage × fire rate
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 font-mono text-xs">
            <span className="text-gray-500">{formatActualValue(baseDPS, 1)}</span>
            <span className="text-gray-600">→</span>
            <span className={colors.text} style={{ textShadow: `0 0 6px ${colors.glow}` }}>
              {formatActualValue(craftedDPS, 1)}
            </span>
            <span className="text-gray-600 text-[10px]">DPS</span>
          </div>
        </div>
        <div className="w-24 text-right shrink-0">
          <span
            className={`text-xs font-bold ${colors.text}`}
            style={{ textShadow: `0 0 8px ${colors.glow}` }}
          >
            {label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-28 shrink-0" />
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[9px] text-gray-600 w-8">&nbsp;</span>
          <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${colors.bar} transition-all duration-200`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-600 w-8">&nbsp;</span>
        </div>
        <div className="w-24 shrink-0" />
      </div>
    </div>
  )
}

function ReferenceStatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-gray-600">{label}</span>
      <span className="text-[11px] font-mono text-gray-500">{value}</span>
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

  const { statPreview, dmgMultiplier, rpmMultiplier } = useMemo(() => {
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

    const baseStats = blueprint.base_stats || null
    const dmg = statMap.get('weapon_damage')?.crafted ?? 1
    const rpm = statMap.get('weapon_firerate')?.crafted ?? 1

    const preview = [...statMap.values()]
      .map(stat => ({
        key: stat.key,
        name: stat.name,
        worstImprovement: multiplierToImprovement(stat.key, stat.worst),
        currentImprovement: multiplierToImprovement(stat.key, stat.crafted),
        bestImprovement: multiplierToImprovement(stat.key, stat.best),
        actualValues: computeActualValue(stat.key, baseStats, stat.crafted),
        multiplier: stat.crafted,
      }))
      .sort((a, b) => Math.abs(b.bestImprovement) - Math.abs(a.bestImprovement))

    return { statPreview: preview, dmgMultiplier: dmg, rpmMultiplier: rpm }
  }, [slots, qualities, blueprint.base_stats])

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No material slots to simulate.</p>
      </div>
    )
  }

  const baseStats = blueprint.base_stats || null
  const hasDPS = baseStats?.dps != null

  // Build reference stats (unmodified by crafting)
  const modifiedFields = new Set(['damage', 'rounds_per_minute', 'dps'])
  const referenceStats = baseStats
    ? BASE_STAT_DISPLAY.filter(s => {
        if (modifiedFields.has(s.field)) return false
        if (s.paired) return baseStats[s.field] != null && baseStats[s.paired] != null
        return baseStats[s.field] != null
      })
    : []

  return (
    <div className="space-y-5">
      {/* Top: Quality sliders — full width responsive grid */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-xs uppercase tracking-wider text-gray-500">Material Quality</h4>
          <span className="text-[10px] text-gray-600">Drag sliders to preview crafting effects</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

      {/* Bottom: Unified stats — base + crafted in one view */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1.5 border-b border-white/[0.06]">
          <span className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-gray-600">Stat</span>
          <span className="flex-1 text-[10px] uppercase tracking-wider text-gray-600">Base → Crafted</span>
          <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-gray-600 text-right">Effect</span>
        </div>

        {/* Dynamic stat rows */}
        <div className="px-4">
          {statPreview.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">No modifiers on this blueprint.</p>
          ) : (
            <>
              {statPreview.map(stat => (
                <StatRow
                  key={stat.key}
                  statKey={stat.key}
                  fallbackName={stat.name}
                  worstImprovement={stat.worstImprovement}
                  currentImprovement={stat.currentImprovement}
                  bestImprovement={stat.bestImprovement}
                  actualValues={stat.actualValues}
                  multiplier={stat.multiplier}
                />
              ))}
              {hasDPS && (
                <DPSRow
                  baseStats={baseStats}
                  dmgMultiplier={dmgMultiplier}
                  rpmMultiplier={rpmMultiplier}
                />
              )}
            </>
          )}
        </div>

        {/* Reference stats — unmodified by crafting */}
        {referenceStats.length > 0 && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 mb-1 block">Unmodified</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4">
              {referenceStats.map(s => (
                <ReferenceStatRow
                  key={s.field}
                  label={s.label}
                  value={
                    s.paired
                      ? `${formatActualValue(baseStats[s.field], s.decimals)}–${formatActualValue(baseStats[s.paired], s.decimals)}`
                      : `${formatActualValue(baseStats[s.field], s.decimals)}${s.unit ? ` ${s.unit}` : ''}`
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
