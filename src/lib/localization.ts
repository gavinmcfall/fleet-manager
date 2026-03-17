/**
 * Localization Builder — label generation and global.ini merge logic.
 *
 * Generates override key/value pairs for:
 *   - ASOP fleet ordering: vehicle_Name{class_name} → "N. Original Name"
 *   - Component/item labels: item_Name{class_name} → "Name [Mfr | SN | Gr.X | Class]"
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabelOverride {
  key: string;
  value: string;
  original?: string;
}

export interface AsopEntry {
  vehicleId: number;
  className: string;
  vehicleName: string;
  sortPosition: number;
  customLabel?: string | null;
}

export interface ItemRow {
  className: string;
  name: string;
  manufacturerCode: string | null;
  size: number | null;
  grade: string | null;
  subType: string | null;
}

type LabelFormat = "suffix" | "prefix";

// ---------------------------------------------------------------------------
// ASOP fleet ordering
// ---------------------------------------------------------------------------

export function generateAsopOverrides(
  entries: AsopEntry[],
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  const sorted = [...entries].sort((a, b) => a.sortPosition - b.sortPosition);

  for (const entry of sorted) {
    if (!entry.className) continue;
    const pos = entry.sortPosition;
    const label = entry.customLabel || entry.vehicleName;
    const numbered = `${pos}. ${label}`;

    // Full name key: vehicle_Name{CLASS_NAME}
    overrides.push({
      key: `vehicle_Name${entry.className}`,
      value: numbered,
      original: entry.vehicleName,
    });

    // Short name key: vehicle_Name{CLASS_NAME}_short
    // Strip manufacturer prefix for short name (take last word(s) after first space)
    const shortName = entry.customLabel || stripManufacturer(entry.vehicleName);
    overrides.push({
      key: `vehicle_Name${entry.className}_short`,
      value: `${pos}. ${shortName}`,
      original: shortName,
    });
  }

  return overrides;
}

function stripManufacturer(fullName: string): string {
  // Vehicle names are typically "Manufacturer Model" e.g. "Aegis Idris-P"
  // The _short variant typically has just the model name
  // We don't try to be clever here — the _short key in global.ini already exists
  // and will be overwritten. This is just for preview.
  const parts = fullName.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

// ---------------------------------------------------------------------------
// Component / item label generation
// ---------------------------------------------------------------------------

function buildDetailTag(
  row: { manufacturerCode: string | null; size: number | null; grade: string | null; subType: string | null },
): string {
  const parts: string[] = [];
  if (row.manufacturerCode) parts.push(row.manufacturerCode);
  if (row.size != null) parts.push(`S${row.size}`);
  if (row.grade) parts.push(`Gr.${row.grade}`);
  if (row.subType) parts.push(row.subType);
  return parts.join(" | ");
}

function formatLabel(
  name: string,
  detailTag: string,
  format: LabelFormat,
): string {
  if (!detailTag) return name;
  return format === "prefix" ? `[${detailTag}] ${name}` : `${name} [${detailTag}]`;
}

export function generateItemLabels(
  rows: ItemRow[],
  format: LabelFormat = "suffix",
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  for (const row of rows) {
    if (!row.className) continue;
    const tag = buildDetailTag(row);
    const key = `item_Name${row.className}`;
    overrides.push({
      key,
      value: formatLabel(row.name, tag, format),
      original: row.name,
    });
    // Also generate the _SCItem variant key (some items use this suffix)
    if (!row.className.endsWith("_SCItem")) {
      overrides.push({
        key: `item_Name${row.className}_SCItem`,
        value: formatLabel(row.name, tag, format),
        original: row.name,
      });
    }
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

/**
 * Merge overrides into the base global.ini content.
 * Case-insensitive key matching (global.ini keys have inconsistent casing).
 */
export function mergeGlobalIni(
  baseContent: string,
  overrides: Map<string, string>,
): string {
  // Build a lowercase → override value map for case-insensitive matching
  const lowerMap = new Map<string, string>();
  for (const [k, v] of overrides) {
    lowerMap.set(k.toLowerCase(), v);
  }

  const lines = baseContent.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      result.push(line);
      continue;
    }
    const key = line.substring(0, eqIdx).trim();
    const override = lowerMap.get(key.toLowerCase());
    if (override !== undefined) {
      result.push(`${key}=${override}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// Config defaults
// ---------------------------------------------------------------------------

export interface LocalizationConfig {
  asopEnabled: boolean;
  labelsVehicleComponents: boolean;
  labelsFpsWeapons: boolean;
  labelsFpsArmour: boolean;
  labelsFpsHelmets: boolean;
  labelsFpsAttachments: boolean;
  labelsFpsUtilities: boolean;
  labelsConsumables: boolean;
  labelsShipMissiles: boolean;
  labelFormat: LabelFormat;
}

export const DEFAULT_CONFIG: LocalizationConfig = {
  asopEnabled: false,
  labelsVehicleComponents: false,
  labelsFpsWeapons: false,
  labelsFpsArmour: false,
  labelsFpsHelmets: false,
  labelsFpsAttachments: false,
  labelsFpsUtilities: false,
  labelsConsumables: false,
  labelsShipMissiles: false,
  labelFormat: "suffix",
};

export function configFromRow(row: Record<string, unknown>): LocalizationConfig {
  return {
    asopEnabled: !!row.asop_enabled,
    labelsVehicleComponents: !!row.labels_vehicle_components,
    labelsFpsWeapons: !!row.labels_fps_weapons,
    labelsFpsArmour: !!row.labels_fps_armour,
    labelsFpsHelmets: !!row.labels_fps_helmets,
    labelsFpsAttachments: !!row.labels_fps_attachments,
    labelsFpsUtilities: !!row.labels_fps_utilities,
    labelsConsumables: !!row.labels_consumables,
    labelsShipMissiles: !!row.labels_ship_missiles,
    labelFormat: (row.label_format as LabelFormat) || "suffix",
  };
}
