import React from 'react'
import { Star, SlidersHorizontal, Repeat, Clock, Layers } from 'lucide-react'
import StatCell from './StatCell'
import { resolveStats } from './statConfig'
import { formatTime } from '../craftingUtils'

const TYPE_LABEL = { weapons: 'Weapon', armour: 'Armour', ammo: 'Ammo' }

const STRIP_CLASS = {
  weapons: 'bg-gradient-to-r from-[var(--type-weapon)] to-[rgba(245,166,35,0.3)]',
  armour:  'bg-gradient-to-r from-[var(--type-armour)] to-[rgba(167,139,250,0.3)]',
  ammo:    'bg-gradient-to-r from-[var(--type-ammo)]   to-[rgba(46,196,182,0.3)]',
}

const TYPE_TEXT = {
  weapons: 'text-[var(--type-weapon)]',
  armour:  'text-[var(--type-armour)]',
  ammo:    'text-[var(--type-ammo)]',
}

// Generate a stable color for each distinct resource name. The palette has
// 5 colors — accepted limit for now; replace with per-resource icons later.
const RESOURCE_PALETTE = ['#a78bfa', '#22d3ee', '#f5a623', '#2ec4b6', '#5b9bd5']
function colorForResource(name, index) {
  return RESOURCE_PALETTE[index % RESOURCE_PALETTE.length]
}

/**
 * Grid-mode blueprint card — the "Alt D" action-zone card from the v10 spec.
 *
 * Always-visible action row at the bottom. Selected state adds a left-edge
 * accent bar and border glow. Hover adds lift + subtle cyan shadow.
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

  const selectedStyle = isInCompare
    ? {
        borderColor: 'var(--selected-border)',
        boxShadow:
          '0 12px 32px rgba(0,0,0,0.45), inset 3px 0 0 var(--sc-accent), 0 0 24px rgba(34,211,238,0.12)',
      }
    : undefined

  return (
    <article
      role="article"
      data-selected={isInCompare ? 'true' : 'false'}
      className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--surface-card-border)] bg-[var(--surface-card)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--hover-border)] hover:shadow-[var(--elevation-hover)]"
      style={{ boxShadow: 'var(--elevation-card)', ...selectedStyle }}
    >
      {/* Type strip */}
      <div className={`h-1 ${STRIP_CLASS[type] || ''}`} />

      {/* Body */}
      <div className="px-4 pt-[14px] pb-[10px]">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
          <span className={`font-semibold ${TYPE_TEXT[type] || ''}`}>
            <span>{TYPE_LABEL[type] || type}</span>
            {' · '}
            <span
              aria-label={subType ? subType.charAt(0).toUpperCase() + subType.slice(1) : ''}
              title={subType ? subType.charAt(0).toUpperCase() + subType.slice(1) : ''}
              data-label={subType ? subType.charAt(0).toUpperCase() + subType.slice(1) : ''}
              className="before:content-[attr(data-label)]"
            />
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-2.5 h-2.5 opacity-70" />
            {formatTime(blueprint.craft_time_seconds)}
            <span className="text-[var(--text-subtle)] mx-1">·</span>
            <Layers className="w-2.5 h-2.5 opacity-70" />
            {blueprint.slots?.length || 0}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-[15px] font-semibold text-white leading-tight mb-3">
          {name}
        </h3>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 pb-[10px] border-b border-[var(--separator-subtle)] mb-[10px]">
          {stats.map(stat => (
            <StatCell
              key={stat.key}
              label={stat.label}
              base={stat.base}
              max={stat.max}
              unit={stat.unit}
            />
          ))}
        </div>

        {/* Resource dots */}
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span className="font-mono uppercase tracking-[0.05em]">Mats</span>
          <div className="flex items-center gap-1">
            {resourceNames.slice(0, 5).map((name, i) => (
              <span
                key={name}
                title={name}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colorForResource(name, i) }}
              />
            ))}
            {resourceNames.length > 5 && (
              <span className="ml-0.5 text-[9px] font-mono text-[var(--text-subtle)]">
                +{resourceNames.length - 5}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action zone */}
      <div className="flex gap-1 px-[14px] py-2 bg-[var(--surface-inset)] border-t border-[var(--separator-subtle)]">
        <ActionButton
          icon={<Star className="w-[11px] h-[11px]" fill={isFavorite ? 'currentColor' : 'none'} />}
          label="Fav"
          aria-label="Favorite"
          active={isFavorite}
          activeTint="warn"
          onClick={() => onFavorite(blueprint)}
        />
        <ActionButton
          icon={<SlidersHorizontal className="w-[11px] h-[11px]" />}
          label="Sim"
          aria-label="Quality Sim"
          onClick={() => onQualitySim(blueprint)}
        />
        <ActionButton
          icon={<Repeat className="w-[11px] h-[11px]" />}
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

function ActionButton({ icon, label, onClick, active = false, activeTint, ...rest }) {
  const base =
    'flex-1 flex items-center justify-center gap-[5px] px-2 py-[7px] rounded-[var(--radius-md)] ' +
    'border font-mono text-[10px] uppercase tracking-[0.05em] font-medium ' +
    'transition-colors duration-150 cursor-pointer'

  const inactive =
    'bg-transparent border-white/[0.08] text-[var(--text-tertiary)] ' +
    'hover:bg-[var(--hover-bg)] hover:border-[var(--hover-border)] hover:text-[var(--sc-accent)]'

  const activeWarn =
    'bg-[rgba(245,166,35,0.1)] border-[rgba(245,166,35,0.35)] text-[var(--sc-warn)]'

  const activeAccent =
    'bg-[rgba(34,211,238,0.12)] border-[rgba(34,211,238,0.45)] text-[var(--sc-accent)]'

  const activeCls = active
    ? activeTint === 'warn' ? activeWarn : activeAccent
    : inactive

  return (
    <button type="button" onClick={onClick} className={`${base} ${activeCls}`} {...rest}>
      {icon}
      {label}
    </button>
  )
}
