import React, { useState } from 'react'
import { Shield, Zap, Navigation, Radar, Globe, Snowflake } from 'lucide-react'

const MODES = ['SCM', 'NAV', 'SCAN', 'RES']

const SUBSYSTEMS = [
  { key: 'shield', icon: Shield, color: 'blue', label: 'Shields' },
  { key: 'weapon', icon: Zap, color: 'amber', label: 'Weapons' },
  { key: 'thrust', icon: Navigation, color: 'emerald', label: 'Thrusters' },
  { key: 'cooler', icon: Snowflake, color: 'cyan', label: 'Coolers' },
  { key: 'radar', icon: Radar, color: 'emerald', label: 'Radar' },
  { key: 'qdrive', icon: Globe, color: 'purple', label: 'QDrive' },
]

const PIP_COLORS = {
  blue: 'bg-blue-500/40 border-blue-500/50',
  amber: 'bg-amber-500/40 border-amber-500/50',
  emerald: 'bg-emerald-500/40 border-emerald-500/50',
  cyan: 'bg-cyan-500/40 border-cyan-500/50',
  purple: 'bg-purple-500/40 border-purple-500/50',
}

const ICON_COLORS = {
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-300',
  purple: 'text-purple-400',
}

const PIP_COUNT_COLORS = {
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-300',
  purple: 'text-purple-400',
}

/**
 * Vertical pip columns for power distribution.
 * Each column = a subsystem with pips stacking bottom-up.
 *
 * Props:
 *   weaponPoolSize - from ship data (FixedPowerPool poolSize)
 *   totalOutput - placeholder for total power output
 *   consumption - placeholder for consumption percentage
 */
export default function PowerPips({ weaponPoolSize = 4, totalOutput = 30, consumption = 36 }) {
  const [activeMode, setActiveMode] = useState('SCM')

  // Placeholder pip distribution — will be driven by real data
  const pipData = {
    shield: { filled: 2, total: 5 },
    weapon: { filled: Math.min(weaponPoolSize, 6), total: Math.max(weaponPoolSize, 6) },
    thrust: { filled: 3, total: 5 },
    cooler: { filled: 2, total: 3 },
    radar: { filled: 2, total: 3 },
    qdrive: { filled: activeMode === 'NAV' ? 3 : 0, total: 3 },
  }

  const maxPips = Math.max(...Object.values(pipData).map(p => p.total))

  return (
    <div className="flex-shrink-0 px-4 border-l border-r border-white/[0.06]" style={{ width: 260 }}>
      {/* Output + Consumption */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Output</span>
        <span className="text-[13px] font-mono">
          <span className="text-sc-accent">0</span>
          <span className="text-gray-600"> / {totalOutput}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Consumption</span>
        <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500/60 rounded-full transition-all" style={{ width: `${consumption}%` }} />
        </div>
        <span className="text-[12px] font-mono text-emerald-400">{consumption}%</span>
      </div>

      {/* Vertical pip columns */}
      <div className="flex items-end gap-1.5 justify-center" style={{ height: maxPips * 14 + 20 }}>
        {SUBSYSTEMS.map(({ key, color }) => {
          const { filled, total } = pipData[key]
          return (
            <div key={key} className="flex flex-col-reverse gap-0.5 items-center">
              <div className={`text-[9px] font-mono mt-0.5 ${PIP_COUNT_COLORS[color]}`}>{filled}</div>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className={`w-5 h-2.5 rounded-sm border ${i < filled ? PIP_COLORS[color] : 'bg-white/[0.04] border-white/[0.06]'}`} />
              ))}
            </div>
          )
        })}
      </div>

      {/* System icons */}
      <div className="flex gap-1.5 justify-center mt-1">
        {SUBSYSTEMS.map(({ key, icon: Icon, color, label }) => (
          <Icon key={key} className={`w-4 h-4 ${ICON_COLORS[color]}`} title={label} />
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mt-2">
        {MODES.map(mode => (
          <button
            key={mode}
            onClick={() => setActiveMode(mode)}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded cursor-pointer text-center transition-colors
              ${activeMode === mode
                ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30'
                : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:bg-white/[0.08]'
              }`}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="text-[9px] text-gray-600 text-center mt-1.5">Mode affects power distribution &amp; stats</div>
    </div>
  )
}
