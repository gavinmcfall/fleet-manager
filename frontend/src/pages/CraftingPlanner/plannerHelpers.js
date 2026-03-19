/**
 * Pure functions for the crafting/mining planner.
 * Scoring, interpolation, distribution curves, composition parsing.
 */

// --- Quality Interpolation ---

export function interpolateModifier(mod, quality) {
  if (mod.end_quality === mod.start_quality) return mod.modifier_at_start
  const t = (quality - mod.start_quality) / (mod.end_quality - mod.start_quality)
  return mod.modifier_at_start + t * (mod.modifier_at_end - mod.modifier_at_start)
}

// --- Normal Distribution ---

export function normalPDF(x, mean, stddev) {
  const exp = -0.5 * ((x - mean) / stddev) ** 2
  return (1 / (stddev * Math.sqrt(2 * Math.PI))) * Math.exp(exp)
}

export function generateDistributionCurve(mean, stddev, min, max, points = 100) {
  const step = (max - min) / (points - 1)
  const data = []
  for (let i = 0; i < points; i++) {
    const quality = min + i * step
    data.push({ quality: Math.round(quality), probability: normalPDF(quality, mean, stddev) })
  }
  return data
}

// --- Equipment Scoring ---

const MODIFIER_KEYS = [
  'mod_instability',
  'mod_resistance',
  'mod_optimal_window_size',
  'mod_shatter_damage',
  'mod_cluster_factor',
  'mod_optimal_charge_rate',
  'mod_catastrophic_charge_rate',
]

// Higher element instability/resistance = harder to mine
// Equipment that reduces instability (negative mod_instability) helps
// Equipment that increases optimal_window_size (positive) helps
const COUNTER_WEIGHTS = {
  mod_instability: { elementKey: 'instability', direction: -1, weight: 3 },
  mod_resistance: { elementKey: 'resistance', direction: -1, weight: 2 },
  mod_optimal_window_size: { elementKey: 'optimal_window_thinness', direction: 1, weight: 2 },
  mod_shatter_damage: { elementKey: 'explosion_multiplier', direction: -1, weight: 1 },
  mod_cluster_factor: { elementKey: 'cluster_factor', direction: 1, weight: 1 },
  mod_optimal_charge_rate: { elementKey: null, direction: 1, weight: 1 },
  mod_catastrophic_charge_rate: { elementKey: null, direction: -1, weight: 1.5 },
}

export function scoreEquipment(equipment, element) {
  if (!element) return 50
  let score = 50
  let totalWeight = 0

  for (const key of MODIFIER_KEYS) {
    const mod = equipment[key] ?? 0
    if (mod === 0) continue

    const cw = COUNTER_WEIGHTS[key]
    if (!cw) continue
    totalWeight += cw.weight

    // Check if the modifier counteracts element difficulty
    const elementDifficulty = cw.elementKey ? (element[cw.elementKey] ?? 0) : 0.5
    const effectiveness = mod * cw.direction

    // Positive effectiveness = equipment helps
    score += effectiveness * elementDifficulty * cw.weight * 50
  }

  return Math.max(0, Math.min(100, score))
}

export function getTopEquipment(equipment, element) {
  const { lasers = [], modules = [], gadgets = [] } = equipment

  const scoredLasers = lasers
    .map(l => ({ ...l, score: scoreEquipment(l, element), equipType: 'laser' }))
    .sort((a, b) => b.score - a.score)

  const scoredModules = modules
    .map(m => ({ ...m, score: scoreEquipment(m, element), equipType: 'module' }))
    .sort((a, b) => b.score - a.score)

  const scoredGadgets = gadgets
    .map(g => ({ ...g, score: scoreEquipment(g, element), equipType: 'gadget' }))
    .sort((a, b) => b.score - a.score)

  return { lasers: scoredLasers, modules: scoredModules, gadgets: scoredGadgets }
}

// --- Composition Parsing ---

export function parseComposition(compositionJson) {
  if (!compositionJson) return []
  try {
    return JSON.parse(compositionJson)
  } catch {
    return []
  }
}

// --- Location Scoring ---

export function scoreLocationForResource(location, resourceName, resourceElementMap, compositions) {
  if (!location.deposits || location.deposits.length === 0) return 0

  const elementClassName = resourceElementMap[resourceName]
  if (!elementClassName) return 0

  let totalScore = 0

  for (const deposit of location.deposits) {
    const comp = compositions.find(c => c.id === deposit.rock_composition_id)
    if (!comp) continue

    const elements = parseComposition(comp.composition_json)
    const match = elements.find(el =>
      el.element && el.element.toLowerCase() === elementClassName.toLowerCase()
    )

    if (match) {
      const avgPct = ((match.minPct ?? 0) + (match.maxPct ?? 0)) / 2
      const probability = (deposit.group_probability ?? 1) * (deposit.relative_probability ?? 1)
      totalScore += avgPct * probability
    }
  }

  return totalScore
}

// --- Formatting ---

export function formatTime(seconds) {
  if (!seconds) return '\u2014'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function cleanElementName(name) {
  if (!name) return '--'
  return name.replace(/^Minableelement\s+(?:Fps|Ship|Groundvehicle)\s+/i, '')
}

export function friendlyElementName(className) {
  if (!className) return '--'
  return className
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export const TYPE_LABELS = {
  armour: 'Armour',
  weapons: 'Weapons',
  ammo: 'Ammo',
}

export const SUBTYPE_LABELS = {
  combat: 'Combat', engineer: 'Engineer', hunter: 'Hunter', stealth: 'Stealth',
  miner: 'Miner', explorer: 'Explorer', cosmonaut: 'Cosmonaut', environment: 'Environment',
  salvager: 'Salvager', medic: 'Medic', radiation: 'Radiation', flightsuit: 'Flightsuit',
  racer: 'Racer', undersuit: 'Undersuit', pistol: 'Pistol', rifle: 'Rifle',
  smg: 'SMG', sniper: 'Sniper', shotgun: 'Shotgun', lmg: 'LMG',
  ballistic: 'Ballistic', laser: 'Laser', electron: 'Electron', plasma: 'Plasma',
}
