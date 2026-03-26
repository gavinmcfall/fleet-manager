import React from 'react'
import { DmgShape, DMG_TYPES, fmtInt } from './loadoutHelpers'

/**
 * Compact 2×2 grid showing per-damage-type DPS.
 * Each cell: shape icon + label + DPS value.
 * Active types highlighted in their color, zeros dimmed.
 */
export default function DamageBreakdown({ dpsPhysical = 0, dpsEnergy = 0, dpsDistortion = 0, dpsThermal = 0 }) {
  const types = [
    { key: 'physical', dps: dpsPhysical },
    { key: 'energy', dps: dpsEnergy },
    { key: 'distortion', dps: dpsDistortion },
    { key: 'thermal', dps: dpsThermal },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
      {types.map(({ key, dps }) => {
        const active = dps > 0
        const { label, color } = DMG_TYPES[key]
        return (
          <div key={key} className="flex items-center gap-1.5 bg-white/[0.02] rounded px-2 py-1">
            <DmgShape type={key} size={12} />
            <span className={`text-[11px] flex-1 ${active ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
            <span
              className={`font-mono text-[12px] ${active ? '' : 'text-gray-600'}`}
              style={active ? { color } : undefined}
            >
              {fmtInt(Math.round(dps))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
