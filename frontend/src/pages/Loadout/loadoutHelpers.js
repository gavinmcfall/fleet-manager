import {
  PowerPlantIcon, CoolerIcon, ShieldGeneratorIcon, QuantumDriveIcon,
  RadarIcon, JumpDriveIcon, WeaponIcon, TurretIcon, MissileRackIcon,
  ElectromagneticIcon, MiningLaserIcon, CrossSectionIcon, UtilityIcon, QEDIcon,
} from '../../assets/icons/index.js'

export const PORT_TYPE_ICONS = {
  power:          PowerPlantIcon,
  cooler:         CoolerIcon,
  shield:         ShieldGeneratorIcon,
  quantum_drive:  QuantumDriveIcon,
  sensor:         RadarIcon,
  jump_drive:     JumpDriveIcon,
  weapon:         WeaponIcon,
  turret:         TurretIcon,
  missile:        MissileRackIcon,
  countermeasure: ElectromagneticIcon,
  mining_laser:   MiningLaserIcon,
  salvage_head:   CrossSectionIcon,
  salvage_module: UtilityIcon,
  qed:            QEDIcon,
}

export const PORT_TYPE_LABELS = {
  power:          'Power Plants',
  cooler:         'Coolers',
  shield:         'Shields',
  quantum_drive:  'Quantum Drives',
  sensor:         'Sensors',
  weapon:         'Weapons',
  turret:         'Turrets',
  missile:        'Missiles',
  countermeasure: 'Countermeasures',
  mining_laser:   'Mining Lasers',
  salvage_head:   'Salvage',
  salvage_module: 'Salvage Modules',
  qed:            'QED',
  jump_drive:     'Jump Drive',
}

export const PORT_CATEGORY_ORDER = [
  'Power Plants',
  'Coolers',
  'Shields',
  'Quantum Drives',
  'Weapons',
  'Turrets',
  'Missiles',
  'Countermeasures',
  'Sensors',
  'Mining Lasers',
  'Salvage',
  'Salvage Modules',
  'QED',
  'Jump Drive',
]

/** Map port_type to a display category. Uses category_label from the DB if available. */
export function getPortCategory(portType, categoryLabel) {
  if (categoryLabel) {
    // Normalize known DB labels to our ordering
    const norm = categoryLabel.trim()
    if (PORT_CATEGORY_ORDER.includes(norm)) return norm
  }
  return PORT_TYPE_LABELS[portType] || portType || 'Other'
}

/** Format the primary stat for a component based on port_type */
export function getPrimaryStat(item, override) {
  const data = override || item
  const pt = item.port_type

  if (pt === 'power' && data.power_output)
    return `${Number(data.power_output).toLocaleString(undefined, { maximumFractionDigits: 0 })} pwr`
  if (pt === 'cooler' && data.cooling_rate)
    return `${Number(data.cooling_rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}/s`
  if (pt === 'shield' && data.shield_hp)
    return `${Number(data.shield_hp).toLocaleString(undefined, { maximumFractionDigits: 0 })} HP`
  if (pt === 'quantum_drive' && data.quantum_speed)
    return `${(Number(data.quantum_speed) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} Mm/s`
  if ((pt === 'weapon' || pt === 'turret') && data.dps)
    return `${Number(data.dps).toLocaleString(undefined, { maximumFractionDigits: 1 })} DPS`
  if (pt === 'sensor' && data.radar_range)
    return `${(Number(data.radar_range) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
  return null
}

/** Stat key used for sorting compatible components */
export const SORT_STAT_KEY = {
  PowerPlant: 'power_output',
  Cooler: 'cooling_rate',
  Shield: 'shield_hp',
  QuantumDrive: 'quantum_speed',
  WeaponGun: 'dps',
  Radar: 'radar_range',
  TurretBase: 'dps',
  Turret: 'dps',
  QEDGenerator: 'qed_range',
  MissileLauncher: 'damage',
}

/** Map backend component type to port_type for stat display */
export const COMPONENT_TYPE_TO_PORT_TYPE = {
  PowerPlant: 'power',
  Cooler: 'cooler',
  Shield: 'shield',
  QuantumDrive: 'quantum_drive',
  WeaponGun: 'weapon',
  Radar: 'sensor',
  TurretBase: 'turret',
  Turret: 'turret',
  QEDGenerator: 'qed',
  MissileLauncher: 'missile',
  MiningModifier: 'mining_laser',
  SalvageHead: 'salvage_head',
}
