import React from 'react'

const TYPES = [
  { key: 'weapons', label: 'Weapons', activeClass: 'type-switcher-pill--weapons' },
  { key: 'armour',  label: 'Armour',  activeClass: 'type-switcher-pill--armour' },
  { key: 'ammo',    label: 'Ammo',    activeClass: 'type-switcher-pill--ammo' },
]

const BASE_CLS =
  'px-[18px] py-[8px] rounded-full font-mono text-[11px] uppercase ' +
  'tracking-[0.08em] font-semibold border transition-colors duration-150 ' +
  'bg-white/[0.02] border-white/[0.08] text-[var(--text-muted)] ' +
  'hover:border-white/[0.18] hover:text-[var(--text-tertiary)]'

const ACTIVE_WEAPON =
  'bg-[rgba(245,166,35,0.12)] border-[rgba(245,166,35,0.45)] ' +
  'text-[var(--type-weapon)] shadow-[0_0_12px_rgba(245,166,35,0.15)] ' +
  'hover:border-[rgba(245,166,35,0.45)]'

const ACTIVE_ARMOUR =
  'bg-[rgba(167,139,250,0.12)] border-[rgba(167,139,250,0.45)] ' +
  'text-[var(--type-armour)] shadow-[0_0_12px_rgba(167,139,250,0.15)] ' +
  'hover:border-[rgba(167,139,250,0.45)]'

const ACTIVE_AMMO =
  'bg-[rgba(46,196,182,0.12)] border-[rgba(46,196,182,0.45)] ' +
  'text-[var(--type-ammo)] shadow-[0_0_12px_rgba(46,196,182,0.15)] ' +
  'hover:border-[rgba(46,196,182,0.45)]'

const ACTIVE_BY_TYPE = {
  weapons: ACTIVE_WEAPON,
  armour:  ACTIVE_ARMOUR,
  ammo:    ACTIVE_AMMO,
}

/**
 * Three-pill segmented control. Exactly one pill is always active — clicking
 * the already-active pill is a no-op. Blueprints is one-type-at-a-time, so
 * there's no "All Types" fallback.
 */
export default function TypeSwitcher({ activeType, onChange }) {
  const handleClick = (type) => {
    if (type === activeType) return
    onChange(type)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] mr-2">
        Browsing
      </span>
      {TYPES.map(({ key, label }) => {
        const isActive = activeType === key
        const cls = isActive ? `${BASE_CLS} ${ACTIVE_BY_TYPE[key]}` : BASE_CLS
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            className={cls}
            onClick={() => handleClick(key)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
