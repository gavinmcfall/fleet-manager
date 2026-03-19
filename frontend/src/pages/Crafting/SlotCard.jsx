import React from 'react'
import { Gem } from 'lucide-react'
import {
  resourceColor, resourceBgColor, resourceBorderColor,
  formatQuantity, quantityUnits,
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

export default function SlotCard({ slot, index = 0 }) {
  return (
    <div
      className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.05] rounded-lg p-4 animate-stagger-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-200">{slot.name}</h4>
          {slot.min_quality > 0 && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              min Q{slot.min_quality}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
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
        </div>
      </div>
    </div>
  )
}
