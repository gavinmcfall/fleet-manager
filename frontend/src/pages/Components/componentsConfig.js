import {
  fmtInt, fmtDec1, fmtPct, fmtSpeed, fmtRange, fmtSec, fmtRPM, fmtMS, fmtM,
  PORT_TYPE_ICONS, PORT_TYPE_LABELS,
} from '../Loadout/loadoutHelpers'

// URL slug → API type + display metadata
export const COMPONENT_TYPES = {
  weapons:          { apiType: 'weapon',        label: 'Weapons',        portType: 'weapon' },
  shields:          { apiType: 'shield',        label: 'Shields',        portType: 'shield' },
  coolers:          { apiType: 'cooler',        label: 'Coolers',        portType: 'cooler' },
  'power-plants':   { apiType: 'power',         label: 'Power Plants',   portType: 'power' },
  'quantum-drives': { apiType: 'quantum_drive', label: 'Quantum Drives', portType: 'quantum_drive' },
  turrets:          { apiType: 'turret',        label: 'Turrets',        portType: 'turret' },
  missiles:         { apiType: 'missile',       label: 'Missiles',       portType: 'missile' },
  sensors:          { apiType: 'sensor',        label: 'Sensors',        portType: 'sensor' },
}

export function getTypeConfig(slug) {
  const cfg = COMPONENT_TYPES[slug]
  if (!cfg) return null
  return {
    ...cfg,
    icon: PORT_TYPE_ICONS[cfg.portType],
    fullLabel: PORT_TYPE_LABELS[cfg.portType] || cfg.label,
  }
}

// Full column definitions per type — extends PICKER_COLUMNS with all stat columns
// Each column: key, label, format?, align?, width?, higherIsBetter? (for compare)
const NAME_COL    = { key: 'name', label: 'Name', align: 'left', width: 'min-w-56' }
const MFR_COL     = { key: 'manufacturer_name', label: 'Manufacturer', align: 'left', width: 'min-w-48' }
const SIZE_COL    = { key: 'size', label: 'Size', width: 'w-14' }
const GRADE_COL   = { key: 'grade', label: 'Grade', width: 'w-14' }
const CLASS_COL   = { key: 'class', label: 'Class', width: 'w-16' }

