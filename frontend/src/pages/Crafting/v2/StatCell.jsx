import React from 'react'

/**
 * Renders a single stat as:   LABEL
 *                             base → max unit
 *
 * - Null base or max renders as an em dash placeholder (base surfaces
 *   missing max values as `base → —` so architectural data gaps don't
 *   get silently hidden).
 * - When base === max, the arrow is hidden and a single number is shown.
 * - When `isStatic` is true, the arrow and max cell are suppressed
 *   entirely — use for stats that don't scale with crafting quality
 *   (weapon range, ammo velocity). The base + unit render alone.
 * - The unit is styled subtly and omitted if empty.
 *
 * Used in BlueprintCard (grid mode) only. The list view renders the
 * same values into separate sortable base/max columns.
 */
export default function StatCell({ label, base, max, unit = '', isStatic = false }) {
  const hasBase = base != null
  const hasMax = max != null
  const sameValue = hasBase && hasMax && base === max
  const showArrow = !isStatic && !sameValue

  return (
    <div className="flex flex-col gap-[2px]">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-subtle)]">
        {label}
      </div>
      <div className="flex items-baseline gap-[3px] font-mono">
        <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">
          {hasBase ? base : '—'}
        </span>
        {showArrow && (
          <>
            <span className="text-[10px] font-bold text-[rgba(34,211,238,0.6)]">→</span>
            <span
              className="text-[13px] font-bold text-white"
              style={{ textShadow: '0 0 6px rgba(34, 211, 238, 0.25)' }}
            >
              {hasMax ? max : '—'}
            </span>
          </>
        )}
        {unit && (hasBase || hasMax) && (
          <span className="ml-[4px] text-[9px] font-medium text-[var(--text-muted)]">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
