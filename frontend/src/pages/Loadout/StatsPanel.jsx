import React, { useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

/**
 * Aggregate stats panel showing stock vs custom comparison.
 * Calculates totals for: power budget, cooling, shield HP, shield regen, total DPS, QT speed.
 */
export default function StatsPanel({ stockComponents, overrides, slug }) {
  const stats = useMemo(() => {
    if (!stockComponents) return null

    const stock = aggregateStats(stockComponents, {})
    const custom = aggregateStats(stockComponents, overrides)

    return {
      power: { label: 'Power Output', stock: stock.power, custom: custom.power, unit: '' },
      powerDraw: { label: 'Power Draw', stock: stock.powerDraw, custom: custom.powerDraw, unit: '', invert: true },
      cooling: { label: 'Cooling Rate', stock: stock.cooling, custom: custom.cooling, unit: '/s' },
      shieldHp: { label: 'Shield HP', stock: stock.shieldHp, custom: custom.shieldHp, unit: '' },
      shieldRegen: { label: 'Shield Regen', stock: stock.shieldRegen, custom: custom.shieldRegen, unit: '/s' },
      dps: { label: 'Total DPS', stock: stock.dps, custom: custom.dps, unit: '' },
      qtSpeed: { label: 'QT Speed', stock: stock.qtSpeed, custom: custom.qtSpeed, unit: ' Mm/s', scale: 1000000 },
      qtRange: { label: 'QT Range', stock: stock.qtRange, custom: custom.qtRange, unit: ' km', scale: 1000 },
    }
  }, [stockComponents, overrides])

  if (!stats) return null

  const hasChanges = Object.keys(overrides).length > 0

  return (
    <div className="p-4">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
        Ship Stats
        {hasChanges && <span className="ml-2 text-sky-400 normal-case tracking-normal">(customized)</span>}
      </h3>

      <div className="space-y-2">
        {Object.entries(stats).map(([key, stat]) => {
          const stockVal = stat.scale ? stat.stock / stat.scale : stat.stock
          const customVal = stat.scale ? stat.custom / stat.scale : stat.custom
          const diff = customVal - stockVal
          const pctChange = stockVal > 0 ? ((customVal - stockVal) / stockVal) * 100 : 0
          const isChanged = Math.abs(diff) > 0.01
          // For "invert" stats (like power draw), lower is better
          const isImproved = stat.invert ? diff < -0.01 : diff > 0.01
          const isWorse = stat.invert ? diff > 0.01 : diff < -0.01

          return (
            <div key={key} className="flex items-center justify-between px-3 py-2 rounded bg-zinc-800/30">
              <span className="text-sm text-zinc-400">{stat.label}</span>
              <div className="flex items-center gap-2">
                {isChanged && hasChanges ? (
                  <>
                    <span className="text-xs text-zinc-600 line-through">
                      {formatNum(stockVal)}{stat.unit}
                    </span>
                    <span className="text-sm text-zinc-100">→</span>
                    <span className={`text-sm font-medium ${isImproved ? 'text-emerald-400' : isWorse ? 'text-red-400' : 'text-zinc-200'}`}>
                      {formatNum(customVal)}{stat.unit}
                    </span>
                    <span className={`text-[10px] flex items-center gap-0.5 ${isImproved ? 'text-emerald-500' : 'text-red-500'}`}>
                      {isImproved ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(pctChange).toFixed(0)}%
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-zinc-200">{formatNum(customVal)}{stat.unit}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Resistance summary for shields */}
      {hasChanges && <ResistanceSummary stockComponents={stockComponents} overrides={overrides} />}
    </div>
  )
}

function ResistanceSummary({ stockComponents, overrides }) {
  const resistances = useMemo(() => {
    const getShieldResist = (comps, ovr) => {
      const shieldPorts = comps.filter(c => c.port_type === 'shield')
      if (shieldPorts.length === 0) return null
      // Use the first shield (most ships have one)
      const shield = shieldPorts[0]
      const override = ovr[shield.port_id]
      const data = override || shield
      return {
        physical: data.resist_physical,
        energy: data.resist_energy,
        distortion: data.resist_distortion,
      }
    }

    const stock = getShieldResist(stockComponents, {})
    const custom = getShieldResist(stockComponents, overrides)
    if (!stock || !custom) return null

    return { stock, custom }
  }, [stockComponents, overrides])

  if (!resistances) return null

  const types = [
    { key: 'physical', label: 'Physical' },
    { key: 'energy', label: 'Energy' },
    { key: 'distortion', label: 'Distortion' },
  ]

  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Shield Resistances</h4>
      <div className="space-y-1">
        {types.map(({ key, label }) => {
          const stockVal = resistances.stock[key]
          const customVal = resistances.custom[key]
          if (stockVal == null && customVal == null) return null
          const isChanged = stockVal !== customVal
          const isImproved = (customVal || 0) > (stockVal || 0)

          return (
            <div key={key} className="flex items-center justify-between px-3 py-1.5 rounded bg-zinc-800/20 text-xs">
              <span className="text-zinc-500">{label}</span>
              <div className="flex items-center gap-2">
                {isChanged ? (
                  <>
                    <span className="text-zinc-600">{fmtPct(stockVal)}</span>
                    <span className="text-zinc-500">→</span>
                    <span className={isImproved ? 'text-emerald-400' : 'text-red-400'}>{fmtPct(customVal)}</span>
                  </>
                ) : (
                  <span className="text-zinc-300">{fmtPct(customVal)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function aggregateStats(stockComponents, overrides) {
  let power = 0, powerDraw = 0, cooling = 0, shieldHp = 0, shieldRegen = 0, dps = 0, qtSpeed = 0, qtRange = 0

  for (const comp of stockComponents) {
    const data = overrides[comp.port_id] || comp
    const pt = comp.port_type

    if (pt === 'power') {
      power += Number(data.power_output) || 0
    } else if (pt === 'cooler') {
      cooling += Number(data.cooling_rate) || 0
    } else if (pt === 'shield') {
      shieldHp += Number(data.shield_hp) || 0
      shieldRegen += Number(data.shield_regen) || 0
    } else if (pt === 'weapon' || pt === 'turret') {
      dps += Number(data.dps) || 0
    } else if (pt === 'quantum_drive') {
      qtSpeed = Math.max(qtSpeed, Number(data.quantum_speed) || 0)
      qtRange = Math.max(qtRange, Number(data.quantum_range) || 0)
    }

    // Accumulate power draw for non-power components
    if (pt !== 'power') {
      powerDraw += Number(data.power_draw) || 0
    }
  }

  return { power, powerDraw, cooling, shieldHp, shieldRegen, dps, qtSpeed, qtRange }
}

function formatNum(v) {
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : 1 })
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}
