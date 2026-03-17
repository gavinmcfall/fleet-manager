/**
 * Localization Builder — label generation and global.ini merge logic.
 *
 * Generates override key/value pairs for:
 *   - ASOP fleet ordering: vehicle_Name{class_name} → "N. Original Name"
 *   - Component/item labels: item_Name{class_name} → "Name [Mfr | SN | Gr.X | SubType]"
 *
 * Each label category has its own field config: which fields to include and
 * in what order. Users configure this per-category via the frontend.
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

export type LabelFormat = "suffix" | "prefix";

/** A field that can appear in a label tag */
export type LabelField = "manufacturer" | "size" | "grade" | "subType";

/** Per-category format configuration */
export interface CategoryFormat {
  fields: LabelField[];
  format: LabelFormat;
}

/** Map of category key → format config */
export type CategoryFormats = Record<string, CategoryFormat>;

// ---------------------------------------------------------------------------
// Available fields per category (what the DB actually has)
// ---------------------------------------------------------------------------

// Only fields with meaningful, varied data per category.
// Excludes: columns that don't exist on the table, columns where every row
// has the same value (e.g. grade=A only), or columns with unhelpful data.
export const CATEGORY_AVAILABLE_FIELDS: Record<string, LabelField[]> = {
  vehicle_components: ["manufacturer", "size", "grade", "subType"],
  fps_weapons: ["manufacturer", "size", "subType"],
  fps_armour: ["manufacturer", "subType"],
  fps_helmets: ["manufacturer", "grade", "subType"],
  fps_attachments: ["manufacturer", "subType"],
  fps_utilities: ["manufacturer", "subType"],
  consumables: ["manufacturer", "subType"],
  ship_missiles: ["manufacturer", "size", "subType"],
};

/** Human-readable field labels */
export const FIELD_LABELS: Record<LabelField, string> = {
  manufacturer: "Manufacturer",
  size: "Size",
  grade: "Grade",
  subType: "Type",
};

/** Default format for a category: all available fields, suffix format */
export function defaultCategoryFormat(category: string): CategoryFormat {
  return {
    fields: [...(CATEGORY_AVAILABLE_FIELDS[category] || [])],
    format: "suffix",
  };
}

// ---------------------------------------------------------------------------
// ASOP fleet ordering
// ---------------------------------------------------------------------------

export function generateAsopOverrides(
  entries: AsopEntry[],
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  const sorted = [...entries].sort((a, b) => a.sortPosition - b.sortPosition);
  const padWidth = sorted.length >= 10 ? 2 : 1;

  for (const entry of sorted) {
    if (!entry.className) continue;
    const pos = String(entry.sortPosition).padStart(padWidth, "0");

    // Full name: "07. Aegis Idris-P" or "07. Aegis Idris-P "James Holden""
    const fullLabel = entry.customLabel
      ? `${pos}. ${entry.vehicleName} "${entry.customLabel}"`
      : `${pos}. ${entry.vehicleName}`;

    overrides.push({
      key: `vehicle_Name${entry.className}`,
      value: fullLabel,
      original: entry.vehicleName,
    });

    // Short name: "07. Idris-P" or "07. Idris-P "James Holden""
    const short = stripManufacturer(entry.vehicleName);
    const shortLabel = entry.customLabel
      ? `${pos}. ${short} "${entry.customLabel}"`
      : `${pos}. ${short}`;

    overrides.push({
      key: `vehicle_Name${entry.className}_short`,
      value: shortLabel,
      original: short,
    });
  }

  return overrides;
}

function stripManufacturer(fullName: string): string {
  const parts = fullName.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

// ---------------------------------------------------------------------------
// Component / item label generation
// ---------------------------------------------------------------------------

/** Build the detail tag using only the specified fields in order */
function buildDetailTag(
  row: ItemRow,
  fields: LabelField[],
): string {
  const parts: string[] = [];
  for (const field of fields) {
    switch (field) {
      case "manufacturer":
        if (row.manufacturerCode) parts.push(row.manufacturerCode);
        break;
      case "size":
        if (row.size != null) parts.push(`S${row.size}`);
        break;
      case "grade":
        if (row.grade) parts.push(`Gr.${row.grade}`);
        break;
      case "subType":
        if (row.subType) parts.push(row.subType);
        break;
    }
  }
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
  catFormat: CategoryFormat,
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  for (const row of rows) {
    if (!row.className) continue;
    const tag = buildDetailTag(row, catFormat.fields);
    const key = `item_Name${row.className}`;
    overrides.push({
      key,
      value: formatLabel(row.name, tag, catFormat.format),
      original: row.name,
    });
    if (!row.className.endsWith("_SCItem")) {
      overrides.push({
        key: `item_Name${row.className}_SCItem`,
        value: formatLabel(row.name, tag, catFormat.format),
        original: row.name,
      });
    }
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

export function mergeGlobalIni(
  baseContent: string,
  overrides: Map<string, string>,
): string {
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
// Config
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
  categoryFormats: CategoryFormats;
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
  categoryFormats: {},
};

export function configFromRow(row: Record<string, unknown>): LocalizationConfig {
  let categoryFormats: CategoryFormats = {};
  if (row.category_formats_json && typeof row.category_formats_json === "string") {
    try {
      categoryFormats = JSON.parse(row.category_formats_json);
    } catch {
      categoryFormats = {};
    }
  }

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
    categoryFormats,
  };
}

/** Resolve the format for a category: per-category override → global fallback */
export function resolveCategoryFormat(
  config: LocalizationConfig,
  category: string,
): CategoryFormat {
  if (config.categoryFormats[category]) {
    return config.categoryFormats[category];
  }
  // Fallback: all available fields with global format
  return {
    fields: [...(CATEGORY_AVAILABLE_FIELDS[category] || [])],
    format: config.labelFormat,
  };
}
