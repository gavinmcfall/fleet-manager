/**
 * Per-type stat configuration for the Crafting v2 blueprint card and list view.
 *
 * Each entry:
 *   - label:  Short display name for the sub-column header (capitalized)
 *   - groupLabel: What appears in the grouped header row of the list view
 *   - unit:   Short unit suffix (not used in list view — lives in groupLabel)
 *   - basePath: dotted path into blueprint.base_stats for the base value
 *   - maxPath:  dotted path into blueprint.base_stats for the max value
 *              (fallbacks gracefully if the data isn't there)
 *
 * When new blueprint types are added, extend this config; every component
 * reads from here so there is a single source of truth.
 */

export const STAT_CONFIG = {
  weapons: {
    strip: 'weapon',
    groupLabels: ['DPS', 'RPM', 'Range (m)'],
    stats: [
      { key: 'dps',   label: 'DPS',   unit: 'dmg/s', basePath: 'dps',                maxPath: 'dps_max' },
      { key: 'rpm',   label: 'RPM',   unit: 'rpm',   basePath: 'rounds_per_minute',  maxPath: 'rounds_per_minute_max' },
      { key: 'range', label: 'Range', unit: 'm',     basePath: 'range_m',            maxPath: 'range_m_max' },
    ],
  },
  armour: {
    strip: 'armour',
    groupLabels: ['Phys', 'Energy', 'Stun'],
    stats: [
      { key: 'phys',   label: 'Phys',   unit: '%', basePath: 'resist_physical', maxPath: 'resist_physical_max' },
      { key: 'energy', label: 'Energy', unit: '%', basePath: 'resist_energy',   maxPath: 'resist_energy_max' },
      { key: 'stun',   label: 'Stun',   unit: '%', basePath: 'resist_stun',     maxPath: 'resist_stun_max' },
    ],
  },
  ammo: {
    strip: 'ammo',
    groupLabels: ['Damage', 'Penetration', 'Velocity (m/s)'],
    stats: [
      { key: 'damage',      label: 'DMG', unit: '',    basePath: 'damage',      maxPath: 'damage_max' },
      { key: 'penetration', label: 'PEN', unit: '',    basePath: 'penetration', maxPath: 'penetration_max' },
      { key: 'velocity',    label: 'VEL', unit: 'm/s', basePath: 'velocity',    maxPath: 'velocity_max' },
    ],
  },
}

/**
 * Safely read a dotted path from an object. Returns null on any missing segment.
 *
 *   readStat({ base_stats: { dps: 412 } }, 'dps')     // → 412
 *   readStat({}, 'dps')                                // → null
 *   readStat({ base_stats: null }, 'dps')              // → null
 */
export function readStat(blueprint, path) {
  if (!blueprint || !blueprint.base_stats || !path) return null
  const parts = path.split('.')
  let current = blueprint.base_stats
  for (const part of parts) {
    if (current == null) return null
    current = current[part]
  }
  return current ?? null
}

/**
 * Resolve the three configured stats for a blueprint, returning an array of
 * { key, label, unit, base, max } tuples. Missing values become null.
 */
export function resolveStats(blueprint) {
  const type = blueprint?.type
  const config = STAT_CONFIG[type]
  if (!config) return []

  return config.stats.map(stat => ({
    key: stat.key,
    label: stat.label,
    unit: stat.unit,
    base: readStat(blueprint, stat.basePath),
    max: readStat(blueprint, stat.maxPath) ?? readStat(blueprint, stat.basePath),
  }))
}
