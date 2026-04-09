import React from 'react'
import { LayoutGrid, List } from 'lucide-react'

/**
 * Two-button segmented control for switching between grid and list views.
 * Controlled — the parent owns the state and is expected to persist it
 * (e.g. to localStorage.blueprintView). Keeping this component pure makes
 * it easier to test in isolation.
 */
export default function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-white/[0.08] overflow-hidden">
      <ToggleButton
        active={value === 'grid'}
        label="Grid view"
        onClick={() => onChange('grid')}
      >
        <LayoutGrid className="w-[14px] h-[14px]" />
      </ToggleButton>
      <ToggleButton
        active={value === 'list'}
        label="List view"
        onClick={() => onChange('list')}
      >
        <List className="w-[14px] h-[14px]" />
      </ToggleButton>
    </div>
  )
}

function ToggleButton({ active, label, onClick, children }) {
  const base = 'flex items-center gap-1.5 px-3 py-[7px] font-mono text-[10px] uppercase tracking-[0.05em] transition-colors duration-150 cursor-pointer'
  const state = active
    ? 'bg-[var(--hover-bg)] text-[var(--sc-accent)]'
    : 'bg-transparent text-[var(--text-muted)] hover:bg-white/[0.03] hover:text-[var(--text-tertiary)]'
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`${base} ${state}`}
    >
      {children}
      <span>{label.replace(' view', '')}</span>
    </button>
  )
}