export const COLUMNS = {
  weapon: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL,
    { key: 'dps', label: 'DPS', format: fmtDec1, width: 'w-16', higherIsBetter: true },
    { key: 'damage_per_shot', label: 'Alpha', format: fmtDec1, width: 'w-14', higherIsBetter: true },
    { key: 'rounds_per_minute', label: 'RPM', format: fmtInt, width: 'w-14', higherIsBetter: true },
    { key: 'effective_range', label: 'Range', format: fmtM, width: 'w-18', higherIsBetter: true },
    { key: 'ammo_container_size', label: 'Ammo', format: fmtInt, width: 'w-12', higherIsBetter: true },
    { key: 'projectile_speed', label: 'Proj Speed', format: fmtMS, width: 'w-20', higherIsBetter: true },
    { key: 'damage_type', label: 'Dmg Type', width: 'w-16' },
    { key: 'fire_modes', label: 'Fire Modes', width: 'w-20' },
    { key: 'heat_per_shot', label: 'Heat/Shot', format: fmtDec1, width: 'w-16', higherIsBetter: false },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-14', higherIsBetter: false },
    { key: 'damage_physical', label: 'Phys Dmg', format: fmtDec1, width: 'w-16', higherIsBetter: true },
    { key: 'damage_energy', label: 'Enrg Dmg', format: fmtDec1, width: 'w-16', higherIsBetter: true },
    { key: 'damage_distortion', label: 'Dist Dmg', format: fmtDec1, width: 'w-16', higherIsBetter: true },
    { key: 'damage_thermal', label: 'Thrm Dmg', format: fmtDec1, width: 'w-16', higherIsBetter: true },
  ],
  turret: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL,
    { key: 'dps', label: 'DPS', format: fmtDec1, width: 'w-16', higherIsBetter: true },
    { key: 'damage_per_shot', label: 'Alpha', format: fmtDec1, width: 'w-14', higherIsBetter: true },
    { key: 'rounds_per_minute', label: 'RPM', format: fmtInt, width: 'w-14', higherIsBetter: true },
    { key: 'effective_range', label: 'Range', format: fmtM, width: 'w-18', higherIsBetter: true },
    { key: 'damage_type', label: 'Dmg Type', width: 'w-16' },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-14', higherIsBetter: false },
  ],
  shield: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL, CLASS_COL,
    { key: 'shield_hp', label: 'HP', format: fmtInt, width: 'w-16', higherIsBetter: true },
    { key: 'shield_regen', label: 'Regen', format: fmtDec1, width: 'w-14', higherIsBetter: true },
    { key: 'regen_delay', label: 'Regen Delay', format: fmtSec, width: 'w-18', higherIsBetter: false },
    { key: 'downed_regen_delay', label: 'Down Delay', format: fmtSec, width: 'w-18', higherIsBetter: false },
    { key: 'resist_physical', label: 'Phys Res', format: fmtPct, width: 'w-16', higherIsBetter: true },
    { key: 'resist_energy', label: 'Enrg Res', format: fmtPct, width: 'w-16', higherIsBetter: true },
    { key: 'resist_distortion', label: 'Dist Res', format: fmtPct, width: 'w-16', higherIsBetter: true },
    { key: 'resist_thermal', label: 'Thrm Res', format: fmtPct, width: 'w-16', higherIsBetter: true },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-14', higherIsBetter: false },
    { key: 'thermal_output', label: 'Heat', format: fmtInt, width: 'w-14', higherIsBetter: false },
  ],
  cooler: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL, CLASS_COL,
    { key: 'cooling_rate', label: 'Cooling', format: (v) => `${fmtInt(v)}/s`, width: 'w-18', higherIsBetter: true },
    { key: 'max_temperature', label: 'Max Temp', format: fmtInt, width: 'w-16', higherIsBetter: true },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-14', higherIsBetter: false },
  ],
  power: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL, CLASS_COL,
    { key: 'power_output', label: 'Output', format: fmtInt, width: 'w-16', higherIsBetter: true },
    { key: 'overpower_performance', label: 'Overpower', format: fmtDec1, width: 'w-18', higherIsBetter: true },
    { key: 'overclock_performance', label: 'Overclock', format: fmtDec1, width: 'w-18', higherIsBetter: true },
    { key: 'thermal_output', label: 'Heat', format: fmtInt, width: 'w-14', higherIsBetter: false },
  ],
  quantum_drive: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL, CLASS_COL,
    { key: 'quantum_speed', label: 'Speed', format: fmtSpeed, width: 'w-20', higherIsBetter: true },
    { key: 'quantum_range', label: 'Range', format: fmtRange, width: 'w-18', higherIsBetter: true },
    { key: 'fuel_rate', label: 'Fuel Rate', format: fmtDec1, width: 'w-16', higherIsBetter: false },
    { key: 'spool_time', label: 'Spool', format: fmtSec, width: 'w-14', higherIsBetter: false },
    { key: 'cooldown_time', label: 'Cooldown', format: fmtSec, width: 'w-16', higherIsBetter: false },
    { key: 'stage1_accel', label: 'Stage 1', format: fmtDec1, width: 'w-14', higherIsBetter: true },
    { key: 'stage2_accel', label: 'Stage 2', format: fmtDec1, width: 'w-14', higherIsBetter: true },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-14', higherIsBetter: false },
    { key: 'thermal_output', label: 'Heat', format: fmtInt, width: 'w-14', higherIsBetter: false },
  ],
  missile: [
    NAME_COL, MFR_COL, SIZE_COL,
    { key: 'damage', label: 'Damage', format: fmtDec1, width: 'w-16', higherIsBetter: true },
    { key: 'blast_radius', label: 'Blast Radius', format: fmtM, width: 'w-18', higherIsBetter: true },
    { key: 'tracking_signal', label: 'Tracking', width: 'w-16' },
    { key: 'lock_time', label: 'Lock Time', format: fmtSec, width: 'w-16', higherIsBetter: false },
    { key: 'lock_range', label: 'Lock Range', format: fmtM, width: 'w-18', higherIsBetter: true },
    { key: 'speed', label: 'Speed', format: fmtMS, width: 'w-16', higherIsBetter: true },
    { key: 'missile_type', label: 'Type', width: 'w-16' },
  ],
  sensor: [
    NAME_COL, MFR_COL, SIZE_COL, GRADE_COL, CLASS_COL,
    { key: 'radar_range', label: 'Range', format: fmtRange, width: 'w-18', higherIsBetter: true },
    { key: 'radar_angle', label: 'Angle', format: (v) => `${v}°`, width: 'w-14', higherIsBetter: true },
    { key: 'power_draw', label: 'Power', format: fmtDec1, width: 'w-14', higherIsBetter: false },
    { key: 'thermal_output', label: 'Heat', format: fmtInt, width: 'w-14', higherIsBetter: false },
  ],
}

