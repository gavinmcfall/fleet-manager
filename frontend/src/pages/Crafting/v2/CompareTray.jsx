import React from 'react'
import { Repeat } from 'lucide-react'

const TYPE_DOT_COLOR = {
  weapons: 'var(--type-weapon)',
  armour:  'var(--type-armour)',
  ammo:    'var(--type-ammo)',
}

/**
 * Bottom-anchored compare tray for the Crafting v2 page.
 *
 * Patterned on frontend/src/pages/LootDB/CompareDrawer.jsx. Shows up to 3
 * chips, a clear button, and a Compare CTA. Returns null (nothing rendered)
 * when items is empty, so the parent can render unconditionally.
 */
export default function CompareTray({ items, onRemove, onClear, onCompareClick = () => {} }) {
  if (!items || items.length === 0) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 animate-[slideUp_300ms_ease-out]">
      <div
        className="mx-auto max-w-[1400px] px-4 pb-4"
        style={{ filter: 'drop-shadow(0 -4px 12px rgba(0,0,0,0.3))' }}
      >
        <div
          className="rounded-[var(--radius-2xl)] border border-[rgba(34,211,238,0.2)] bg-[var(--surface-header)] backdrop-blur-xl overflow-hidden"
          style={{ boxShadow: 'var(--elevation-modal)' }}
        >
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--sc-accent2)]">
              <Repeat className="w-[14px] h-[14px]" />
              Compare ({items.length}/3)
            </div>
            <div className="flex gap-2 flex-1 overflow-x-auto">
              {items.map(bp => (
                <CompareChip key={bp.id} blueprint={bp} onRemove={() => onRemove(bp)} />
              ))}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-[7px] rounded-[var(--radius-md)] border border-white/10 text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-[0.05em] cursor-pointer hover:text-white hover:border-white/20"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onCompareClick}
              disabled={items.length < 2}
              className="px-[14px] py-[7px] rounded-[var(--radius-md)] bg-[var(--sc-accent)] text-[var(--sc-darker)] font-mono text-[10px] uppercase tracking-[0.1em] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 12px rgba(34,211,238,0.3)' }}
            >
              Compare →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompareChip({ blueprint, onRemove }) {
  const name = blueprint.base_stats?.item_name || blueprint.name
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] px-2 py-1 pl-[10px] rounded-[var(--radius-md)] font-mono text-[10px] text-[var(--text-secondary)] max-w-[200px]">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: TYPE_DOT_COLOR[blueprint.type] || 'currentColor' }}
      />
      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{name}</span>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="text-[var(--text-muted)] font-bold cursor-pointer px-0.5 hover:text-white"
      >
        ×
      </button>
    </span>
  )
}
