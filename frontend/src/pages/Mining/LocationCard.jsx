import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { humanizeLocationName, SYSTEM_COLORS, LOCATION_TYPE_COLORS, cleanElementName } from './miningUtils'

export default function LocationCard({ location, deposits = [], compositions = [], index = 0 }) {
  const navigate = useNavigate()
  const sys = SYSTEM_COLORS[location.system] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  const locType = LOCATION_TYPE_COLORS[location.location_type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }

  // Get top 3 unique elements found here
  const topElements = useMemo(() => {
    const elementSet = new Map()
    for (const dep of deposits) {
      if (!dep.composition_json) continue
      try {
        const els = JSON.parse(dep.composition_json)
        for (const el of els) {
          if (el.element && !elementSet.has(el.element)) {
            elementSet.set(el.element, el.maxPct || 0)
          }
        }
      } catch { /* skip */ }
    }
    return [...elementSet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => cleanElementName(name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())))
  }, [deposits])

  return (
    <button
      onClick={() => navigate(`/mining/location/${location.id}`)}
      className="group relative w-full text-left bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20 transition-all duration-200 hover:border-sc-accent/30 hover:shadow-sc-accent/10 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] animate-stagger-fade-up space-y-3"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-br-xl" />

      {/* Badges */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${sys.bg} ${sys.text} border ${sys.border}`}>
          {location.system}
        </span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${locType.bg} ${locType.text} border ${locType.border}`}>
          {location.location_type}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-gray-200 tracking-wide group-hover:text-white transition-colors">
        {humanizeLocationName(location.name)}
      </h3>

      {/* Bottom: deposit count + top ores */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-mono">
          {deposits.length} deposit{deposits.length !== 1 ? 's' : ''}
        </span>
        {topElements.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            {topElements.map((name, i) => (
              <span key={i} className="truncate max-w-[80px]">{name}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
