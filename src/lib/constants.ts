/**
 * Shared constants — sync source IDs match seed data in 0001_initial_schema.sql
 */

// CORS — pinned extension IDs for SC Bridge Sync.
// Extension IDs are stable after store publication. Update these when publishing new extensions.
export const TRUSTED_EXTENSION_ORIGINS = new Set<string>([
  "chrome-extension://edndedmmbdbofdphimpcofdccbpbgjib", // Microsoft Edge Add-ons
  // Add Chrome Web Store ID once approved:
  // "chrome-extension://gcokkoamjodagagbojhkimfbjjpdfefi",
]);

export const isTrustedExtension = (origin: string) =>
  TRUSTED_EXTENSION_ORIGINS.has(origin);

export const SYNC_SOURCE = {
  HANGARXPLOR: 3,
  SCUNPACKED: 4,
  RSI_API: 5,
} as const;

// --- Map port_type (vehicle_ports) → component type (vehicle_components) ---
// vehicle_ports uses lowercase, vehicle_components uses PascalCase
export const PORT_TYPE_TO_COMPONENT_TYPE: Record<string, string[]> = {
  power: ["PowerPlant"],
  cooler: ["Cooler"],
  shield: ["Shield"],
  quantum_drive: ["QuantumDrive"],
  weapon: ["WeaponGun"],
  turret: ["TurretBase", "Turret"],
  missile: ["Missile", "MissileLauncher", "BombLauncher"],
  sensor: ["Radar", "Scanner"],
  countermeasure: ["WeaponDefensive"],
  mining_laser: ["WeaponMining"],
  salvage_head: ["SalvageHead"],
  salvage_module: ["SalvageModifier", "MiningModifier"],
  qed: ["QuantumInterdictionGenerator"],
  jump_drive: ["JumpDrive"],
};

// --- Stat sort keys per component type ---
export const STAT_SORT_KEY: Record<string, string> = {
  PowerPlant: "vc.power_output",
  Cooler: "vc.cooling_rate",
  Shield: "vc.shield_hp",
  QuantumDrive: "vc.quantum_speed",
  WeaponGun: "vc.dps",
  Radar: "vc.radar_range",
  MissileLauncher: "vc.damage",
  TurretBase: "vc.dps",
  Turret: "vc.dps",
  QuantumInterdictionGenerator: "vc.qed_range",
};
