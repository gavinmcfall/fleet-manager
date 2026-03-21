import React, { useMemo } from 'react'
import { ArrowUp, ArrowDown, Zap, Shield, Crosshair, Thermometer, Gauge } from 'lucide-react'

/**
 * Stats panel with grouped sections: DPS, Shields, Power Budget, Cooling, Quantum.
 * Shows stock→custom diff with color-coded arrows.
 */
export default function StatsPanel({ stockComponents, overrides }) {
  const stock = useMemo(() => aggregateStats(stockComponents, {}), [stockComponents])
  const custom = useMemo(() => aggregateStats(stockComponents, overrides), [stockComponents, overrides])

  if (!stockComponents) return null
  const hasChanges = Object.keys(overrides).length > 0

  return (
    <div className="p-4 space-y-4">
      {/* DPS Section */}
      <StatsSection icon={Crosshair} title="Firepower" color="text-red-400">
        <StatRow label="Total DPS" stock={stock.dps} custom={custom.dps} hasChanges={hasChanges} large />
        <div className="grid grid-cols-2 gap-x-3">
          <StatRow label="Ballistic" stock={stock.ballisticDps} custom={custom.ballisticDps} hasChanges={hasChanges} />
          <StatRow label="Energy" stock={stock.energyDps} custom={custom.energyDps} hasChanges={hasChanges} />
        </div>
        <StatRow label="Alpha Damage" stock={stock.alpha} custom={custom.alpha} hasChanges={hasChanges} />
      </StatsSection>

      {/* Shields Section */}
      <StatsSection icon={Shield} title="Shields" color="text-sky-400">
        <StatRow label="Shield HP" stock={stock.shieldHp} custom={custom.shieldHp} hasChanges={hasChanges} large />
        <StatRow label="Regen Rate" stock={stock.shieldRegen} custom={custom.shieldRegen} hasChanges={hasChanges} suffix="/s" />
        {(custom.resistPhys || custom.resistEnergy || custom.resistDist) && (
          <div className="mt-2 space-y-1">
            <ResistBar label="Physical" value={custom.resistPhys} stockValue={stock.resistPhys} hasChanges={hasChanges} color="bg-amber-500" />
            <ResistBar label="Energy" value={custom.resistEnergy} stockValue={stock.resistEnergy} hasChanges={hasChanges} color="bg-sky-500" />
            <ResistBar label="Distortion" value={custom.resistDist} stockValue={stock.resistDist} hasChanges={hasChanges} color="bg-purple-500" />
          </div>
        )}
      </StatsSection>

      {/* Power Budget Section */}
      <StatsSection icon={Zap} title="Power" color="text-amber-400">
        <PowerBudget output={custom.power} draw={custom.powerDraw} stockOutput={stock.power} stockDraw={stock.powerDraw} hasChanges={hasChanges} />
      </StatsSection>

      {/* Cooling Section */}
      <StatsSection icon={Thermometer} title="Cooling" color="text-cyan-400">
        <StatRow label="Cooling Rate" stock={stock.cooling} custom={custom.cooling} hasChanges={hasChanges} suffix="/s" />
      </StatsSection>

      {/* Quantum Section */}
      <StatsSection icon={Gauge} title="Quantum" color="text-violet-400">
        <StatRow label="Speed" stock={stock.qtSpeed} custom={custom.qtSpeed} hasChanges={hasChanges} scale={1000000} suffix=" Mm/s" />
        <StatRow label="Range" stock={stock.qtRange} custom={custom.qtRange} hasChanges={hasChanges} scale={1000} suffix=" km" />
        <StatRow label="Fuel Rate" stock={stock.qtFuelRate} custom={custom.qtFuelRate} hasChanges={hasChanges} invert />
        <StatRow label="Spool Time" stock={stock.qtSpool} custom={custom.qtSpool} hasChanges={hasChanges} scale={1000} suffix="s" invert />
      </StatsSection>
    </div>
  )
}

function StatsSection({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-zinc-800/30 rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-zinc-700/30 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {children}
      </div>
    </div>
  )
}

