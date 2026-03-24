// Shared helpers for crafting pages

export const TYPE_LABELS = {
  armour: 'Armour',
  weapons: 'Weapons',
  ammo: 'Ammo',
}

// Display order for type filter pills — ammo last since players care about it least
export const TYPE_ORDER = ['armour', 'weapons', 'ammo']

export const SUBTYPE_LABELS = {
  combat: 'Combat',
  engineer: 'Engineer',
  hunter: 'Hunter',
  stealth: 'Stealth',
  miner: 'Miner',
  explorer: 'Explorer',
  cosmonaut: 'Cosmonaut',
  environment: 'Environment',
  salvager: 'Salvager',
  medic: 'Medic',
  radiation: 'Radiation',
  flightsuit: 'Flightsuit',
  racer: 'Racer',
  undersuit: 'Undersuit',
  pistol: 'Pistol',
  rifle: 'Rifle',
  smg: 'SMG',
  sniper: 'Sniper',
  shotgun: 'Shotgun',
  lmg: 'LMG',
  ballistic: 'Ballistic',
  laser: 'Laser',
  electron: 'Electron',
  plasma: 'Plasma',
}

export const TYPE_COLORS = {
  armour: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  weapons: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  ammo: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
}

export function formatTime(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// Deterministic color from resource name → HSL hue
export function resourceHue(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ((hash % 360) + 360) % 360
}

export function resourceColor(name) {
  const hue = resourceHue(name)
  return `hsl(${hue}, 70%, 65%)`
}

export function resourceBgColor(name) {
  const hue = resourceHue(name)
  return `hsla(${hue}, 70%, 50%, 0.15)`
}

export function resourceBorderColor(name) {
  const hue = resourceHue(name)
  return `hsla(${hue}, 70%, 50%, 0.3)`
}

// Interpolate modifier value at a given quality
export function interpolateModifier(mod, quality) {
  if (quality <= mod.start_quality) return mod.modifier_at_start
  if (quality >= mod.end_quality) return mod.modifier_at_end
  const t = (quality - mod.start_quality) / (mod.end_quality - mod.start_quality)
  return mod.modifier_at_start + (mod.modifier_at_end - mod.modifier_at_start) * t
}

// Format quantity — values are in SCU (Standard Cargo Units)
// 1 SCU = 100 cSCU = 1,000,000 µSCU
// Sub-SCU amounts shown in cSCU for readability.
export function formatQuantity(qty) {
  if (qty == null) return '—'
  if (qty >= 1) {
    const formatted = parseFloat(qty.toFixed(2))
    return `${formatted} SCU`
  }
  const cscu = qty * 100
  const formatted = parseFloat(cscu.toFixed(1))
  return `${formatted} cSCU`
}

// All three unit representations for tooltip display
export function quantityUnits(qty) {
  if (qty == null) return []
  const scu = parseFloat(qty.toFixed(4))
  const cscu = parseFloat((qty * 100).toFixed(1))
  const uscu = Math.round(qty * 1_000_000)
  return [
    { value: scu, unit: 'SCU' },
    { value: cscu, unit: 'cSCU' },
    { value: uscu.toLocaleString(), unit: 'µSCU' },
  ]
}

// --- Stat display system ---
// Raw modifiers are engine multipliers (0.8 = 80% of raw stat, 1.2 = 120%).
// Players don't care about multipliers — they care about gameplay effects.
// Q1000 (modifier_at_end) is ALWAYS the best crafting outcome.
//
// STAT_INFO maps engine keys to:
//   label: human-readable stat name (describes the EFFECT, not the parameter)
//   description: what this means in gameplay
//   invertDisplay: if true, the multiplier goes DOWN at best quality but the
//     effect is POSITIVE (e.g. recoil multiplier 0.8 = "20% less recoil")

export const STAT_INFO = {
  weapon_recoil_kick: {
    label: 'Recoil Kick',
    description: 'How much the weapon jumps when fired',
    invertDisplay: true,
    goodWord: 'less',    // "36% less recoil kick"
    badWord: 'more',     // "20% more recoil kick"
  },
  weapon_recoil_handling: {
    label: 'Recoil Recovery',
    description: 'How fast the weapon settles after firing',
    invertDisplay: true,
    goodWord: 'faster',
    badWord: 'slower',
  },
  weapon_recoil_smoothness: {
    label: 'Recoil Stability',
    description: 'How predictable and tight the recoil pattern is',
    invertDisplay: true,
    goodWord: 'smoother',
    badWord: 'rougher',
  },
  weapon_spread: {
    label: 'Accuracy',
    description: 'Bullet grouping tightness',
    invertDisplay: true,
    goodWord: 'tighter',
    badWord: 'wider',
  },
  weapon_damage: {
    label: 'Damage',
    description: 'Damage dealt per hit',
    invertDisplay: false,
    goodWord: 'more',
    badWord: 'less',
  },
  weapon_firerate: {
    label: 'Fire Rate',
    description: 'Rounds fired per minute',
    invertDisplay: false,
    goodWord: 'faster',
    badWord: 'slower',
  },
  weapon_reloadspeed: {
    label: 'Reload Speed',
    description: 'Time to reload a magazine',
    invertDisplay: false,
    goodWord: 'faster',
    badWord: 'slower',
  },
  armor_damagemitigation: {
    label: 'Damage Mitigation',
    description: 'How much damage is absorbed by armour',
    invertDisplay: false,
    goodWord: 'more',
    badWord: 'less',
  },
  armor_temperaturemax: {
    label: 'Heat Tolerance',
    description: 'Maximum temperature before taking heat damage',
    invertDisplay: false,
    goodWord: 'higher',
    badWord: 'lower',
  },
  armor_temperaturemin: {
    label: 'Cold Tolerance',
    description: 'Minimum temperature before taking cold damage',
    invertDisplay: false,
    goodWord: 'higher',
    badWord: 'lower',
  },
}

// Get the user-facing label for a stat
export function getStatLabel(key, fallbackName) {
  return STAT_INFO[key]?.label || fallbackName || key
}

export function getStatDescription(key) {
  return STAT_INFO[key]?.description || null
}

// Convert a raw multiplier into a user-facing improvement percentage.
// For inverted stats (recoil): multiplier 0.8 → +20% improvement (less recoil)
// For normal stats (damage):   multiplier 1.1 → +10% improvement (more damage)
// Returns a number where positive = better, negative = worse.
export function multiplierToImprovement(key, multiplier) {
  const info = STAT_INFO[key]
  const change = (multiplier - 1) * 100
  if (info?.invertDisplay) return -change  // flip: 0.8 (−20% raw) → +20% improvement
  return change                             // 1.1 (+10% raw) → +10% improvement
}

// Format an improvement value as a bare number (no sign, no word)
export function formatImprovementPct(improvement) {
  return `${Math.abs(improvement).toFixed(0)}%`
}

// Format an improvement with a word describing the effect
// e.g. "36% less" for recoil kick, "12% faster" for fire rate
export function formatImprovementWithWord(key, improvement) {
  const info = STAT_INFO[key]
  const pct = Math.abs(improvement).toFixed(0)
  if (Math.abs(improvement) < 0.05) return 'no change'
  const word = improvement > 0
    ? (info?.goodWord || 'better')
    : (info?.badWord || 'worse')
  return `${pct}% ${word}`
}

// What's the maximum possible improvement at Q1000?
export function maxImprovement(key, bestMultiplier) {
  return multiplierToImprovement(key, bestMultiplier)
}

// Quality progress: 0 = Q0 (worst), 1 = Q1000 (best)
export function qualityProgress(mod, currentMultiplier) {
  const range = mod.modifier_at_end - mod.modifier_at_start
  if (Math.abs(range) < 0.0001) return 0.5
  return (currentMultiplier - mod.modifier_at_start) / range
}

// Map modifier keys → base_stats field + display unit
// Used to show actual values (e.g. "650 RPM → 728 RPM") alongside percentages
export const STAT_BASE_FIELD = {
  weapon_firerate: { field: 'rounds_per_minute', unit: 'RPM', decimals: 0 },
  weapon_damage: { field: 'damage', unit: 'dmg', decimals: 1 },
}

// Compute the actual value from base stat × multiplier
export function computeActualValue(key, baseStats, multiplier) {
  const mapping = STAT_BASE_FIELD[key]
  if (!mapping || !baseStats) return null
  const baseVal = baseStats[mapping.field]
  if (baseVal == null) return null
  return {
    base: baseVal,
    crafted: baseVal * multiplier,
    unit: mapping.unit,
    decimals: mapping.decimals,
  }
}

export function formatActualValue(value, decimals = 0) {
  if (value == null) return null
  return Number(value).toFixed(decimals)
}

// Compute DPS from damage and RPM
export function computeDPS(damage, rpm) {
  if (!damage || !rpm) return null
  return damage * rpm / 60
}

// Base weapon stats to display as a reference panel
// Only stats that exist on fps_weapons and are useful context
export const BASE_STAT_DISPLAY = [
  { field: 'damage', label: 'Damage', unit: 'dmg', decimals: 1 },
  { field: 'rounds_per_minute', label: 'RPM', unit: '', decimals: 0 },
  { field: 'dps', label: 'DPS', unit: '', decimals: 1 },
  { field: 'spread_min', label: 'Spread', unit: '', decimals: 1, paired: 'spread_max' },
  { field: 'effective_range', label: 'Range', unit: 'm', decimals: 0 },
  { field: 'projectile_speed', label: 'Proj Speed', unit: 'm/s', decimals: 0 },
  { field: 'ammo_capacity', label: 'Ammo', unit: 'rds', decimals: 0 },
]

// --- Mining location helpers ---

// Error function approximation (Abramowitz & Stegun)
function erf(x) {
  const sign = x >= 0 ? 1 : -1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return sign * y
}

// Gaussian CDF: probability that X <= x given mean/stddev
function normalCDF(x, mean, stddev) {
  if (stddev <= 0) return x >= mean ? 1 : 0
  return 0.5 * (1 + erf((x - mean) / (stddev * Math.SQRT2)))
}

// Compute probability for each quality band, clamped to [min_quality, max_quality]
// Returns array of { label, probability } for bands 0-200, 200-400, etc.
export const QUALITY_BANDS = [
  { label: '0–200', min: 0, max: 200 },
  { label: '200–400', min: 200, max: 400 },
  { label: '400–600', min: 400, max: 600 },
  { label: '600–800', min: 600, max: 800 },
  { label: '800–1000', min: 800, max: 1000 },
]

export function qualityBandProbabilities(quality) {
  if (!quality) return null
  const { min_quality, max_quality, mean, stddev } = quality
  // Total probability mass within the clamped range
  const totalMass = normalCDF(max_quality, mean, stddev) - normalCDF(min_quality, mean, stddev)
  if (totalMass < 0.0001) return null

  return QUALITY_BANDS.map(band => {
    // Intersect band with [min_quality, max_quality]
    const lo = Math.max(band.min, min_quality)
    const hi = Math.min(band.max, max_quality)
    if (lo >= hi) return { ...band, probability: 0 }
    const mass = normalCDF(hi, mean, stddev) - normalCDF(lo, mean, stddev)
    return { ...band, probability: mass / totalMass }
  })
}

// Location name humanization
const LOCATION_NAMES = {
  HPP_Stanton1: 'Hurston Orbit',
  HPP_Stanton1a: 'Aberdeen',
  HPP_Stanton1b: 'Arial',
  HPP_Stanton1c: 'Ita',
  HPP_Stanton1d: 'Magda',
  HPP_Stanton2a: 'Cellin',
  HPP_Stanton2b: 'Daymar',
  HPP_Stanton2c: 'Yela',
  HPP_Stanton2c_Belt: 'Yela Belt',
  HPP_Stanton3a: 'Lyria',
  HPP_Stanton3b: 'Wala',
  HPP_Stanton4: 'microTech Orbit',
  HPP_Stanton4a: 'Calliope',
  HPP_Stanton4b: 'Clio',
  HPP_Stanton4c: 'Euterpe',
  HPP_AaronHalo: 'Aaron Halo Belt',
  HPP_Lagrange_A: 'Lagrange A (HUR-L1)',
  HPP_Lagrange_B: 'Lagrange B (HUR-L2)',
  HPP_Lagrange_C: 'Lagrange C (CRU-L1)',
  HPP_Lagrange_D: 'Lagrange D (ARC-L1)',
  HPP_Lagrange_E: 'Lagrange E (MIC-L1)',
  HPP_Lagrange_F: 'Lagrange F (HUR-L3)',
  HPP_Lagrange_G: 'Lagrange G (HUR-L4)',
  HPP_Lagrange_Occupied: 'Lagrange (Occupied)',
  HPP_ShipGraveyard_001: 'Ship Graveyard',
  HPP_SpaceDerelict_General: 'Space Derelict',
  HPP_ResourceRush_Gold: 'Gold Rush Event',
  HPP_ResourceRush_Gold_HighDensity: 'Gold Rush (High)',
  AsteroidCluster_Low_Yield: 'Low Yield Cluster',
  AsteroidCluster_Medium_Yield: 'Medium Yield Cluster',
  HPP_Pyro1: 'Pyro I',
  HPP_Pyro2: 'Pyro II',
  HPP_Pyro3: 'Pyro III',
  HPP_Pyro4: 'Pyro IV',
  HPP_Pyro5a: 'Ignis',
  HPP_Pyro5b: 'Vatra',
  HPP_Pyro5c: 'Adir',
  HPP_Pyro5d: 'Fairo',
  HPP_Pyro5e: 'Fuego',
  HPP_Pyro5f: 'Vuur',
  HPP_Pyro6: 'Pyro VI',
  HPP_Pyro_AkiroCluster: 'Akiro Cluster',
  HPP_Pyro_Cool01: 'Pyro Cool Belt 1',
  HPP_Pyro_Cool02: 'Pyro Cool Belt 2',
  HPP_Pyro_DeepSpaceAsteroids: 'Deep Space Asteroids',
  HPP_Pyro_Warm01: 'Pyro Warm Belt 1',
  HPP_Pyro_Warm02: 'Pyro Warm Belt 2',
  HPP_Nyx_GlaciemRing: 'Glaciem Ring',
  HPP_Nyx_KeegerBelt: 'Keeger Belt',
}

export function humanizeLocationName(raw) {
  if (LOCATION_NAMES[raw]) return LOCATION_NAMES[raw]
  return raw.replace(/^HPP_/, '').replace(/_/g, ' ')
}

// Rock tier display labels and colors
export const ROCK_TIER_INFO = {
  Common:    { label: 'Common',    color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20' },
  Uncommon:  { label: 'Uncommon',  color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  Rare:      { label: 'Rare',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  Epic:      { label: 'Epic',      color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  Legendary: { label: 'Legendary', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
}
