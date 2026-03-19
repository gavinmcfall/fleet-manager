import React from 'react'
import { Gem } from 'lucide-react'
import { resourceColor, resourceBgColor, resourceBorderColor } from './craftingUtils'

function ModifierBar({ mod }) {
  const range = mod.modifier_at_end - mod.modifier_at_start
  const isPositive = range > 0
  const pct = Math.abs(range * 100).toFixed(1)
  const barWidth = Math.min(Math.abs(range) * 100, 100)

  return (
    <div className="flex items-center gap-2 text-xs group/mod">
      <span className="text-gray-400 w-32 truncate">{mod.name}</span>
      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isPositive ? 'bg-emerald-500/80' : 'bg-red-500/80'
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`w-14 text-right font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{pct}%
      </span>
    </div>
  )
}

export default function SlotCard({ slot, index = 0 }) {
  return (
    <div
      className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.05] rounded-lg p-4 animate-stagger-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-200">{slot.name}</h4>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: resourceBgColor(slot.resource_name),
              borderColor: resourceBorderColor(slot.resource_name),
              color: resourceColor(slot.resource_name),
            }}
          >
            <Gem className="w-3 h-3" />
            {slot.resource_name}
          </span>
          <span className="text-xs text-gray-500">&times;{slot.quantity}</span>
          {slot.min_quality > 0 && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Q{slot.min_quality}+
            </span>
          )}
        </div>
      </div>

      {slot.modifiers && slot.modifiers.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
          {slot.modifiers.map((mod, j) => (
            <ModifierBar key={j} mod={mod} />
          ))}
        </div>
      )}
    </div>
  )
}
