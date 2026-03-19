import React from 'react'
import { Gem, Info } from 'lucide-react'
import {
  resourceColor, resourceBgColor, resourceBorderColor,
  formatQuantity, formatModifierChange, isModifierBeneficial,
  STAT_DESCRIPTIONS,
} from './craftingUtils'

function ModifierBar({ mod }) {
  // At max quality, what's the change from base (1.0)?
  const bestValue = mod.modifier_at_end
  const worstValue = mod.modifier_at_start
  const isBeneficialAtBest = isModifierBeneficial(mod.key, bestValue)
  const isBeneficialAtWorst = isModifierBeneficial(mod.key, worstValue)

  // Bar shows the range of change from worst to best quality
  const worstChange = Math.abs(worstValue - 1) * 100
  const bestChange = Math.abs(bestValue - 1) * 100
  const maxChange = Math.max(worstChange, bestChange)
  const barWidth = Math.min(maxChange * 2, 100) // scale so 50% change fills the bar

  const description = STAT_DESCRIPTIONS[mod.key]

  return (
    <div className="group/mod">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400 w-36 truncate flex items-center gap-1" title={description}>
          {mod.name}
          {description && <Info className="w-3 h-3 text-gray-600 opacity-0 group-hover/mod:opacity-100 transition-opacity" />}
        </span>
        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isBeneficialAtBest ? 'bg-emerald-500/80' : 'bg-red-500/80'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="w-24 text-right font-mono flex items-center justify-end gap-1">
          <span className={`${isBeneficialAtWorst ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
            {formatModifierChange(worstValue)}
          </span>
          <span className="text-gray-600">→</span>
          <span className={`${isBeneficialAtBest ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatModifierChange(bestValue)}
          </span>
        </div>
      </div>
      {description && (
        <p className="text-[10px] text-gray-600 mt-0.5 ml-0 opacity-0 group-hover/mod:opacity-100 transition-opacity pl-0">
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
          <span className="text-xs text-gray-400 font-mono">{formatQuantity(slot.quantity)}</span>
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
            Quality 0 → 1000 effect range
          </p>
          {slot.modifiers.map((mod, j) => (
            <ModifierBar key={j} mod={mod} />
          ))}
        </div>
      )}
    </div>
  )
}
