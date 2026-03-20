import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Layers } from 'lucide-react'
import { TYPE_LABELS, SUBTYPE_LABELS, TYPE_COLORS, formatTime, resourceColor } from './craftingUtils'

export default function BlueprintCard({ bp, index = 0 }) {
  const navigate = useNavigate()
  const typeColor = TYPE_COLORS[bp.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }

  const resourceNames = [...new Set((bp.slots || []).map(s => s.resource_name))]

  return (
    <button
      onClick={() => navigate(`/crafting/${bp.id}`)}
      className="group relative w-full text-left bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20 transition-all duration-200 hover:border-sc-accent/30 hover:shadow-sc-accent/10 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] animate-stagger-fade-up"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* HUD corner brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-br-xl" />

      {/* Top row: badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${typeColor.bg} ${typeColor.text} border ${typeColor.border}`}>
          {TYPE_LABELS[bp.type] || bp.type}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 bg-white/[0.04] border border-white/[0.06]">
          {SUBTYPE_LABELS[bp.sub_type] || bp.sub_type}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-gray-200 tracking-wide mb-3 group-hover:text-white transition-colors line-clamp-2">
        {bp.base_stats?.item_name || bp.name}
      </h3>

      {/* Bottom row: stats + resources */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(bp.craft_time_seconds)}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {bp.slots?.length || 0}
          </span>
        </div>

        {/* Resource dots */}
        <div className="flex items-center gap-1">
          {resourceNames.slice(0, 4).map(name => (
            <span
              key={name}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: resourceColor(name) }}
              title={name}
            />
          ))}
          {resourceNames.length > 4 && (
            <span className="text-[10px] text-gray-600 ml-0.5">+{resourceNames.length - 4}</span>
          )}
        </div>
      </div>
    </button>
  )
}
