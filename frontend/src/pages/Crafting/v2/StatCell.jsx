import React from 'react'

/**
 * Renders a single stat cell in the blueprint card grid.
 *
 * Styles are a 1:1 lift from frontend/mockups/crafting-v2-reference.html:
 *   .stat-cell  { flex-col; gap: 4px; items-center; text-center }
 *   .stat-label { font-mono 9px uppercase; color: text-muted }
 *   .stat-base  { font-mono 13px semibold; color: text-tertiary }
 *   .stat-arrow { 10px bold; color: rgba(34,211,238,0.6) }
 *   .stat-max   { font-mono 13px bold; color: sc-accent; text-shadow cyan glow }
 *   .stat-unit  { 9px; color: text-muted; margin-left: 2px }
 *
 * Modes:
 *   base → max:   Normal — two values with cyan arrow between
 *   base only:    When isStatic=true (stat has no quality modifier)
 *   base → —:     When max is null on a non-static stat (missing data, surfaced)
 *   single value: When base === max (sameValue, no arrow needed)
 */
export default function StatCell({ label, base, max, unit = '', isStatic = false }) {
  const hasBase = base != null
  const hasMax = max != null
  const sameValue = hasBase && hasMax && base === max
  const showArrow = !isStatic && !sameValue

  return (
    // mockup: .stat-cell { flex-col; gap: 4px (space-2); items-center; text-center }
    <div className="flex flex-col gap-1 items-center text-center">
      {/* mockup: .stat-label { font-mono 9px uppercase tracking 0.05em; color: text-muted } */}
      <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
        {label}
      </div>
      {/* mockup: .stat-range { inline-flex baseline; gap: 4px; font-mono 13px semibold } */}
      <div className="inline-flex items-baseline gap-1 font-mono">
        {/* mockup: .stat-base { color: text-tertiary } */}
        <span className="text-[13px] font-semibold text-[var(--text-tertiary)]">
          {hasBase ? base : '—'}
        </span>
        {showArrow && (
          <>
            {/* mockup: .stat-arrow { color: rgba(34,211,238,0.6); font-weight: regular } */}
            <span className="text-[10px] font-normal text-[rgba(34,211,238,0.6)]">→</span>
            {/* mockup: .stat-max { color: sc-accent; text-shadow: 0 0 6px rgba(34,211,238,0.25) } */}
            <span
              className="text-[13px] font-bold text-[var(--sc-accent)]"
              style={{ textShadow: '0 0 6px rgba(34, 211, 238, 0.25)' }}
            >
              {hasMax ? max : '—'}
            </span>
          </>
        )}
        {/* mockup: .stat-unit { font-size: 9px; color: text-muted; margin-left: 2px; font-weight: regular } */}
        {unit && (hasBase || hasMax) && (
          <span className="ml-[2px] text-[9px] font-normal text-[var(--text-muted)]">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
