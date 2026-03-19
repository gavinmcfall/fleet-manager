// Shared helpers for crafting pages

export const TYPE_LABELS = {
  armour: 'Armour',
  weapons: 'Weapons',
  ammo: 'Ammo',
}

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
  },
  weapon_recoil_handling: {
    label: 'Recoil Recovery',
    description: 'How fast the weapon settles after firing',
    invertDisplay: true,
  },
  weapon_recoil_smoothness: {
    label: 'Recoil Stability',
    description: 'How predictable and tight the recoil pattern is',
    invertDisplay: true,
  },
  weapon_spread: {
    label: 'Accuracy',
    description: 'Bullet grouping tightness',
    invertDisplay: true,
  },
  weapon_damage: {
    label: 'Damage',
    description: 'Damage dealt per hit',
    invertDisplay: false,
  },
  weapon_firerate: {
    label: 'Fire Rate',
    description: 'Rounds fired per minute',
    invertDisplay: false,
  },
  weapon_reloadspeed: {
    label: 'Reload Speed',
    description: 'Time to reload a magazine',
    invertDisplay: false,
  },
  armor_damagemitigation: {
    label: 'Damage Mitigation',
    description: 'How much damage is absorbed by armour',
    invertDisplay: false,
  },
  armor_temperaturemax: {
    label: 'Heat Tolerance',
    description: 'Maximum temperature before taking heat damage',
    invertDisplay: false,
  },
  armor_temperaturemin: {
    label: 'Cold Tolerance',
    description: 'Minimum temperature before taking cold damage',
    invertDisplay: false,
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

// Format an improvement value for display
// +20 → "+20%", -10 → "−10%", 0 → "±0%"
export function formatImprovement(improvement) {
  if (Math.abs(improvement) < 0.05) return '±0%'
  const sign = improvement > 0 ? '+' : '−'
  return `${sign}${Math.abs(improvement).toFixed(0)}%`
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
