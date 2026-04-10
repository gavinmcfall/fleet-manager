import React from 'react'
import { Star, SlidersHorizontal, Repeat, Clock } from 'lucide-react'
import StatCell from './StatCell'
import { resolveStats } from './statConfig'
import { formatCraftTime } from '../craftingUtils'
import { getResourceColor } from './resourceGroups'

const TYPE_LABEL = { weapons: 'Weapon', armour: 'Armour', ammo: 'Ammo' }

// Solid type-color strip + glow — mockup .card-strip--weapon/armour/ammo
const STRIP_CLASS = {
  weapons: 'bg-[var(--type-weapon)] shadow-[0_0_8px_var(--type-weapon)]',
  armour:  'bg-[var(--type-armour)] shadow-[0_0_8px_var(--type-armour)]',
  ammo:    'bg-[var(--type-ammo)]   shadow-[0_0_8px_var(--type-ammo)]',
}

/**
 * Grid-mode blueprint card — the "Alt D" action-zone card.
 *
 * Styles are a 1:1 lift from frontend/mockups/crafting-v2-reference.html.
 * Every className maps to the corresponding CSS class in that file.
 * If the mockup and this component ever diverge, the mockup wins.
 */
export default function BlueprintCard({
  blueprint,
  isInCompare = false,
  onFavorite = () => {},
  onQualitySim = () => {},
  onCompare = () => {},
  isFavorite = false,
}) {
  const stats = resolveStats(blueprint)
  const name = blueprint.base_stats?.item_name || blueprint.name
  const type = blueprint.type
  const subType = blueprint.sub_type
  const resourceNames = [...new Set((blueprint.slots || []).map(s => s.resource_name))]

  // mockup: .card--selected { border-color, background, box-shadow }
  const selectedStyle = isInCompare
    ? {
        borderColor: 'var(--selected-border)',
        background: 'var(--selected-bg)',
        boxShadow: 'var(--selected-inset), var(--selected-glow), var(--elevation-card)',
      }
    : undefined

  return (
    <article
      role="article"
      data-selected={isInCompare ? 'true' : 'false'}
      // mockup: .card { position:relative, bg, backdrop-blur(10px), border, radius-xl, overflow:hidden }
      // mockup: .card:hover { translateY(-2px), border-color hover-border, shadow elevation-hover, bg card-hover }
      className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--surface-card-border)] bg-[var(--surface-card)] backdrop-blur-[10px] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--hover-border)] hover:bg-[var(--surface-card-hover)]"
      style={{ boxShadow: 'var(--elevation-card)', ...selectedStyle }}
    >
      {/* mockup: .card-strip { height: 3px } */}
      <div className={`h-[3px] ${STRIP_CLASS[type] || ''}`} />

      {/* mockup: .card-body { padding: 14px 14px 12px; flex-col; gap: 12px } */}
      <div className="flex flex-col gap-[12px] px-[14px] pt-[14px] pb-[12px]">

        {/* mockup: .meta-row { font-size: 9px; tracking: 0.05em; color: text-muted } */}
        <div className="flex items-center justify-between font-mono text-[9px] leading-none uppercase tracking-[0.05em] text-[var(--text-muted)]">
          {/* mockup: .type-label { color: text-tertiary } .dim { color: text-muted } */}
          <span className="font-semibold text-[var(--text-tertiary)]">
            {TYPE_LABEL[type] || type} <span className="text-[var(--text-muted)]">· {subType}</span>
          </span>
          {/* mockup: .time-slots { inline-flex; gap: 6px } */}
          <span className="inline-flex items-center gap-[6px]">
            <Clock className="w-2.5 h-2.5 opacity-70" />
            {formatCraftTime(blueprint.craft_time_seconds)}
            <span className="text-[var(--text-subtle)]">·</span>
            {resourceNames.length} slots
          </span>
        </div>

        {/* mockup: .card-name { text-15; line-height: 1.3; semibold; text-primary; letter-spacing: -0.01em } */}
        <h3 className="text-[0.9375rem] font-semibold text-[var(--text-primary)] leading-[1.3] tracking-[-0.01em]">
          {name}
        </h3>

        {/* mockup: .stats-grid { grid 1fr×3; gap: 6px; py: 10px; border-top + border-bottom } */}
        <div className="grid grid-cols-3 gap-[6px] py-[10px] border-t border-b border-[var(--separator-subtle)]">
          {stats.map(stat => (
            <StatCell
              key={stat.key}
              label={stat.label}
              base={stat.base}
              max={stat.max}
              unit={stat.unit}
              isStatic={stat.isStatic}
            />
          ))}
        </div>

        {/* mockup: .resources { flex; gap: 6px; wrap } .resource-dot { font-size: 9px; 6px dot } */}
        <div className="flex items-center gap-[6px] flex-wrap">
          {resourceNames.slice(0, 5).map((rName) => (
            <span key={rName} className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
              <span
                title={rName}
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: getResourceColor(rName) }}
              />
              {rName}
            </span>
          ))}
          {resourceNames.length > 5 && (
            <span className="font-mono text-[9px] text-[var(--text-subtle)]">
              +{resourceNames.length - 5}
            </span>
          )}
        </div>
      </div>

      {/* mockup: .card-actions { grid 1fr×3; gap: 0; border-top }
           .action-btn { padding: 10px 8px; border-right separator-subtle; font-size: 10px; color: text-muted }
           .action-btn:last-child { border-right: none }
           NO individual borders, NO rounding, NO background — just dividers between cells */}
      <div className="grid grid-cols-3 border-t border-[var(--separator-subtle)]">
        <ActionButton
          icon={<Star className="w-3 h-3" fill={isFavorite ? 'currentColor' : 'none'} />}
          label="Fav"
          aria-label="Favorite"
          active={isFavorite}
          activeTint="warn"
          onClick={() => onFavorite(blueprint)}
          divider
        />
        <ActionButton
          icon={<SlidersHorizontal className="w-3 h-3" />}
          label="Sim"
          aria-label="Quality Sim"
          onClick={() => onQualitySim(blueprint)}
          divider
        />
        <ActionButton
          icon={<Repeat className="w-3 h-3" />}
          label={isInCompare ? 'In Tray' : 'Compare'}
          aria-label="Compare"
          active={isInCompare}
          activeTint="accent"
          onClick={() => onCompare(blueprint)}
        />
      </div>
    </article>
  )
}

// mockup: .action-btn { inline-flex center; gap: 6px; py: 10px; font-mono 10px uppercase;
//   color: text-muted; border-right: 1px separator-subtle; transition }
// mockup: .action-btn:hover/.action-btn--active { color: sc-accent; bg: hover-bg }
function ActionButton({ icon, label, onClick, active = false, activeTint, divider = false, ...rest }) {
  const colorCls = active
    ? activeTint === 'warn'
      ? 'text-[var(--sc-warn)] bg-[rgba(245,166,35,0.06)]'
      : 'text-[var(--sc-accent)] bg-[var(--hover-bg)]'
    : 'text-[var(--text-muted)] hover:text-[var(--sc-accent)] hover:bg-[var(--hover-bg)]'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-[6px] py-[10px] px-2 font-mono text-[10px] leading-none uppercase tracking-[0.05em] transition-colors duration-150 cursor-pointer ${colorCls} ${divider ? 'border-r border-[var(--separator-subtle)]' : ''}`}
      {...rest}
    >
      {icon}
      {label}
    </button>
  )
}
