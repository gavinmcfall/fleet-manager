import React from 'react'

// Five categories. The 'category' key is what the parent filters on
// (added in index.jsx via deriveCategory). Colours map to the type-color
// CSS vars where they exist; the new ship_* categories share the weapon
// + accent palette.
const TYPES = [
  { key: 'fps_weapon',     label: 'FPS Weapons' },
  { key: 'fps_armour',     label: 'FPS Armour' },
  { key: 'fps_ammo',       label: 'Ammo' },
  { key: 'ship_weapon',    label: 'Ship Weapons' },
  { key: 'ship_component', label: 'Ship Components' },
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

const ACTIVE_SHIP_WEAPON =
  'bg-[rgba(245,166,35,0.08)] border-[rgba(245,166,35,0.35)] ' +
  'text-[rgb(245,200,90)] shadow-[0_0_12px_rgba(245,166,35,0.1)] ' +
  'hover:border-[rgba(245,166,35,0.35)]'

const ACTIVE_SHIP_COMPONENT =
  'bg-[rgba(34,211,238,0.10)] border-[rgba(34,211,238,0.40)] ' +
  'text-[var(--sc-accent)] shadow-[0_0_12px_rgba(34,211,238,0.15)] ' +
  'hover:border-[rgba(34,211,238,0.40)]'

const ACTIVE_BY_TYPE = {
  fps_weapon:     ACTIVE_WEAPON,
  fps_armour:     ACTIVE_ARMOUR,
  fps_ammo:       ACTIVE_AMMO,
  ship_weapon:    ACTIVE_SHIP_WEAPON,
  ship_component: ACTIVE_SHIP_COMPONENT,
}

/**
 * Five-pill segmented control. Exactly one pill is always active.
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
