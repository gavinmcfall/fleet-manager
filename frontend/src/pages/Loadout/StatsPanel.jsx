import React, { useMemo } from 'react'
import { ArrowUp, ArrowDown, Zap, Shield, Crosshair, Thermometer, Gauge, Weight, Radio } from 'lucide-react'

export default function StatsPanel({ stockComponents, overrides, horizontal }) {
  const stock = useMemo(() => aggregateStats(stockComponents, {}), [stockComponents])
  const custom = useMemo(() => aggregateStats(stockComponents, overrides), [stockComponents, overrides])

  if (!stockComponents) return null
  const hasChanges = Object.keys(overrides).length > 0
  // F502: when power + cooling + shieldHp + qtSpeed are all zero, this ship
  // has no equipped components in its default loadout — the extractor didn't
  // populate `equipped_item_uuid` on its power/cooler/shield/quantum ports.
  // 140 ships affected on staging (2026-04-20). Show a banner so players
  // understand the gap instead of assuming the site is broken.
  const noDefaultsData = stock.power === 0 && stock.cooling === 0
    && stock.shieldHp === 0 && stock.qtSpeed === 0

  return (
    <div className={horizontal ? 'px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]' : 'p-4 space-y-4'}>
      {noDefaultsData && (
        <div className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          Default component data isn't populated for this ship yet — stats will read 0 until the next pipeline refresh.
          You can still equip components manually to see computed totals.
        </div>
      )}
      <div className={horizontal ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3' : 'space-y-4'}>

      <StatsSection icon={Crosshair} title="Firepower" color="text-red-400">
        <StatRow label="Total DPS" stock={stock.dps} custom={custom.dps} hasChanges={hasChanges} large />
        <div className="grid grid-cols-2 gap-x-3">
          <StatRow label="Ballistic" stock={stock.ballisticDps} custom={custom.ballisticDps} hasChanges={hasChanges} />
          <StatRow label="Energy" stock={stock.energyDps} custom={custom.energyDps} hasChanges={hasChanges} />
        </div>
        <StatRow label="Alpha" stock={stock.alpha} custom={custom.alpha} hasChanges={hasChanges} />
      </StatsSection>

      <StatsSection icon={Shield} title="Shields" color="text-sky-400">
        <StatRow label="Shield HP" stock={stock.shieldHp} custom={custom.shieldHp} hasChanges={hasChanges} large />
        <StatRow label="Regen" stock={stock.shieldRegen} custom={custom.shieldRegen} hasChanges={hasChanges} suffix="/s" />
        {(custom.resistPhys || custom.resistEnergy || custom.resistDist) && (
          <div className="mt-1.5 space-y-1">
            <ResistBar label="Phys" value={custom.resistPhys} stockValue={stock.resistPhys} hasChanges={hasChanges} color="bg-amber-500" />
            <ResistBar label="Enrg" value={custom.resistEnergy} stockValue={stock.resistEnergy} hasChanges={hasChanges} color="bg-sc-accent" />
            <ResistBar label="Dist" value={custom.resistDist} stockValue={stock.resistDist} hasChanges={hasChanges} color="bg-purple-500" />
          </div>
        )}
      </StatsSection>

      <StatsSection icon={Zap} title="Power" color="text-amber-400">
        <PowerBudget output={custom.power} draw={custom.powerDraw} idleDraw={custom.powerDrawMin} stockOutput={stock.power} stockDraw={stock.powerDraw} hasChanges={hasChanges} />
      </StatsSection>

      <StatsSection icon={Thermometer} title="Cooling" color="text-cyan-400">
        <StatRow label="Cooling Rate" stock={stock.cooling} custom={custom.cooling} hasChanges={hasChanges} suffix="/s" />
        <StatRow label="Heat Output" stock={stock.thermalOutput} custom={custom.thermalOutput} hasChanges={hasChanges} suffix="/s" invert />
      </StatsSection>

      <StatsSection icon={Gauge} title="Quantum" color="text-violet-400">
        <StatRow label="Speed" stock={stock.qtSpeed} custom={custom.qtSpeed} hasChanges={hasChanges} scale={1000000} suffix=" Mm/s" />
        <StatRow label="Range" stock={stock.qtRange} custom={custom.qtRange} hasChanges={hasChanges} scale={1000} suffix=" km" />
        <StatRow label="Fuel" stock={stock.qtFuelRate} custom={custom.qtFuelRate} hasChanges={hasChanges} invert />
        <StatRow label="Spool" stock={stock.qtSpool} custom={custom.qtSpool} hasChanges={hasChanges} scale={1000} suffix="s" invert />
      </StatsSection>

      {(stock.totalMass > 0 || stock.totalEmSig > 0) && (
        <StatsSection icon={Radio} title="Signature" color="text-gray-400">
          <StatRow label="Component Mass" stock={stock.totalMass} custom={custom.totalMass} hasChanges={hasChanges} suffix=" kg" invert />
          <StatRow label="EM Signature" stock={stock.totalEmSig} custom={custom.totalEmSig} hasChanges={hasChanges} invert />
        </StatsSection>
      )}

      </div>
    </div>
  )
}

function StatsSection({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-1 border-b border-white/[0.06] ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-3 py-1.5 space-y-0.5">
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

  const valueColor = isChanged
    ? (isImproved ? 'text-sc-accent' : isWorse ? 'text-red-400' : 'text-gray-300')
    : 'text-gray-300'
  const glowStyle = isChanged && isImproved
    ? { textShadow: '0 0 8px rgba(34,211,238,0.3)' }
    : isChanged && isWorse
    ? { textShadow: '0 0 8px rgba(239,68,68,0.3)' }
    : undefined

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`${large ? 'text-xs font-medium text-gray-300' : 'text-[11px] text-gray-500'}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {isChanged && (
          <>
            <span className="text-[10px] text-gray-600 line-through">{fmtNum(sv)}{suffix}</span>
            <span className="text-gray-700">→</span>
          </>
        )}
        <span className={`${large ? 'text-sm font-semibold' : 'text-xs'} font-mono ${valueColor}`} style={glowStyle}>
          {fmtNum(cv)}{suffix}
        </span>
        {isChanged && (
          <span className={`text-[10px] ${isImproved ? 'text-sc-accent' : 'text-red-400'}`}>
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
      <span className="text-[10px] text-gray-600 w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden relative">
        {isChanged && stockPct > 0 && (
          <div className="absolute h-full bg-white/[0.08] rounded-full" style={{ width: `${Math.min(stockPct, 100)}%` }} />
        )}
        <div className={`absolute h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${Math.min(pct, 100)}%`, opacity: 0.7 }} />
      </div>
      <span className={`text-[10px] font-mono w-10 text-right tabular-nums ${isChanged ? (pct > stockPct ? 'text-sc-accent' : 'text-red-400') : 'text-gray-500'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function PowerBudget({ output, draw, idleDraw, stockOutput, stockDraw, hasChanges }) {
  const maxPct = output > 0 ? Math.min((draw / output) * 100, 100) : 0
  const idlePct = output > 0 ? Math.min(((idleDraw || 0) / output) * 100, 100) : 0
  const isOverBudget = draw > output

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">Output</span>
        <span className="font-mono text-gray-300 tabular-nums">{fmtNum(output)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500" title="Idle power draw (all components at minimum)">Idle Draw</span>
        <span className="font-mono text-gray-400 tabular-nums">{fmtNum(idleDraw || 0)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500" title="Maximum power draw (all components at full load)">Max Draw</span>
        <span className={`font-mono tabular-nums ${isOverBudget ? 'text-red-400' : 'text-gray-300'}`}
          style={isOverBudget ? { textShadow: '0 0 8px rgba(239,68,68,0.3)' } : undefined}>
          {fmtNum(draw)}
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden relative">
        {/* Idle draw bar */}
        <div
          className="absolute h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(idlePct, 100)}%`, opacity: 0.5 }}
        />
        {/* Max draw bar */}
        <div
          className={`absolute h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : maxPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(maxPct, 100)}%`, opacity: 0.3 }}
        />
      </div>
      <div className="text-[10px] text-gray-600 text-right">
        Idle {idlePct.toFixed(0)}% · Max {maxPct.toFixed(0)}%
      </div>
    </div>
  )
}

function aggregateStats(stockComponents, overrides) {
  let power = 0, powerDraw = 0, powerDrawMin = 0, cooling = 0, thermalOutput = 0
  let shieldHp = 0, shieldRegen = 0, resistPhys = 0, resistEnergy = 0, resistDist = 0, shieldCount = 0
  let dps = 0, ballisticDps = 0, energyDps = 0, alpha = 0
  let qtSpeed = 0, qtRange = 0, qtFuelRate = 0, qtSpool = 0
  let radarRange = 0, radarAngle = 0
  let totalMass = 0, totalEmSig = 0

  if (!stockComponents) return { power, powerDraw, powerDrawMin, cooling, thermalOutput, shieldHp, shieldRegen, resistPhys, resistEnergy, resistDist, dps, ballisticDps, energyDps, alpha, qtSpeed, qtRange, qtFuelRate, qtSpool, radarRange, radarAngle, totalMass, totalEmSig }

  for (const comp of stockComponents) {
    const data = overrides[comp.port_id] || comp
    const pt = comp.port_type
    if (pt === 'power') { power += Number(data.power_output) || 0 }
    else if (pt === 'cooler') { cooling += Number(data.cooling_rate) || 0 }
    else if (pt === 'shield') {
      shieldHp += Number(data.shield_hp) || 0; shieldRegen += Number(data.shield_regen) || 0
      resistPhys += Number(data.resist_physical) || 0; resistEnergy += Number(data.resist_energy) || 0
      resistDist += Number(data.resist_distortion) || 0; shieldCount++
    } else if (pt === 'weapon' || pt === 'turret') {
      const d = Number(data.dps) || 0; dps += d; alpha += Number(data.damage_per_shot) || 0
      const dmgType = (data.damage_type || '').toLowerCase()
      if (dmgType.includes('ballistic') || dmgType.includes('physical')) { ballisticDps += d } else { energyDps += d }
    } else if (pt === 'quantum_drive') {
      qtSpeed = Math.max(qtSpeed, Number(data.quantum_speed) || 0)
      qtRange = Math.max(qtRange, Number(data.quantum_range) || 0)
      qtFuelRate = Number(data.fuel_rate) || 0; qtSpool = Number(data.spool_time) || 0
    } else if (pt === 'sensor') {
      radarRange = Math.max(radarRange, Number(data.radar_range) || 0)
      radarAngle = Math.max(radarAngle, Number(data.radar_angle) || 0)
    }
    // Sum power draw and thermal output from ALL non-power components
    if (pt !== 'power') {
      powerDraw += Number(data.power_draw) || 0
      powerDrawMin += Number(data.power_draw_min) || 0
      thermalOutput += Number(data.thermal_output) || 0
    }
    // Sum mass and EM signature from ALL components
    totalMass += Number(data.mass) || 0
    totalEmSig += Number(data.em_signature) || 0
  }
  if (shieldCount > 0) { resistPhys /= shieldCount; resistEnergy /= shieldCount; resistDist /= shieldCount }
  return { power, powerDraw, powerDrawMin, cooling, thermalOutput, shieldHp, shieldRegen, resistPhys, resistEnergy, resistDist, dps, ballisticDps, energyDps, alpha, qtSpeed, qtRange, qtFuelRate, qtSpool, radarRange, radarAngle, totalMass, totalEmSig }
}

function fmtNum(v) {
  const n = Number(v)
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
