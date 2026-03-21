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
  'Weapons',
  'Turrets',
  'Missiles',
  'Shields',
  'Power Plants',
  'Coolers',
  'Quantum Drives',
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
    const norm = categoryLabel.trim()
    if (PORT_CATEGORY_ORDER.includes(norm)) return norm
  }
  return PORT_TYPE_LABELS[portType] || portType || 'Other'
}

// ─── Stat formatters ──────────────────────────────────────────────────────────

const fmtInt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })
const fmtDec1 = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
const fmtPct = (v) => `${(Number(v) * 100).toFixed(1)}%`
const fmtSpeed = (v) => `${(Number(v) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} Mm/s`
const fmtRange = (v) => `${(Number(v) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`
const fmtSec = (v) => `${(Number(v) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}s`
const fmtRPM = (v) => `${fmtInt(v)} RPM`
const fmtMS = (v) => `${fmtInt(v)} m/s`
const fmtM = (v) => `${fmtInt(v)} m`

// ─── Column definitions per port_type ─────────────────────────────────────────
// Each column: { key, label, format?, align?, width? }
// align defaults to 'right' for numeric, 'left' for text

export const PICKER_COLUMNS = {
  weapon: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'dps', label: 'DPS', format: fmtDec1, width: 'w-16' },
    { key: 'damage_per_shot', label: 'Alpha', format: fmtDec1, width: 'w-14' },
    { key: 'rounds_per_minute', label: 'RPM', format: fmtInt, width: 'w-14' },
    { key: 'effective_range', label: 'Range', format: fmtM, width: 'w-16' },
    { key: 'ammo_container_size', label: 'Ammo', format: fmtInt, width: 'w-12' },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-12' },
  ],
  turret: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'dps', label: 'DPS', format: fmtDec1, width: 'w-16' },
    { key: 'damage_per_shot', label: 'Alpha', format: fmtDec1, width: 'w-14' },
    { key: 'rotation_speed', label: 'Rot', format: (v) => `${v}°/s`, width: 'w-14' },
  ],
  shield: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'shield_hp', label: 'HP', format: fmtInt, width: 'w-16' },
    { key: 'shield_regen', label: 'Regen', format: fmtDec1, width: 'w-14' },
    { key: 'regen_delay', label: 'Delay', format: fmtSec, width: 'w-14' },
    { key: 'resist_physical', label: 'Phys', format: fmtPct, width: 'w-14' },
    { key: 'resist_energy', label: 'Enrg', format: fmtPct, width: 'w-14' },
    { key: 'resist_distortion', label: 'Dist', format: fmtPct, width: 'w-14' },
  ],
  cooler: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'cooling_rate', label: 'Cooling', format: (v) => `${fmtInt(v)}/s`, width: 'w-18' },
    { key: 'max_temperature', label: 'Max T', format: fmtInt, width: 'w-14' },
  ],
  power: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'power_output', label: 'Output', format: fmtInt, width: 'w-16' },
    { key: 'overpower_performance', label: 'OvrPwr', format: fmtDec1, width: 'w-14' },
    { key: 'overclock_performance', label: 'OvrClk', format: fmtDec1, width: 'w-14' },
  ],
  quantum_drive: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'quantum_speed', label: 'Speed', format: fmtSpeed, width: 'w-18' },
    { key: 'quantum_range', label: 'Range', format: fmtRange, width: 'w-16' },
    { key: 'fuel_rate', label: 'Fuel', format: fmtDec1, width: 'w-12' },
    { key: 'spool_time', label: 'Spool', format: fmtSec, width: 'w-14' },
  ],
  sensor: [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
    { key: 'radar_range', label: 'Range', format: fmtRange, width: 'w-16' },
    { key: 'radar_angle', label: 'Angle', format: (v) => `${v}°`, width: 'w-12' },
  ],
}

// Default columns for types not explicitly defined
PICKER_COLUMNS.missile = [
  { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
  { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
  { key: 'size', label: 'S', width: 'w-8' },
  { key: 'damage', label: 'Damage', format: fmtDec1, width: 'w-16' },
  { key: 'tracking_signal', label: 'Track', align: 'left', width: 'w-16' },
  { key: 'lock_time', label: 'Lock', format: fmtSec, width: 'w-14' },
  { key: 'speed', label: 'Speed', format: fmtMS, width: 'w-14' },
]

PICKER_COLUMNS.mining_laser = PICKER_COLUMNS.weapon
PICKER_COLUMNS.salvage_head = PICKER_COLUMNS.weapon
PICKER_COLUMNS.qed = PICKER_COLUMNS.sensor
PICKER_COLUMNS.countermeasure = PICKER_COLUMNS.sensor

/** Get column definitions for a port_type */
export function getColumnsForPortType(portType) {
  return PICKER_COLUMNS[portType] || [
    { key: 'name', label: 'Name', align: 'left', width: 'flex-[2]' },
    { key: 'manufacturer_name', label: 'Mfr', align: 'left', width: 'w-24' },
    { key: 'size', label: 'S', width: 'w-8' },
    { key: 'grade', label: 'Gr', width: 'w-8' },
  ]
}

/** Get the default sort key for a port_type */
export function getDefaultSortKey(portType) {
  const map = {
    weapon: 'dps', turret: 'dps', shield: 'shield_hp', cooler: 'cooling_rate',
    power: 'power_output', quantum_drive: 'quantum_speed', sensor: 'radar_range',
    missile: 'damage', mining_laser: 'dps', qed: 'radar_range',
  }
  return map[portType] || 'name'
}

/** Format the primary stat for a component based on port_type */
export function getPrimaryStat(item, override) {
  const data = override || item
  const pt = item.port_type

  if (pt === 'power' && data.power_output) return `${fmtInt(data.power_output)} pwr`
  if (pt === 'cooler' && data.cooling_rate) return `${fmtInt(data.cooling_rate)}/s`
  if (pt === 'shield' && data.shield_hp) return `${fmtInt(data.shield_hp)} HP`
  if (pt === 'quantum_drive' && data.quantum_speed) return fmtSpeed(data.quantum_speed)
  if ((pt === 'weapon' || pt === 'turret') && data.dps) return `${fmtDec1(data.dps)} DPS`
  if (pt === 'sensor' && data.radar_range) return fmtRange(data.radar_range)
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
  QuantumInterdictionGenerator: 'qed_range',
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
  QuantumInterdictionGenerator: 'qed',
  MissileLauncher: 'missile',
  MiningModifier: 'mining_laser',
  SalvageHead: 'salvage_head',
}
