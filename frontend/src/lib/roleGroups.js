/**
 * Ship role-group mapping — mirror of `ROLE_GROUP_MAP` + `getRoleGroup` in
 * `src/routes/analysis.ts`. Keeps the dashboard chart's role buckets aligned
 * with the fleet table's Role column, so the two displays stop disagreeing
 * (finding F504). Keep this in sync with the TS source — we intentionally
 * duplicate rather than cross-import because the backend module has D1 types
 * pulled in elsewhere in the same file.
 */

const ROLE_GROUP_MAP = {
  // Combat
  'Light Fighter': 'Combat',
  'Medium Fighter': 'Combat',
  'Heavy Fighter': 'Combat',
  'Snub Fighter': 'Combat',
  'Bomber': 'Combat',
  'Heavy Bomber': 'Combat',
  'Stealth Bomber': 'Combat',
  'Stealth Fighter': 'Combat',
  'Stealth': 'Combat',
  'Gunship': 'Combat',
  'Heavy Gunship': 'Combat',
  'Heavy Gun Ship': 'Combat',
  'Assault': 'Combat',
  'Patrol': 'Combat',
  'Military': 'Combat',
  'Anti-Air': 'Combat',
  'Anti-aircraft': 'Combat',
  // Cargo & Transport
  'Cargo': 'Cargo',
  'Freight': 'Cargo',
  'Light Freight': 'Cargo',
  'Medium Freight': 'Cargo',
  'Medium Freighter': 'Cargo',
  'Heavy Freight': 'Cargo',
  'Cargo Loader': 'Cargo',
  'Transport': 'Transport',
  'Military Transport': 'Transport',
  'Luxury Transport': 'Transport',
  'Passenger': 'Transport',
  'Dropship': 'Transport',
  // Exploration & Science
  'Exploration': 'Exploration',
  'Expedition': 'Exploration',
  'Pathfinder': 'Exploration',
  'Recon': 'Exploration',
  'Reconnaissance': 'Exploration',
  'Light Science': 'Exploration',
  'Medium Data': 'Exploration',
  // Industrial
  'Mining': 'Mining',
  'Salvage': 'Salvage',
  'Light Salvage': 'Salvage',
  'Medium Salvage': 'Salvage',
  'Heavy Salvage': 'Salvage',
  'Recovery': 'Salvage',
  'Industrial': 'Industrial',
  'Repair': 'Support',
  'Heavy Refuelling': 'Refueling',
  // Medical
  'Medical': 'Medical',
  'Ambulance': 'Medical',
  // Support
  'Combat Support': 'Support',
  'Interdiction': 'Support',
  'Interdictor': 'Support',
  'Reporting': 'Support',
  // Capital
  'Corvette': 'Capital',
  'Destroyer': 'Capital',
  'Frigate': 'Capital',
  // Lifestyle
  'Racing': 'Racing',
  'Touring': 'Touring',
  'Luxury': 'Touring',
  'Luxury Touring': 'Touring',
  // Multi-Role
  'Generalist': 'Multi-Role',
  'Starter': 'Multi-Role',
}

export function getRoleGroup(focus, classification) {
  if (classification) {
    const cg = ROLE_GROUP_MAP[classification]
    if (cg) return cg
    if (/mining/i.test(classification)) return 'Mining'
    if (/salvage/i.test(classification)) return 'Salvage'
    if (/freight/i.test(classification)) return 'Cargo'
    if (/science/i.test(classification)) return 'Exploration'
    if (/medical|ambulance/i.test(classification)) return 'Medical'
    if (/refuel/i.test(classification)) return 'Refueling'
  }
  return ROLE_GROUP_MAP[focus] ?? focus
}
