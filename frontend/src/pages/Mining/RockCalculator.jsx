import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X as XIcon, AlertTriangle } from 'lucide-react'
import {
  SHIP_PRESETS, MOD_KEYS, MOD_LABELS, MOD_POSITIVE_IS_GOOD,
  computeEffectiveModifiers, canBreakRock, computeChargeWindow, formatModPct,
} from './miningUtils'

function ShipButton({ preset, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
        active
          ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30'
          : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-300'
      }`}
    >
      {preset.name}
    </button>
  )
}

function EquipSelect({ label, items, value, onChange, filterSize }) {
  const filtered = filterSize != null
    ? items.filter(i => i.size === filterSize || i.size === 0)
    : items

  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value ? filtered.find(i => String(i.id) === e.target.value) : null)}
        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-sc-accent/40"
      >
        <option value="">None</option>
        {filtered.map(i => (
          <option key={i.id} value={i.id}>
            {i.name} {i.size != null ? `(S${i.size})` : ''} {i.beam_dps ? `— ${i.beam_dps.toFixed(1)} DPS` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

function ChargeBar({ windowStart, windowEnd, effectiveInstability }) {
  const startPct = windowStart * 100
  const endPct = windowEnd * 100
  const catStart = 90 // Catastrophic zone starts at 90%

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Charge Window</div>
      <div className="relative h-6 bg-white/[0.04] rounded-full overflow-hidden">
        {/* Catastrophic zone */}
        <div
          className="absolute top-0 bottom-0 bg-red-500/20"
          style={{ left: `${catStart}%`, right: 0 }}
        />
        {/* Optimal window */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/30 border-l border-r border-emerald-500/50"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
        {/* Labels */}
        <div className="absolute inset-0 flex items-center px-2 justify-between text-[9px] font-mono">
          <span className="text-gray-600">0%</span>
          <span className="text-emerald-400">
            {startPct.toFixed(0)}–{endPct.toFixed(0)}%
          </span>
          <span className="text-gray-600">100%</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-600 font-mono">
          Window: {(endPct - startPct).toFixed(1)}% wide
        </span>
        <span className={`font-mono ${effectiveInstability > 0.7 ? 'text-red-400' : effectiveInstability > 0.4 ? 'text-amber-400' : 'text-green-400'}`}>
          Instability: {(effectiveInstability * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

export default function RockCalculator({ data }) {
  const navigate = useNavigate()
  const [shipIndex, setShipIndex] = useState(0)
  const ship = SHIP_PRESETS[shipIndex]

  // Per-slot laser selection
  const [laserIds, setLaserIds] = useState({})
  // Per-laser module selections (up to 3 per laser)
  const [moduleIds, setModuleIds] = useState({})
  const [gadget, setGadget] = useState(null)
  const [selectedCompId, setSelectedCompId] = useState('')

  const lasers = data?.lasers || []
  const modules = data?.modules || []
  const gadgets = data?.gadgets || []
  const compositions = data?.compositions || []
  const elements = data?.elements || []

  // Get the selected composition
  const selectedComp = useMemo(() => {
    if (!selectedCompId) return null
    return compositions.find(c => String(c.id) === selectedCompId)
  }, [compositions, selectedCompId])

  // Parse elements from composition
  const compElements = useMemo(() => {
    if (!selectedComp?.composition_json) return []
    try { return JSON.parse(selectedComp.composition_json) } catch { return [] }
  }, [selectedComp])

  // Resolve element stats for the selected composition
  const elementStats = useMemo(() => {
    return compElements.map(el => {
      const match = elements.find(e => e.class_name?.toLowerCase() === el.element?.toLowerCase())
      return { ...el, stats: match || null }
    })
  }, [compElements, elements])

  // Average resistance and instability of the rock
  const rockStats = useMemo(() => {
    if (elementStats.length === 0) return { resistance: 0, instability: 0.5, optimal_window_midpoint: 0.5, optimal_window_thinness: 0.5 }
    let totalWeight = 0, avgRes = 0, avgInst = 0, avgMid = 0, avgThin = 0
    for (const el of elementStats) {
      const weight = el.maxPct || el.minPct || 1
      avgRes += (el.stats?.resistance || 0) * weight
      avgInst += (el.stats?.instability || 0.5) * weight
      avgMid += (el.stats?.optimal_window_midpoint || 0.5) * weight
      avgThin += (el.stats?.optimal_window_thinness || 0.5) * weight
      totalWeight += weight
    }
    if (totalWeight === 0) return { resistance: 0, instability: 0.5, optimal_window_midpoint: 0.5, optimal_window_thinness: 0.5 }
    return {
      resistance: avgRes / totalWeight,
      instability: avgInst / totalWeight,
      optimal_window_midpoint: avgMid / totalWeight,
      optimal_window_thinness: avgThin / totalWeight,
    }
  }, [elementStats])

  // Compute aggregate DPS and modifiers across all slots
  const result = useMemo(() => {
    let totalDps = 0
    let allMods = {}
    for (const key of MOD_KEYS) allMods[key] = 0

    for (let i = 0; i < ship.slots.length; i++) {
      const laser = laserIds[i]
      if (!laser) continue
      totalDps += laser.beam_dps || 0

      const slotModules = []
      for (let j = 0; j < (laser.module_slots || 0); j++) {
        const mod = moduleIds[`${i}-${j}`]
        if (mod) slotModules.push(mod)
      }

      const mods = computeEffectiveModifiers(laser, slotModules, i === 0 ? gadget : null)
      for (const key of MOD_KEYS) allMods[key] += mods[key]
    }

    const canBreak = canBreakRock(totalDps, rockStats.resistance, allMods.mod_resistance)
    const chargeWindow = computeChargeWindow(rockStats, allMods)
    const effectiveResistance = rockStats.resistance * (1 - allMods.mod_resistance)

    return { totalDps, mods: allMods, canBreak, chargeWindow, effectiveResistance }
  }, [ship, laserIds, moduleIds, gadget, rockStats])

  return (
    <div className="space-y-6">
      {/* Ship selector */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Ship / Platform</h3>
        <div className="flex flex-wrap gap-2">
          {SHIP_PRESETS.map((preset, i) => (
            <ShipButton
              key={preset.name}
              preset={preset}
              active={shipIndex === i}
              onClick={() => {
                setShipIndex(i)
                setLaserIds({})
                setModuleIds({})
                setGadget(null)
              }}
            />
          ))}
        </div>
      </div>

      {/* Laser + module selection per slot */}
      <div className="space-y-4">
        {ship.slots.map((slot, i) => {
          const laser = laserIds[i]
          return (
            <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 space-y-3">
              <EquipSelect
                label={slot.label}
                items={lasers}
                value={laser}
                onChange={l => setLaserIds(prev => ({ ...prev, [i]: l }))}
                filterSize={slot.size}
              />
              {/* Module slots for this laser */}
              {laser && laser.module_slots > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-4 border-l-2 border-white/[0.06]">
                  {Array.from({ length: laser.module_slots }, (_, j) => (
                    <EquipSelect
                      key={j}
                      label={`Module ${j + 1}`}
                      items={modules}
                      value={moduleIds[`${i}-${j}`]}
                      onChange={m => setModuleIds(prev => ({ ...prev, [`${i}-${j}`]: m }))}
                      filterSize={slot.size}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Gadget */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
        <EquipSelect
          label="Gadget (consumable)"
          items={gadgets}
          value={gadget}
          onChange={setGadget}
        />
      </div>

      {/* Rock selector */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Rock Composition</h3>
        <select
          value={selectedCompId}
          onChange={e => setSelectedCompId(e.target.value)}
          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-sc-accent/40"
        >
          <option value="">Select a rock composition...</option>
          {compositions.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.rock_type})
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {selectedComp && Object.values(laserIds).some(Boolean) && (
        <div className="space-y-4 animate-fade-in">
          {/* Pass/Fail badge */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            result.canBreak
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {result.canBreak ? (
              <>
                <div className="p-2 rounded-full bg-emerald-500/20">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">CAN FRACTURE</p>
                  <p className="text-xs text-gray-400">
                    {result.totalDps.toFixed(1)} DPS &gt; {result.effectiveResistance.toFixed(1)} effective resistance
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-full bg-red-500/20">
                  <XIcon className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-400">CANNOT FRACTURE</p>
                  <p className="text-xs text-gray-400">
                    {result.totalDps.toFixed(1)} DPS &lt; {result.effectiveResistance.toFixed(1)} effective resistance
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Charge window visualization */}
          <ChargeBar
            windowStart={result.chargeWindow.windowStart}
            windowEnd={result.chargeWindow.windowEnd}
            effectiveInstability={result.chargeWindow.effectiveInstability}
          />

          {/* Rock elements */}
          {elementStats.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Rock Elements</h4>
              <div className="flex flex-wrap gap-2">
                {elementStats.map((el, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-gray-300">
                    {el.element?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    {el.maxPct != null && ` ${(el.maxPct * 100).toFixed(0)}%`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Effective modifiers */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Effective Modifiers</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MOD_KEYS.map(key => {
                const val = result.mods[key]
                if (Math.abs(val) < 0.0001) return null
                const isGood = val > 0 ? MOD_POSITIVE_IS_GOOD[key] : !MOD_POSITIVE_IS_GOOD[key]
                return (
                  <div key={key} className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500">{MOD_LABELS[key]}</p>
                    <p className={`text-sm font-mono ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatModPct(val)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!selectedComp && (
        <div className="text-center py-8 text-gray-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a ship, laser, and rock composition to see results.</p>
        </div>
      )}
    </div>
  )
}
