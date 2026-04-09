import React from 'react'
import { STAT_CONFIG } from './statConfig'

const GRID_TEMPLATE =
  '4px 32px minmax(140px, 1fr) 68px 68px 68px 68px 68px 68px 96px 108px'

/**
 * Two-row sticky header for BlueprintListView.
 *
 * Row 1 — group labels ("DPS", "RPM", "Range (m)") centered over their
 * base+max pairs with a border-right for the group separator (header-only).
 * Row 2 — sortable sub-headers: Name, Base, Max, Base, Max, Base, Max, Craft, Actions.
 *
 * Props:
 *   type       — 'weapons' | 'armour' | 'ammo' (drives the group labels)
 *   sortColumn — currently active sort column key
 *   sortDir    — 'asc' | 'desc'
 *   onSort(col) — invoked on sortable header click
 */
export default function BlueprintListHeader({ type, sortColumn, sortDir, onSort }) {
  const config = STAT_CONFIG[type]
  if (!config) return null
  const groupLabels = config.groupLabels
  const statKeys = config.stats.map(s => s.key) // ['dps', 'rpm', 'range']

  return (
    <div
      className="sticky top-0 z-20 border-b border-[rgba(34,211,238,0.15)] bg-[var(--surface-header)] backdrop-blur-xl"
      style={{ boxShadow: 'var(--elevation-sticky)' }}
    >
      {/* Row 1 — group labels */}
      <div
        className="grid items-center font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--sc-accent2)]"
        style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: '760px' }}
      >
        <div />
        <div />
        <div />
        <GroupHeader label={groupLabels[0]} />
        <GroupHeader label={groupLabels[1]} />
        <GroupHeader label={groupLabels[2]} />
        <div />
        <div />
      </div>

      {/* Row 2 — sub-headers */}
      <div
        className="grid items-center font-mono text-[9px] uppercase tracking-[0.1em] font-semibold text-[var(--text-muted)] border-t border-[var(--separator-subtle)]"
        style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: '760px' }}
      >
        <div />
        <div />
        <SortableCell
          colKey="name"
          label="Name"
          sortColumn={sortColumn}
          sortDir={sortDir}
          onSort={onSort}
          align="start"
        />
        <SortableCell colKey={`${statKeys[0]}_base`} label="Base" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
        <SortableCell colKey={`${statKeys[0]}_max`}  label="Max"  sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} separator />
        <SortableCell colKey={`${statKeys[1]}_base`} label="Base" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
        <SortableCell colKey={`${statKeys[1]}_max`}  label="Max"  sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} separator />
        <SortableCell colKey={`${statKeys[2]}_base`} label="Base" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
        <SortableCell colKey={`${statKeys[2]}_max`}  label="Max"  sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} separator />
        <SortableCell colKey="craft" label="Craft" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} extraPadding />
        <div className="flex items-center justify-end pr-3 py-[11px]">Actions</div>
      </div>
    </div>
  )
}

function GroupHeader({ label }) {
  return (
    <div
      className="col-span-2 flex items-center justify-center px-[10px] pt-[11px] pb-[6px] whitespace-nowrap text-[var(--sc-accent2)] border-r border-[var(--separator)]"
      style={{ textShadow: '0 0 8px rgba(91, 155, 213, 0.2)' }}
    >
      {label}
    </div>
  )
}

function SortableCell({ colKey, label, sortColumn, sortDir, onSort, align = 'end', separator = false, extraPadding = false }) {
  const isActive = sortColumn === colKey
  const caret = isActive ? (sortDir === 'asc' ? '▴' : '▾') : '↕'
  const justify = align === 'start' ? 'justify-start' : 'justify-end'
  const sep = separator ? 'border-r border-[var(--separator)]' : ''
  const padLeft = align === 'start' ? 'pl-2' : ''
  const padCraftLeft = extraPadding ? 'pl-6' : ''

  const activeCls = isActive
    ? 'text-[var(--sc-accent)] bg-[rgba(34,211,238,0.04)]'
    : 'hover:bg-[var(--hover-bg)] hover:text-[var(--text-secondary)]'

  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className={`flex items-center ${justify} gap-1 px-[10px] pt-[7px] pb-[10px] ${padLeft} ${padCraftLeft} ${sep} ${activeCls} transition-colors duration-150 cursor-pointer font-mono text-[9px] uppercase tracking-[0.1em] font-semibold rounded-sm`}
    >
      <span>{label}</span>
      <span className={isActive ? 'opacity-100' : 'opacity-50'} style={{ fontSize: '10px' }}>{caret}</span>
    </button>
  )
}
