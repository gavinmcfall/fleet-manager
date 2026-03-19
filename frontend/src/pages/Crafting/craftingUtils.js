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

// Modifier values are multipliers (1.0 = base, 1.2 = 120% of base, 0.8 = 80% of base)
// For display, show as percentage change from base: 1.2 → "+20%", 0.8 → "−20%"
export function formatModifierChange(value) {
  const change = (value - 1) * 100
  if (Math.abs(change) < 0.05) return '0%'
  const sign = change > 0 ? '+' : '−'
  return `${sign}${Math.abs(change).toFixed(0)}%`
}

// Whether a modifier's direction is "good" depends on the stat
// For recoil/spread/kick: lower multiplier = better (less recoil)
// For damage/fire rate/reload: higher multiplier = better
const LOWER_IS_BETTER = new Set([
  'weapon_recoil_smoothness',
  'weapon_recoil_handling',
  'weapon_recoil_kick',
  'weapon_spread',
])

export function isModifierBeneficial(key, multiplier) {
  if (LOWER_IS_BETTER.has(key)) return multiplier < 1
  return multiplier > 1
}

// Human-readable descriptions for stat keys
export const STAT_DESCRIPTIONS = {
  weapon_recoil_handling: 'How quickly the weapon recovers between shots',
  weapon_recoil_smoothness: 'How predictable the recoil pattern is',
  weapon_recoil_kick: 'How much the weapon jumps when fired',
  weapon_spread: 'Bullet spread / accuracy cone',
  weapon_damage: 'Base damage per shot',
  weapon_firerate: 'Rounds per minute',
  weapon_reloadspeed: 'How fast you reload',
  armour_resist_physical: 'Damage reduction vs ballistic rounds',
  armour_resist_energy: 'Damage reduction vs energy weapons',
  armour_resist_distortion: 'Damage reduction vs distortion damage',
  armour_resist_thermal: 'Damage reduction vs heat/fire',
  armour_resist_stun: 'Damage reduction vs stun effects',
}
