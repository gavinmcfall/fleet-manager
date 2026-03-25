import React from 'react'
import { DmgShape, DMG_TYPES, fmtInt } from './loadoutHelpers'

/**
 * 2×2 grid showing per-damage-type DPS + alpha.
 * Always shows all 4 types — inactive ones are dimmed.
 */
export default function DamageBreakdown({ dpsPhysical = 0, dpsEnergy = 0, dpsDistortion = 0, dpsThermal = 0, totalAlpha = 0 }) {
  const types = [
    { key: 'physical', dps: dpsPhysical },
    { key: 'energy', dps: dpsEnergy },
    { key: 'distortion', dps: dpsDistortion },
    { key: 'thermal', dps: dpsThermal },
  ]

  return (
    <div className="grid grid-cols-2 gap-px bg-white/[0.03] rounded-md overflow-hidden flex-1">
      {types.map(({ key, dps }) => {
        const active = dps > 0
        const { label } = DMG_TYPES[key]
        return (
          <div key={key} className="flex items-center gap-2 px-3 py-2 bg-sc-dark">
            <DmgShape type={key} size={14} />
            <div>
              <div className={`font-hud text-[18px] leading-none ${active ? `text-[${DMG_TYPES[key].color}]` : 'text-gray-600'}`}
                style={active ? { color: DMG_TYPES[key].color } : undefined}>
                {fmtInt(Math.round(dps))} <span className="text-[12px] text-gray-500">dps</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${active ? 'text-gray-500' : 'text-gray-700'}`}>
                {label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Damage type legend — horizontal row of shape + label */
export function DamageTypeLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-gray-600">
      {Object.entries(DMG_TYPES).map(([key, { label }]) => (
        <span key={key} className="flex items-center gap-1">
          <DmgShape type={key} size={10} /> {label}
        </span>
      ))}
    </div>
  )
}
