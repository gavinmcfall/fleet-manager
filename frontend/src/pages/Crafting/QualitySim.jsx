import React, { useState, useMemo } from 'react'
import { Gem } from 'lucide-react'
import {
  interpolateModifier, multiplierToImprovement, formatImprovementWithWord,
  getStatLabel,
  resourceColor, resourceBgColor, resourceBorderColor,
  computeActualValue, formatActualValue, computeDPS,
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

// Format the description column — shows improvement % with word
function formatDescription(statKey, improvement) {
  if (Math.abs(improvement) < 0.05) return 'no change'
  const sign = improvement > 0 ? '+' : ''
  return `${sign}${improvement.toFixed(1)}% ${formatImprovementWithWord(statKey, improvement).replace(/^\d+%\s*/, '')}`
}

export default function QualitySim({ blueprint }) {
  const slots = blueprint.slots || []

  const [qualities, setQualities] = useState(() =>
    Object.fromEntries(slots.map((s, i) => [i, 500]))
  )

  const setSlotQuality = (index, value) => {
    setQualities(prev => ({ ...prev, [index]: value }))
  }

  const baseStats = blueprint.base_stats || null

  // Compute multipliers for each stat
  const { statPreview, dmgMultiplier, rpmMultiplier } = useMemo(() => {
    const statMap = new Map()

    slots.forEach((slot, slotIndex) => {
      if (!slot.modifiers) return
      slot.modifiers.forEach(mod => {
        const key = mod.key || mod.name
        if (!statMap.has(key)) {
          statMap.set(key, { name: mod.name, key, crafted: 1 })
        }
        const entry = statMap.get(key)
        entry.crafted *= interpolateModifier(mod, qualities[slotIndex] || 0)
      })
    })

    const dmg = statMap.get('weapon_damage')?.crafted ?? 1
    const rpm = statMap.get('weapon_firerate')?.crafted ?? 1

    const preview = [...statMap.values()].map(stat => ({
      key: stat.key,
      name: stat.name,
      improvement: multiplierToImprovement(stat.key, stat.crafted),
      actualValues: computeActualValue(stat.key, baseStats, stat.crafted),
      multiplier: stat.crafted,
    }))

    return { statPreview: preview, dmgMultiplier: dmg, rpmMultiplier: rpm }
  }, [slots, qualities, baseStats])

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No material slots to simulate.</p>
      </div>
    )
  }

  // Build table rows
  const rows = []

  // Modified stats first (damage, fire rate)
  for (const stat of statPreview) {
    if (stat.actualValues) {
      rows.push({
        label: getStatLabel(stat.key, stat.name),
        base: `${formatActualValue(stat.actualValues.base, stat.actualValues.decimals)} ${stat.actualValues.unit}`,
        crafted: `${formatActualValue(stat.actualValues.crafted, stat.actualValues.decimals)} ${stat.actualValues.unit}`,
        description: formatDescription(stat.key, stat.improvement),
        modified: true,
        _improvement: stat.improvement,
      })
    }
  }

  // DPS (derived)
  if (baseStats?.dps) {
    const craftedDPS = computeDPS(
      (baseStats.damage || 0) * dmgMultiplier,
      (baseStats.rounds_per_minute || 0) * rpmMultiplier
    )
    if (craftedDPS) {
      const improvement = ((craftedDPS / baseStats.dps) - 1) * 100
      rows.push({
        label: 'DPS',
        base: formatActualValue(baseStats.dps, 1),
        crafted: formatActualValue(craftedDPS, 1),
        description: Math.abs(improvement) < 0.05 ? 'no change' : `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`,
        modified: true,
        _improvement: improvement,
      })
    }
  }

  // Unmodified base stats
  if (baseStats?.spread_min != null && baseStats?.spread_max != null) {
    rows.push({ label: 'Spread', base: `${formatActualValue(baseStats.spread_min, 1)} – ${formatActualValue(baseStats.spread_max, 1)}`, crafted: '', description: '' })
  }
  if (baseStats?.effective_range != null) {
    rows.push({ label: 'Effective Range', base: `${formatActualValue(baseStats.effective_range, 0)} m`, crafted: '', description: '' })
  }
  if (baseStats?.projectile_speed != null) {
    rows.push({ label: 'Projectile Speed', base: `${formatActualValue(baseStats.projectile_speed, 0)} m/s`, crafted: '', description: '' })
  }
  if (baseStats?.ammo_capacity != null) {
    rows.push({ label: 'Ammo', base: `${formatActualValue(baseStats.ammo_capacity, 0)} rds`, crafted: '', description: '' })
  }

  // Multiplier-only stats (recoil)
  for (const stat of statPreview) {
    if (!stat.actualValues) {
      rows.push({
        label: getStatLabel(stat.key, stat.name),
        base: 'Base',
        crafted: `×${stat.multiplier.toFixed(3)}`,
        description: formatDescription(stat.key, stat.improvement),
        modified: true,
        _improvement: stat.improvement,
      })
    }
  }

  // Color helper for improvement values
  const improvementColor = (imp) => {
    if (Math.abs(imp) < 0.05) return { text: 'text-gray-500', glow: '' }
    if (imp > 5) return { text: 'text-sc-accent', glow: 'rgba(34,211,238,0.3)' }
    if (imp > 0) return { text: 'text-amber-400', glow: 'rgba(245,158,11,0.3)' }
    return { text: 'text-red-400', glow: 'rgba(239,68,68,0.3)' }
  }

  // Assign colors to each row
  for (const row of rows) {
    row.colors = row.modified ? improvementColor(row._improvement ?? 0) : { text: 'text-gray-600', glow: '' }
  }

  // Static info rows
  const infoRows = []
  if (baseStats?.damage_type) infoRows.push({ label: 'Damage Type', value: baseStats.damage_type })
  if (baseStats?.fire_modes) infoRows.push({ label: 'Fire Modes', value: baseStats.fire_modes })

  return (
    <div className="space-y-5">
      {/* Quality sliders — full width */}
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

      {/* Stats table */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02]">
              <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Stat</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Base Value</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Crafted Value</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const c = row.colors
              return (
                <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2 text-xs text-gray-300 font-medium">{row.label}</td>
                  <td className="px-4 py-2 text-xs font-mono text-gray-400">{row.base}</td>
                  <td className="px-4 py-2 text-xs font-mono">
                    {row.crafted ? (
                      <span
                        className={row.modified ? c.text : 'text-gray-600'}
                        style={c.glow ? { textShadow: `0 0 8px ${c.glow}` } : undefined}
                      >
                        {row.crafted}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {row.description ? (
                      <span
                        className={row.modified ? c.text : 'text-gray-600'}
                        style={c.glow ? { textShadow: `0 0 6px ${c.glow}` } : undefined}
                      >
                        {row.description}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {/* Static info rows — span columns */}
            {infoRows.map((row, i) => (
              <tr key={`info-${i}`} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-2 text-xs text-gray-300 font-medium">{row.label}</td>
                <td colSpan={3} className="px-4 py-2 text-xs text-gray-400">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