function StatRow({ label, stock, custom, hasChanges, large, suffix = '', scale = 1, invert = false }) {
  const sv = scale !== 1 ? (stock || 0) / scale : (stock || 0)
  const cv = scale !== 1 ? (custom || 0) / scale : (custom || 0)
  const diff = cv - sv
  const isChanged = hasChanges && Math.abs(diff) > 0.01
  const isImproved = invert ? diff < -0.01 : diff > 0.01
  const isWorse = invert ? diff > 0.01 : diff < -0.01

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`${large ? 'text-xs font-medium text-zinc-300' : 'text-[11px] text-zinc-500'}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {isChanged && (
          <>
            <span className="text-[10px] text-zinc-600 line-through">{fmtNum(sv)}{suffix}</span>
            <span className="text-zinc-600">→</span>
          </>
        )}
        <span className={`${large ? 'text-sm font-semibold' : 'text-xs'} font-mono
          ${isChanged ? (isImproved ? 'text-emerald-400' : isWorse ? 'text-red-400' : 'text-zinc-200') : 'text-zinc-200'}`}>
          {fmtNum(cv)}{suffix}
        </span>
        {isChanged && (
          <span className={`text-[10px] ${isImproved ? 'text-emerald-500' : 'text-red-500'}`}>
            {isImproved ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />}
          </span>
        )}
      </div>
    </div>
  )
}

function ResistBar({ label, value, stockValue, hasChanges, color }) {
  const pct = ((value || 0) * 100)
  const stockPct = ((stockValue || 0) * 100)
  const isChanged = hasChanges && Math.abs(pct - stockPct) > 0.1

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-16">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-700/50 rounded-full overflow-hidden relative">
        {isChanged && stockPct > 0 && (
          <div className="absolute h-full bg-zinc-600 rounded-full" style={{ width: `${Math.min(stockPct, 100)}%` }} />
        )}
        <div className={`absolute h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-10 text-right ${isChanged ? (pct > stockPct ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-400'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function PowerBudget({ output, draw, stockOutput, stockDraw, hasChanges }) {
  const pct = output > 0 ? Math.min((draw / output) * 100, 100) : 0
  const stockPct = stockOutput > 0 ? Math.min((stockDraw / stockOutput) * 100, 100) : 0
  const isOverBudget = draw > output

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Output</span>
        <span className="font-mono text-zinc-200">{fmtNum(output)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Draw</span>
        <span className={`font-mono ${isOverBudget ? 'text-red-400' : 'text-zinc-200'}`}>{fmtNum(draw)}</span>
      </div>
      <div className="h-2 bg-zinc-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className={isOverBudget ? 'text-red-400 font-medium' : 'text-zinc-500'}>{pct.toFixed(0)}% used</span>
        {hasChanges && Math.abs(pct - stockPct) > 0.5 && (
          <span className="text-zinc-600">was {stockPct.toFixed(0)}%</span>
        )}
      </div>
    </div>
  )
}

function aggregateStats(stockComponents, overrides) {
  let power = 0, powerDraw = 0, cooling = 0
  let shieldHp = 0, shieldRegen = 0, resistPhys = 0, resistEnergy = 0, resistDist = 0, shieldCount = 0
  let dps = 0, ballisticDps = 0, energyDps = 0, alpha = 0
  let qtSpeed = 0, qtRange = 0, qtFuelRate = 0, qtSpool = 0

  if (!stockComponents) return { power, powerDraw, cooling, shieldHp, shieldRegen, resistPhys, resistEnergy, resistDist, dps, ballisticDps, energyDps, alpha, qtSpeed, qtRange, qtFuelRate, qtSpool }

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
      resistPhys += Number(data.resist_physical) || 0
      resistEnergy += Number(data.resist_energy) || 0
      resistDist += Number(data.resist_distortion) || 0
      shieldCount++
    } else if (pt === 'weapon' || pt === 'turret') {
      const d = Number(data.dps) || 0
      dps += d
      alpha += Number(data.damage_per_shot) || 0
      const dmgType = (data.damage_type || '').toLowerCase()
      if (dmgType.includes('ballistic') || dmgType.includes('physical')) {
        ballisticDps += d
      } else {
        energyDps += d
      }
    } else if (pt === 'quantum_drive') {
      qtSpeed = Math.max(qtSpeed, Number(data.quantum_speed) || 0)
      qtRange = Math.max(qtRange, Number(data.quantum_range) || 0)
      qtFuelRate = Number(data.fuel_rate) || 0
      qtSpool = Number(data.spool_time) || 0
    }

    if (pt !== 'power') {
      powerDraw += Number(data.power_draw) || 0
    }
  }

  // Average shield resistances
  if (shieldCount > 0) {
    resistPhys /= shieldCount
    resistEnergy /= shieldCount
    resistDist /= shieldCount
  }

  return { power, powerDraw, cooling, shieldHp, shieldRegen, resistPhys, resistEnergy, resistDist, dps, ballisticDps, energyDps, alpha, qtSpeed, qtRange, qtFuelRate, qtSpool }
}

function fmtNum(v) {
  const n = Number(v)
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