// Default sort keys per API type
export const DEFAULT_SORT = {
  weapon: 'dps', turret: 'dps', shield: 'shield_hp', cooler: 'cooling_rate',
  power: 'power_output', quantum_drive: 'quantum_speed', sensor: 'radar_range',
  missile: 'damage',
}

// Filter dimensions per API type — derived from data at runtime
export const FILTER_DIMENSIONS = {
  weapon: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
    { key: 'sub_type', field: 'sub_type', label: 'Type' },
    { key: 'dmg_type', field: 'damage_type', label: 'Dmg Type' },
  ],
  turret: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
  ],
  shield: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
    { key: 'class', field: 'class', label: 'Class' },
  ],
  cooler: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
    { key: 'class', field: 'class', label: 'Class' },
  ],
  power: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
    { key: 'class', field: 'class', label: 'Class' },
  ],
  quantum_drive: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
    { key: 'class', field: 'class', label: 'Class' },
  ],
  missile: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'tracking', field: 'tracking_signal', label: 'Tracking' },
    { key: 'mtype', field: 'missile_type', label: 'Type' },
  ],
  sensor: [
    { key: 'mfr', field: 'manufacturer_name', label: 'Mfr' },
    { key: 'size', field: 'size', label: 'Size', numeric: true },
    { key: 'grade', field: 'grade', label: 'Grade' },
    { key: 'class', field: 'class', label: 'Class' },
  ],
}

// Compare stat definitions per type — which stats to show and winner preference
export const COMPARE_STATS = {
  weapon: [
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'dps', label: 'DPS', higher: true },
    { key: 'damage_per_shot', label: 'Alpha', higher: true },
    { key: 'rounds_per_minute', label: 'RPM', higher: true },
    { key: 'effective_range', label: 'Range', suffix: ' m', higher: true },
    { key: 'ammo_container_size', label: 'Ammo', higher: true },
    { key: 'projectile_speed', label: 'Proj Speed', suffix: ' m/s', higher: true },
    { key: 'heat_per_shot', label: 'Heat/Shot', lower: true },
    { key: 'power_draw', label: 'Power Draw', lower: true },
  ],
  turret: [
    { key: 'size', label: 'Size' },
    { key: 'dps', label: 'DPS', higher: true },
    { key: 'damage_per_shot', label: 'Alpha', higher: true },
    { key: 'effective_range', label: 'Range', suffix: ' m', higher: true },
    { key: 'power_draw', label: 'Power Draw', lower: true },
  ],
  shield: [
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'shield_hp', label: 'HP', higher: true },
    { key: 'shield_regen', label: 'Regen', higher: true },
    { key: 'regen_delay', label: 'Regen Delay', suffix: 'ms', lower: true },
    { key: 'resist_physical', label: 'Phys Resist', format: 'pct', higher: true },
    { key: 'resist_energy', label: 'Enrg Resist', format: 'pct', higher: true },
    { key: 'resist_distortion', label: 'Dist Resist', format: 'pct', higher: true },
    { key: 'power_draw', label: 'Power Draw', lower: true },
  ],
  cooler: [
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'cooling_rate', label: 'Cooling', suffix: '/s', higher: true },
    { key: 'max_temperature', label: 'Max Temp', higher: true },
    { key: 'power_draw', label: 'Power Draw', lower: true },
  ],
  power: [
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'power_output', label: 'Output', higher: true },
    { key: 'overpower_performance', label: 'Overpower', higher: true },
    { key: 'overclock_performance', label: 'Overclock', higher: true },
    { key: 'thermal_output', label: 'Heat', lower: true },
  ],
  quantum_drive: [
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'quantum_speed', label: 'Speed', suffix: ' Mm/s', higher: true },
    { key: 'quantum_range', label: 'Range', higher: true },
    { key: 'fuel_rate', label: 'Fuel Rate', lower: true },
    { key: 'spool_time', label: 'Spool', suffix: 'ms', lower: true },
    { key: 'cooldown_time', label: 'Cooldown', suffix: 'ms', lower: true },
  ],
  missile: [
    { key: 'size', label: 'Size' },
    { key: 'damage', label: 'Damage', higher: true },
    { key: 'blast_radius', label: 'Blast Radius', suffix: ' m', higher: true },
    { key: 'tracking_signal', label: 'Tracking' },
    { key: 'lock_time', label: 'Lock Time', suffix: 'ms', lower: true },
    { key: 'speed', label: 'Speed', suffix: ' m/s', higher: true },
  ],
  sensor: [
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'radar_range', label: 'Range', higher: true },
    { key: 'radar_angle', label: 'Angle', suffix: '°', higher: true },
    { key: 'power_draw', label: 'Power Draw', lower: true },
  ],
}
