import React, { useState, useMemo } from 'react'

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
 */
function buildSubsystems(components, ship) {
  const subs = []
  let coolerCount = 0
  const seen = new Set()

  // Count components by type from loadout
  for (const c of (components || [])) {
    const pt = c.port_type
    if (pt === 'shield' && !seen.has('shield'))   { seen.add('shield'); subs.push({ key: 'shield', max: ship?.shield_pool_max || 2 }) }
    if (pt === 'weapon' && !seen.has('weapon'))    { seen.add('weapon'); subs.push({ key: 'weapon', max: ship?.weapon_pool_size || 4 }) }
  }

  // Always add engine if we have any components
  if (!seen.has('engine') && components?.length > 0) subs.push({ key: 'engine', max: 4 })

  // Add one column per cooler
  for (const c of (components || [])) {
    if (c.port_type === 'cooler') {
      coolerCount++
      subs.push({ key: 'cooler', max: 3, instance: coolerCount })
    }
  }

  // Radar
  if (components?.some(c => c.port_type === 'sensor')) subs.push({ key: 'radar', max: 3 })

  // QDrive — always 1 pip
  if (components?.some(c => c.port_type === 'quantum_drive')) subs.push({ key: 'qdrive', max: 1 })

  // Life support — always 1
  subs.push({ key: 'lifesup', max: 1 })

  return subs
}

/**
 * Power management panel with pip columns per subsystem.
 * Pips stack bottom-up. Mode selector affects which subsystems are active.
 */
export default function PowerPips({ components, ship, combat }) {
  const [mode, setMode] = useState('SCM')

  const subsystems = useMemo(() => buildSubsystems(components, ship), [components, ship])

  const offSet = MODE_OFF[mode] || new Set()

  // Default allocation: fill all pips for active subsystems
  const allocations = useMemo(() => {
    const alloc = {}
    for (const sub of subsystems) {
      const k = sub.instance ? `${sub.key}_${sub.instance}` : sub.key
      alloc[k] = offSet.has(sub.key) ? 0 : sub.max
    }
    return alloc
  }, [subsystems, mode])

  const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0)
  const totalPool = subsystems.reduce((a, b) => a + b.max, 0)

  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      {/* Mode tabs + pool info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer transition-colors
                ${mode === m
                  ? (m === 'NAV' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30')
                  : 'bg-white/[0.03] text-gray-600 border border-white/[0.06] hover:text-gray-400'
                }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-gray-600">Pool <span className="text-gray-400">{totalAllocated}</span> / {totalPool}</span>
          {combat?.totalPowerOutput > 0 && (
            <span className="text-gray-600">Output <span className="text-emerald-400">{Math.round(combat.totalPowerOutput).toLocaleString()}</span> pwr</span>
          )}
        </div>
      </div>

      {/* Pip columns */}
      <div className="flex items-end gap-1 px-1" style={{ height: 80 }}>
        {subsystems.map((sub, idx) => {
          const k = sub.instance ? `${sub.key}_${sub.instance}` : sub.key
          const meta = SUBSYSTEM_META[sub.key]
          const isOff = offSet.has(sub.key)
          const filled = allocations[k] || 0

          return (
            <div key={`${k}_${idx}`} className="flex-1 min-w-[24px] flex flex-col-reverse gap-0.5">
              {Array.from({ length: sub.max }).map((_, i) => (
                <div
                  key={i}
                  className={`w-full h-[10px] rounded-sm border transition-colors
                    ${isOff
                      ? 'bg-white/[0.02] border-white/[0.04] opacity-30'
                      : i < filled
                        ? meta.pipOn
                        : 'bg-white/[0.04] border-white/[0.08] cursor-pointer hover:border-white/[0.2]'
                    }`}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Subsystem labels + counts */}
      <div className="flex items-center gap-1 px-1">
        {subsystems.map((sub, idx) => {
          const k = sub.instance ? `${sub.key}_${sub.instance}` : sub.key
          const meta = SUBSYSTEM_META[sub.key]
          const isOff = offSet.has(sub.key)
          const filled = allocations[k] || 0
          return (
            <div key={`${k}_${idx}`} className="flex-1 min-w-[24px] text-center">
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
    </div>
  )
}
