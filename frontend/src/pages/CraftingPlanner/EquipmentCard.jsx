import React from 'react'

const MODIFIER_LABELS = {
  mod_instability: 'Instability',
  mod_resistance: 'Resistance',
  mod_optimal_window_size: 'Opt. Window',
  mod_shatter_damage: 'Shatter Dmg',
  mod_cluster_factor: 'Cluster',
  mod_optimal_charge_rate: 'Charge Rate',
  mod_catastrophic_charge_rate: 'Cat. Charge',
  mod_filter: 'Filter',
}

function ModifierRow({ label, value }) {
  if (value === 0 || value == null) return null
  const isPositive = value > 0
  // Values are raw integers (e.g. -35, +25), display directly
  const display = Math.abs(value) >= 1 ? Math.round(value) : value.toFixed(1)
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-gray-500">{label}</span>
      <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
        {isPositive ? '+' : ''}{display}
      </span>
    </div>
  )
}

export default function EquipmentCard({ item, isTop }) {
  const scoreColor = item.score >= 70 ? 'text-emerald-400 bg-emerald-500'
    : item.score >= 50 ? 'text-amber-400 bg-amber-500'
    : 'text-red-400 bg-red-500'

  const scoreBarColor = item.score >= 70 ? 'bg-emerald-500'
    : item.score >= 50 ? 'bg-amber-500'
    : 'bg-red-500'

  return (
    <div className={`p-3 rounded-lg border transition-all duration-200 ${
      isTop
        ? 'bg-cyan-500/5 border-cyan-500/30'
        : 'bg-gray-800/50 border-gray-700/50'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{item.name}</p>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {item.manufacturer && <span>{item.manufacturer}</span>}
            {item.size != null && <span>Size {item.size}</span>}
            {item.type && <span className="capitalize">{item.type}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-xs font-mono font-bold ${scoreColor.split(' ')[0]}`}>
            {Math.round(item.score)}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${scoreBarColor}`} style={{ width: `${item.score}%` }} />
      </div>

      {/* Key modifiers */}
      <div className="space-y-0.5">
        {Object.entries(MODIFIER_LABELS).map(([key, label]) => (
          <ModifierRow key={key} label={label} value={item[key]} />
        ))}
      </div>
    </div>
  )
}
