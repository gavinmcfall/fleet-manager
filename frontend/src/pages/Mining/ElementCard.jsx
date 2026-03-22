import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  cleanElementName, CATEGORY_STYLES, ELEMENT_STAT_LABELS,
  instabilityColor, instabilityBg, instabilityBarColor, humanizeLocationName,
} from './miningUtils'

function StatRow({ label, value }) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-gray-500">{label}</span>
      <span className="font-mono text-gray-300">{typeof value === 'number' ? value.toFixed(2) : value}</span>
    </div>
  )
}

export default function ElementCard({ element, topLocations = [], index = 0 }) {
  const navigate = useNavigate()
  const instability = element.instability ?? null
  const cat = CATEGORY_STYLES[element.category] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }

  return (
    <button
      onClick={() => navigate(`/mining/element/${element.id}`)}
      className="group relative w-full text-left bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20 transition-all duration-200 hover:border-sc-accent/30 hover:shadow-sc-accent/10 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] animate-stagger-fade-up space-y-3"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* HUD corners */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-br-xl" />

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight group-hover:text-sc-accent transition-colors">
          {cleanElementName(element.name)}
        </h3>
        {element.category && (
          <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 ${cat.bg} ${cat.text} ${cat.border}`}>
            {element.category}
          </span>
        )}
      </div>

      {/* Instability bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-500">Instability</span>
          <span className={`font-mono font-semibold ${instabilityColor(instability)}`}>
            {instability != null ? instability.toFixed(0) : '--'}
          </span>
        </div>
        {instability != null && (
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${instabilityBg(instability)}`}>
            <div
              className={`h-full rounded-full transition-all ${instabilityBarColor(instability)}`}
              style={{ width: `${Math.min(instability / 10, 100).toFixed(0)}%` }}
            />
          </div>
        )}
      </div>

      {/* Key stats */}
      <StatRow label="Resistance" value={element.resistance} />
      <StatRow label="Optimal Window" value={element.optimal_window_midpoint} />
      <StatRow label="Explosion Mult" value={element.explosion_multiplier} />

      {/* Top locations preview */}
      {topLocations.length > 0 && (
        <div className="pt-2 border-t border-white/[0.04] space-y-1">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-600">Top Locations</span>
          {topLocations.slice(0, 3).map((loc, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 truncate">{humanizeLocationName(loc.name)}</span>
              <span className="text-gray-600 font-mono shrink-0 ml-2">{loc.system}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
