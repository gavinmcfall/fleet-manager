// Shared helpers for mining pages

// Re-export quality math from craftingUtils (single source of truth)
export {
  QUALITY_BANDS,
  qualityBandProbabilities,
  humanizeLocationName,
  ROCK_TIER_INFO,
  resourceColor,
  resourceBgColor,
  resourceBorderColor,
} from '../Crafting/craftingUtils'

// --- System colors ---
export const SYSTEM_COLORS = {
  Stanton: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', hex: '#60a5fa' },
  Pyro:    { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', hex: '#f87171' },
  Nyx:     { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', hex: '#c084fc' },
}

export const LOCATION_TYPE_COLORS = {
  belt:   { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  moon:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  planet: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  event:  { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  lagrange: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  cluster: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
}

export const CATEGORY_STYLES = {
  ore: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  raw: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

export const EQUIPMENT_TYPE_COLORS = {
  laser:  { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  module: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  gadget: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
}

// --- Modifier keys ---
export const MOD_KEYS = [
  'mod_instability',
  'mod_optimal_window_size',
  'mod_resistance',
  'mod_shatter_damage',
  'mod_cluster_factor',
  'mod_optimal_charge_rate',
  'mod_catastrophic_charge_rate',
  'mod_filter',
]

export const MOD_LABELS = {
  mod_instability: 'Instability',
  mod_optimal_window_size: 'Optimal Window',
  mod_resistance: 'Resistance',
  mod_shatter_damage: 'Shatter Damage',
  mod_cluster_factor: 'Cluster Factor',
  mod_optimal_charge_rate: 'Charge Rate',
  mod_catastrophic_charge_rate: 'Catastrophic Rate',
  mod_filter: 'Inert Filter',
}

// Whether a positive value for this modifier is good (true) or bad (false)
export const MOD_POSITIVE_IS_GOOD = {
  mod_instability: false,
  mod_optimal_window_size: true,
  mod_resistance: true,
  mod_shatter_damage: true,
  mod_cluster_factor: false,
  mod_optimal_charge_rate: true,
  mod_catastrophic_charge_rate: false,
  mod_filter: true,
}

// --- Element name cleaning ---
export function cleanElementName(name) {
  if (!name) return '--'
  return name.replace(/^Minableelement\s+(?:Fps|Ship|Groundvehicle)\s+/i, '')
}

// Convert deposit composition_guid tags like "mining_common_iron" to readable names
export function cleanDepositName(guid) {
  if (!guid) return '--'
  return guid
    .replace(/^(mining|fpsmining|groundvehiclemining|salvage|plant)_/, '')
    .replace(/^(common|uncommon|rare|epic|legendary)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Extract tier from deposit composition_guid like "mining_common_iron" → "Common"
export function extractDepositTier(guid) {
  if (!guid) return null
  const match = guid.match(/^(?:mining|fpsmining|groundvehiclemining)_(common|uncommon|rare|epic|legendary)_/)
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1)
  return null
}

export function friendlyElementName(className) {
  if (!className) return '--'
  return className
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// --- Instability color helpers ---
export function instabilityColor(val) {
  if (val == null) return 'text-gray-400'
  if (val >= 0.7) return 'text-red-400'
  if (val >= 0.4) return 'text-amber-400'
  return 'text-green-400'
}

export function instabilityBarColor(val) {
  if (val == null) return 'bg-gray-500'
  if (val >= 0.7) return 'bg-red-500'
  if (val >= 0.4) return 'bg-amber-500'
  return 'bg-green-500'
}

export function instabilityBg(val) {
  if (val == null) return 'bg-gray-700'
  if (val >= 0.7) return 'bg-red-500/30'
  if (val >= 0.4) return 'bg-amber-500/30'
  return 'bg-green-500/30'
}

// --- Mining math ---

/**
 * Stack modifiers from laser + modules + gadget (additive stacking)
 */
export function computeEffectiveModifiers(laser, modules, gadget) {
  const result = {}
  for (const key of MOD_KEYS) {
    result[key] = (laser?.[key] || 0)
      + (modules || []).reduce((sum, m) => sum + (m?.[key] || 0), 0)
      + (gadget?.[key] || 0)
  }
  return result
}

/**
 * Check if a loadout can fracture a rock
 */
export function canBreakRock(beamDps, rockResistance, modResistance) {
  const effectiveResistance = rockResistance * (1 - modResistance)
  return beamDps > effectiveResistance
}

/**
 * Compute optimal charge window bounds
 */
export function computeChargeWindow(rock, mods) {
  const thinness = rock.optimal_window_thinness || 0.5
  const midpoint = rock.optimal_window_midpoint || 0.5
  const windowSize = (1 / Math.max(thinness, 0.01)) * (1 + (mods.mod_optimal_window_size || 0))
  const windowStart = Math.max(0, midpoint - windowSize / 2)
  const windowEnd = Math.min(1, midpoint + windowSize / 2)
  const effectiveInstability = (rock.instability || 0) * (1 + (mods.mod_instability || 0))
  return { windowStart, windowEnd, windowSize, effectiveInstability, midpoint }
}

// --- Ship presets for Rock Calculator ---
export const SHIP_PRESETS = [
  {
    name: 'Prospector',
    slots: [{ size: 1, label: 'S1 Laser' }],
    moduleSlots: 3,
    icon: 'ship',
  },
  {
    name: 'MOLE (Turret 1)',
    slots: [{ size: 2, label: 'S2 Laser' }],
    moduleSlots: 3,
    icon: 'ship',
  },
  {
    name: 'MOLE (All 3 Turrets)',
    slots: [
      { size: 2, label: 'Turret 1 (S2)' },
      { size: 2, label: 'Turret 2 (S2)' },
      { size: 2, label: 'Turret 3 (S2)' },
    ],
    moduleSlots: 3,
    icon: 'ship',
  },
  {
    name: 'ROC',
    slots: [{ size: 0, label: 'S0 Laser' }],
    moduleSlots: 0,
    icon: 'vehicle',
  },
  {
    name: 'FPS Multi-Tool',
    slots: [{ size: 0, label: 'S0 Laser' }],
    moduleSlots: 0,
    icon: 'fps',
  },
]

// --- Stat display labels for elements ---
export const ELEMENT_STAT_LABELS = {
  instability: 'Instability',
  resistance: 'Resistance',
  optimal_window_midpoint: 'Optimal Window',
  optimal_window_randomness: 'Window Randomness',
  optimal_window_thinness: 'Window Thinness',
  explosion_multiplier: 'Explosion Multiplier',
  cluster_factor: 'Cluster Factor',
}

// Format a modifier value as a percentage with sign
export function formatModPct(value) {
  if (value == null || Math.abs(value) < 0.0001) return '—'
  const pct = (value * 100).toFixed(0)
  return value > 0 ? `+${pct}%` : `${pct}%`
}

// Get the strongest non-zero modifier on a piece of equipment
export function getStrongestMod(item) {
  let best = null
  let bestAbs = 0
  for (const key of MOD_KEYS) {
    const val = item[key]
    if (val != null && Math.abs(val) > bestAbs) {
      best = { key, value: val }
      bestAbs = Math.abs(val)
    }
  }
  return best
}
