/**
 * Derives a high-level category from a blueprint row.
 *
 * Maps the wide spread of `type` values (weapons, armour, cooler,
 * powerplant, shield, radar, quantumdrive, mininglaser, tractorbeam,
 * salvage, ammo, unknown) into the five tabs the UI exposes.
 *
 * The FPS-vs-Ship split for weapons keys on the BP_CRAFT tag's case:
 * CIG ships FPS weapon class names lowercase
 * (BP_CRAFT_behr_lmg_ballistic_01) and ship-mounted weapon class names
 * uppercase (BP_CRAFT_BANU_TachyonCannon_S1). Verified against the full
 * 4.8 PTU p4k — every BP follows this convention.
 */

export const SHIP_COMPONENT_TYPES = new Set([
  'cooler',
  'powerplant',
  'shield',
  'radar',
  'quantumdrive',
  'mininglaser',
  'tractorbeam',
  'salvage',
])

export function deriveCategory(blueprint) {
  const t = blueprint?.type
  if (!t) return 'other'

  if (t === 'armour') return 'fps_armour'
  if (t === 'ammo') return 'fps_ammo'

  if (t === 'weapons') {
    const tag = blueprint.tag || ''
    const stripped = tag.replace(/^BP_CRAFT_/i, '')
    // First char uppercase A-Z → ship weapon (vehicle class names ship
    // uppercase). Lowercase or digit → FPS handheld.
    const first = stripped.charAt(0)
    if (first >= 'A' && first <= 'Z') return 'ship_weapon'
    return 'fps_weapon'
  }

  if (SHIP_COMPONENT_TYPES.has(t)) return 'ship_component'

  return 'other'
}

/**
 * Parses a size value (1-7) from a class name / tag suffix.
 *
 * Looks for `_S{n}` near the end of the stripped tag — e.g.
 * BANU_TachyonCannon_S1 → 1, ESPR_LaserCannon_S6 → 6,
 * BEHR_BallisticCannon_VNG_S2 → 2.
 *
 * Returns null when no size suffix is present.
 */
export function parseSize(blueprint) {
  const tag = blueprint?.tag || ''
  const stripped = tag.replace(/^BP_CRAFT_/i, '')
  const m = /_S(\d+)(?:_|$)/i.exec(stripped)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/**
 * For ship components, return a more specific component-type label
 * (which differs from the broad category 'ship_component'). Falls back
 * to the raw type when not recognised.
 */
const SHIP_COMPONENT_LABELS = {
  cooler:       'Cooler',
  powerplant:   'Powerplant',
  shield:       'Shield',
  radar:        'Radar',
  quantumdrive: 'Quantum Drive',
  mininglaser:  'Mining Laser',
  tractorbeam:  'Tractor Beam',
  salvage:      'Salvage',
}

export function shipComponentLabel(type) {
  return SHIP_COMPONENT_LABELS[type] || type
}

/**
 * Per-category sub-filter axis configuration. The browser uses this to
 * render a chip row beneath the search input. Each axis declares:
 *  - key: filter state slot
 *  - label: legend
 *  - extract: bp → string|number|null (the value to count by)
 *  - format: optional (value) => display label override
 *  - order: optional explicit ordering (otherwise descending by count)
 */
export const SUB_FILTERS = {
  fps_weapon: {
    key: 'fps_weapon_subtype',
    label: 'Weapon type',
    extract: (bp) => bp.sub_type || null,
    order: ['rifle', 'sniper', 'lmg', 'smg', 'shotgun', 'pistol'],
  },
  fps_armour: {
    key: 'fps_armour_role',
    label: 'Role',
    extract: (bp) => bp.sub_type || null,
    order: [
      'combat', 'engineer', 'hunter', 'stealth', 'flightsuit',
      'undersuit', 'medic', 'miner', 'salvager', 'explorer',
      'environment', 'cosmonaut', 'racer', 'radiation',
    ],
  },
  fps_ammo: {
    key: 'ammo_type',
    label: 'Ammo type',
    extract: (bp) => bp.sub_type || null,
    order: ['ballistic', 'electron', 'laser', 'plasma', 'shotgun'],
  },
  ship_weapon: {
    key: 'ship_weapon_size',
    label: 'Size',
    extract: parseSize,
    format: (v) => `S${v}`,
    order: [1, 2, 3, 4, 5, 6, 7],
  },
  ship_component: {
    key: 'ship_component_type',
    label: 'Component',
    extract: (bp) => bp.type,
    format: shipComponentLabel,
    order: [
      'cooler', 'powerplant', 'shield', 'radar', 'quantumdrive',
      'mininglaser', 'tractorbeam', 'salvage',
    ],
  },
}
