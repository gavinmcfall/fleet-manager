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

// Scoring: equipment modifiers that counteract element difficulty score higher.
// Modifiers range roughly -70 to +100 (integers, not fractions).
// Element instability ranges 0-1000, resistance -1 to 1, explosion -36 to 26000.
// We normalize each contribution to a small increment on a 0-100 scale.
const SCORING_RULES = [
  // key, desiredDirection (-1 = lower is better), weight, normFactor for element value
  { key: 'mod_instability', elementKey: 'instability', desired: -1, weight: 3, normEl: 1000 },
  { key: 'mod_resistance', elementKey: 'resistance', desired: -1, weight: 2, normEl: 1 },
  { key: 'mod_optimal_window_size', elementKey: 'optimal_window_thinness', desired: 1, weight: 2, normEl: 5 },
  { key: 'mod_shatter_damage', elementKey: 'explosion_multiplier', desired: -1, weight: 1, normEl: 200 },
  { key: 'mod_cluster_factor', elementKey: 'cluster_factor', desired: 1, weight: 1, normEl: 1 },
  { key: 'mod_optimal_charge_rate', elementKey: null, desired: 1, weight: 1, normEl: 1 },
  { key: 'mod_catastrophic_charge_rate', elementKey: null, desired: -1, weight: 1.5, normEl: 1 },
]

export function scoreEquipment(equipment, element) {
  if (!element) return 50
  let score = 50
  const normMod = 100 // equipment mod values range roughly -100 to +100

  for (const rule of SCORING_RULES) {
    const mod = equipment[rule.key] ?? 0
    if (mod === 0) continue

    // How much the element needs help on this axis (0-1)
    const rawEl = rule.elementKey ? Math.abs(element[rule.elementKey] ?? 0) : 0.5
    const elNeed = Math.min(rawEl / rule.normEl, 1)

    // How effective is this equipment modifier? (positive = helps)
    const modNorm = mod / normMod // -1 to +1
    const effectiveness = modNorm * rule.desired // positive when mod counteracts difficulty

    // Each rule contributes up to ±(weight * 4) points to the score
    score += effectiveness * elNeed * rule.weight * 4
  }

  return Math.max(0, Math.min(100, Math.round(score)))
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
