import React from 'react'
import { Gem, Info } from 'lucide-react'
import {
  resourceColor, resourceBgColor, resourceBorderColor,
  formatQuantity, quantityUnits,
  getStatLabel, getStatDescription, multiplierToImprovement, formatImprovementWithWord,
} from './craftingUtils'

function QuantityBadge({ quantity }) {
  const units = quantityUnits(quantity)
  return (
    <span className="relative group/qty">
      <span className="text-xs text-gray-400 font-mono cursor-help border-b border-dashed border-gray-700">
        {formatQuantity(quantity)}
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/qty:flex flex-col items-end gap-0.5 px-3 py-2 rounded-lg bg-gray-900/95 border border-white/[0.08] shadow-xl shadow-black/40 backdrop-blur-sm z-10 whitespace-nowrap">
        {units.map(({ value, unit }) => (
          <span key={unit} className="flex items-center gap-2 text-xs">
            <span className="text-gray-200 font-mono font-medium">{value}</span>
            <span className="text-gray-500">{unit}</span>
          </span>
        ))}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/95 border-b border-r border-white/[0.08] rotate-45" />
      </span>
    </span>
  )
}

function ModifierRow({ mod }) {
  const label = getStatLabel(mod.key, mod.name)
  const description = getStatDescription(mod.key)

  // Show the improvement range: Q0 (worst) → Q1000 (best)
  const worstImprovement = multiplierToImprovement(mod.key, mod.modifier_at_start)
  const bestImprovement = multiplierToImprovement(mod.key, mod.modifier_at_end)

  // Bar width based on best possible improvement magnitude
  const barWidth = Math.min(Math.abs(bestImprovement) * 2.5, 100)

  return (
    <div className="group/mod">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400 w-36 truncate flex items-center gap-1" title={description}>
          {label}
          {description && <Info className="w-3 h-3 text-gray-600 opacity-0 group-hover/mod:opacity-100 transition-opacity" />}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, rgba(239,68,68,0.15), rgba(34,211,238,0.15))' }}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500/60 to-sc-accent/60 transition-all duration-500 ease-out"
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="w-40 text-right flex items-center justify-end gap-1.5">
          <span className="text-red-400/70 text-[11px]">
            {formatImprovementWithWord(mod.key, worstImprovement)}
          </span>
          <span className="text-gray-600 text-[10px]">→</span>
          <span className="text-sc-accent text-[11px]">
            {formatImprovementWithWord(mod.key, bestImprovement)}
          </span>
        </div>
      </div>
      {description && (
        <p className="text-[10px] text-gray-600 mt-0.5 opacity-0 group-hover/mod:opacity-100 transition-opacity">
          {description}
        </p>
      )}
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
          <QuantityBadge quantity={slot.quantity} />
          {slot.min_quality > 0 && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Q{slot.min_quality}+
            </span>
          )}
        </div>
      </div>

      {slot.modifiers && slot.modifiers.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/[0.04]">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">
            Quality effect range (Q0 → Q1000)
          </p>
          {slot.modifiers.map((mod, j) => (
            <ModifierRow key={j} mod={mod} />
          ))}
        </div>
      )}
    </div>
  )
}
