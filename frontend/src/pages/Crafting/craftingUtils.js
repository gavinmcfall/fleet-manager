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
