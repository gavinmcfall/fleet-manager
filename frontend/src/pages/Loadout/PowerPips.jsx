import React, { useState, useMemo, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'

const MODES = ['SCM', 'NAV']

// Mode restrictions: which subsystems are OFF in each mode
const MODE_OFF = {
  SCM: new Set(['qdrive']),
  NAV: new Set(['shield', 'weapon']),
}

const SUBSYSTEM_META = {
  shield:  { label: 'SHD', color: 'text-blue-400',   pipOn: 'bg-emerald-500 border-emerald-500/40' },
  weapon:  { label: 'WPN', color: 'text-amber-400',  pipOn: 'bg-emerald-500 border-emerald-500/40' },
  engine:  { label: 'ENG', color: 'text-orange-300',  pipOn: 'bg-emerald-500 border-emerald-500/40' },
  cooler:  { label: 'CLR', color: 'text-cyan-300',    pipOn: 'bg-emerald-500 border-emerald-500/40' },
  radar:   { label: 'RAD', color: 'text-green-400',   pipOn: 'bg-emerald-500 border-emerald-500/40' },
  qdrive:  { label: 'QD',  color: 'text-purple-400',  pipOn: 'bg-purple-500 border-purple-500/40' },
  lifesup: { label: 'LS',  color: 'text-gray-500',    pipOn: 'bg-gray-500 border-gray-500/40' },
}

/**
 * Build subsystem columns from loadout component data.
 * Each cooler gets its own column (like Erkul).
 * Returns [{ key, max, default, instance? }]
 */
function buildSubsystems(components, ship) {
  const subs = []
  let coolerCount = 0
  const seen = new Set()

  // Weapon + Shield have explicit caps from game data (FixedPowerPool / DynamicPowerPool)
  // Everything else has maxItemCount=-1 (unlimited) — shared pool, no per-subsystem cap
  for (const c of (components || [])) {
    const pt = c.port_type
    if (pt === 'shield' && !seen.has('shield')) {
      seen.add('shield')
      const cap = ship?.shield_pool_max || 2
      subs.push({ key: 'shield', max: cap, default: cap, capped: true })
    }
    if ((pt === 'weapon' || pt === 'turret') && !seen.has('weapon')) {
      seen.add('weapon')
      const cap = ship?.weapon_pool_size || 4
      subs.push({ key: 'weapon', max: cap, default: cap, capped: true })
    }
  }

  // Uncapped subsystems — max shown is a visual guide, real limit is the shared pool
  if (!seen.has('engine') && components?.length > 0) {
    subs.push({ key: 'engine', max: 8, default: 4 })
  }

  for (const c of (components || [])) {
    if (c.port_type === 'cooler') {
      coolerCount++
      subs.push({ key: 'cooler', max: 5, default: 3, instance: coolerCount })
    }
  }

  if (components?.some(c => c.port_type === 'sensor')) {
    subs.push({ key: 'radar', max: 5, default: 3 })
  }

  if (components?.some(c => c.port_type === 'quantum_drive')) {
    subs.push({ key: 'qdrive', max: 3, default: 1 })
  }

  subs.push({ key: 'lifesup', max: 2, default: 1 })

  return subs
}

function getDefaultAllocations(subsystems, offSet) {
  const alloc = {}
  for (const sub of subsystems) {
    const k = sub.instance ? `${sub.key}_${sub.instance}` : sub.key
    alloc[k] = offSet.has(sub.key) ? 0 : sub.default
  }
  return alloc
}

/**
 * Power management panel with interactive pip columns.
 * Click a pip to allocate up to that level (from shared pool).
 * Click above current fill = increase. Click at/below = decrease to that level.
 */
export default function PowerPips({ components, ship, combat }) {
  const [mode, setMode] = useState('SCM')
  const subsystems = useMemo(() => buildSubsystems(components, ship), [components, ship])
  const offSet = MODE_OFF[mode] || new Set()

  const defaults = useMemo(() => getDefaultAllocations(subsystems, offSet), [subsystems, offSet])
  const [allocations, setAllocations] = useState(null) // null = use defaults

  const current = allocations || defaults

  // Reset when mode changes
  const handleModeChange = useCallback((m) => {
    setMode(m)
    setAllocations(null)
  }, [])

  const totalAllocated = Object.values(current).reduce((a, b) => a + b, 0)
  const totalPool = subsystems.reduce((a, b) => a + b.max, 0)
  const freePool = totalPool - totalAllocated

  const handlePipClick = useCallback((subKey, pipIndex, subMax) => {
    setAllocations(prev => {
      const base = prev || { ...defaults }
      const next = { ...base }
      const currentFilled = next[subKey] || 0
      const target = Math.min(pipIndex + 1, subMax) // clicking pip 0 = set to 1, cap at max

      if (target > currentFilled) {
        // Increase — need free pips from shared pool
        const needed = target - currentFilled
        const used = Object.values(next).reduce((a, b) => a + b, 0)
        const available = totalPool - used
        const canAdd = Math.min(needed, available)
        next[subKey] = currentFilled + canAdd
      } else {
        // Decrease — click at current level toggles down by 1, otherwise set to target
        next[subKey] = target === currentFilled ? Math.max(0, target - 1) : target
      }
      return next
    })
  }, [defaults, totalPool])

  const isModified = allocations !== null
  const handleReset = useCallback(() => setAllocations(null), [])

  return (
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      {/* Pool info line */}
      <div className="flex items-center justify-center gap-4 text-[10px] font-mono">
        <span className="text-gray-600">Pool <span className={freePool > 0 ? 'text-sc-accent' : 'text-gray-400'}>{totalAllocated}</span> / {totalPool}</span>
        {combat?.totalPowerOutput > 0 && (
          <span className="text-gray-600">Output <span className="text-emerald-400">{Math.round(combat.totalPowerOutput).toLocaleString()}</span> pwr</span>
        )}
      </div>

      {/* Pip columns — taller area */}
      <div className="flex items-end gap-1.5 px-2 flex-1" style={{ minHeight: 96 }}>
        {subsystems.map((sub, idx) => {
          const k = sub.instance ? `${sub.key}_${sub.instance}` : sub.key
          const meta = SUBSYSTEM_META[sub.key]
          const isOff = offSet.has(sub.key)
          const filled = current[k] || 0

          return (
            <div key={`${k}_${idx}`} className="flex-1 min-w-[26px] flex flex-col-reverse gap-[3px]">
              {Array.from({ length: sub.max }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => !isOff && handlePipClick(k, i, sub.max)}
                  className={`w-full h-[10px] rounded-sm border transition-colors
                    ${isOff
                      ? 'bg-white/[0.02] border-white/[0.04] opacity-30'
                      : i < filled
                        ? meta.pipOn
                        : 'bg-white/[0.04] border-white/[0.08] cursor-pointer hover:border-white/[0.25] hover:bg-white/[0.08]'
                    }`}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Subsystem labels + counts */}
      <div className="flex items-center gap-1.5 px-2">
        {subsystems.map((sub, idx) => {
          const k = sub.instance ? `${sub.key}_${sub.instance}` : sub.key
          const meta = SUBSYSTEM_META[sub.key]
          const isOff = offSet.has(sub.key)
          const filled = current[k] || 0
          return (
            <div key={`${k}_${idx}`} className="flex-1 min-w-[26px] text-center">
              <div className={`text-[9px] uppercase tracking-wider ${isOff ? 'text-gray-700' : meta.color}`}>
                {meta.label}
              </div>
              <div className={`font-mono text-[10px] ${isOff ? 'text-gray-700' : meta.color}`}>
                {isOff ? 'off' : filled}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mode selector + reset — bottom row */}
      <div className="flex items-center justify-center gap-1.5">
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`px-3 py-1 text-[10px] font-semibold rounded cursor-pointer transition-colors
              ${mode === m
                ? (m === 'NAV' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30')
                : 'bg-white/[0.03] text-gray-600 border border-white/[0.06] hover:text-gray-400'
              }`}
          >
            {m}
          </button>
        ))}
        {isModified && (
          <button onClick={handleReset} className="flex items-center gap-0.5 px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 border border-white/[0.06] rounded cursor-pointer transition-colors" title="Reset to defaults">
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        )}
      </div>
    </div>
  )
}
