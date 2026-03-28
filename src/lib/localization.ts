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

/**
 * Generate item label overrides. Only produces overrides for keys that
 * exist in validKeys (the actual global.ini key set). This prevents
 * phantom keys from colliding with unrelated entries.
 */
export function generateItemLabels(
  rows: ItemRow[],
  catFormat: CategoryFormat,
  validKeys?: Set<string>,
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  for (const row of rows) {
    if (!row.className) continue;
    const key = `item_Name${row.className}`;
    // Only override keys that actually exist in the base file
    if (validKeys && !validKeys.has(key)) continue;
    const tag = buildDetailTag(row, catFormat.fields);
    overrides.push({
      key,
      value: formatLabel(row.name, tag, catFormat.format),
      original: row.name,
    });
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Enhancements — server-generated overrides from our own data
// ---------------------------------------------------------------------------

/** Contraband warnings: prefix illegal commodity names with [!] */
export function generateContrabandWarnings(
  rows: Array<{ className: string; name: string }>,
  validKeys?: Set<string>,
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  for (const row of rows) {
    if (!row.className) continue;
    const key = `item_Name${row.className}`;
    if (validKeys && !validKeys.has(key)) continue;
    overrides.push({
      key,
      value: `[!] ${row.name}`,
      original: row.name,
    });
  }
  return overrides;
}

/** Material name shortening map — long mining names → short versions */
const MATERIAL_SHORT_NAMES: Record<string, string> = {
  Hephaestanite: "Heph",
  Quantanium: "Quant",
  Taranite: "Tara",
  Bexalite: "Bex",
  Laranite: "Lara",
  Agricium: "Agri",
  Titanium: "Ti",
  Aluminium: "Al",
  Tungsten: "W",
  Corundum: "Corun",
  Lindinium: "Lind",
  Stileron: "Stil",
  Hadanite: "Had",
  Aphorite: "Aph",
  Dolivine: "Dol",
};

/** Shorten material/mineable element names */
export function generateMaterialShortNames(
  rows: Array<{ className: string; name: string }>,
  validKeys?: Set<string>,
): LabelOverride[] {
  const overrides: LabelOverride[] = [];
  for (const row of rows) {
    if (!row.className) continue;
    // Find a matching short name
    let shortened: string | null = null;
    for (const [long, short] of Object.entries(MATERIAL_SHORT_NAMES)) {
      if (row.name.startsWith(long)) {
        shortened = row.name.replace(long, short);
        break;
      }
    }
    if (!shortened) continue;

    const key = `item_Name${row.className}`;
    if (validKeys && !validKeys.has(key)) continue;
    overrides.push({
      key,
      value: shortened,
      original: row.name,
    });
  }
  return overrides;
}

/**
 * Generate blueprint pool text for contract descriptions.
 * Returns overrides that append blueprint lists to description strings.
 */
export function generateBlueprintPoolOverrides(
  contracts: Array<{
    debugName: string;
    blueprintNames: string[];
  }>,
  baseContent: Map<string, string>,
): LabelOverride[] {
  const overrides: LabelOverride[] = [];

  for (const contract of contracts) {
    if (contract.blueprintNames.length === 0) continue;

    // Try common description key patterns
    const descKeys = [
      `${contract.debugName}_desc`,
      `${contract.debugName}_Desc`,
    ];

    for (const key of descKeys) {
      const existing = baseContent.get(key);
      if (existing === undefined) continue;

      const bpList = contract.blueprintNames.map((n) => `- ${n}`).join("\\n");
      const appended = `${existing}\\n\\n<EM4>Potential Blueprints</EM4>\\n${bpList}`;

      overrides.push({
        key,
        value: appended,
        original: existing,
      });
      break; // Only match first key variant
    }
  }

  return overrides;
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

/**
 * Merge overrides into the base global.ini content.
 * Exact case matching — only replaces keys that match precisely.
 */
export function mergeGlobalIni(
  baseContent: string,
  overrides: Map<string, string>,
): string {
  const lines = baseContent.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      result.push(line);
      continue;
    }
    const key = line.substring(0, eqIdx).trim();
    const override = overrides.get(key);
    if (override !== undefined) {
      result.push(`${key}=${override}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Parse all keys from a global.ini file content.
 * Returns exact-case keys for validation.
 */
export function parseGlobalIniKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    keys.add(line.substring(0, eqIdx).trim());
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface OverlayPackMeta {
  name: string;
  label: string;
  description: string | null;
  icon: string | null;
  keyCount: number;
}

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
  enabledPacks: string[];
  enhanceContrabandWarnings: boolean;
  enhanceMaterialNames: boolean;
  enhanceBlueprintPools: boolean;
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
  enabledPacks: [],
  enhanceContrabandWarnings: false,
  enhanceMaterialNames: false,
  enhanceBlueprintPools: false,
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

  let enabledPacks: string[] = [];
  if (row.enabled_packs_json && typeof row.enabled_packs_json === "string") {
    try {
      enabledPacks = JSON.parse(row.enabled_packs_json);
    } catch {
      enabledPacks = [];
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
    enabledPacks,
    enhanceContrabandWarnings: !!row.enhance_contraband_warnings,
    enhanceMaterialNames: !!row.enhance_material_names,
    enhanceBlueprintPools: !!row.enhance_blueprint_pools,
  };
}

/** Parse key=value lines from INI content into a Map */
export function parseIniOverrides(content: string): Map<string, string> {
  const overrides = new Map<string, string>();
  const lines = content.split("\n");
  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.substring(0, eqIdx).trim();
    if (!key) continue;
    overrides.set(key, line.substring(eqIdx + 1));
  }
  return overrides;
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
