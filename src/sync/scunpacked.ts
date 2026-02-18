/**
 * scunpacked-data paint sync — ported from internal/scunpacked/
 *
 * Key change from Go version: Instead of reading local JSON files,
 * this fetches paint metadata from GitHub raw URLs since Workers
 * don't have filesystem access.
 *
 * GitHub API is used to list paint files, then each is fetched via raw URL.
 */

import {
  upsertPaint,
  setPaintVehicles,
  getVehicleIDBySlug,
  findVehicleIDsBySlugLike,
  findVehicleIDsBySlugPrefix,
  findVehicleIDsByNameContains,
  insertSyncHistory,
  updateSyncHistory,
} from "../db/queries";

// --- Tag alias map (matches Go version) ---

const TAG_ALIASES: Record<string, string> = {
  "890j": "890-jump",
  "star-runner": "mercury-star-runner",
  starfighter: "ares-star-fighter",
  scout: "khartu-al",
  hornet: "%hornet%",
  "hornet-f7-mk2": "%hornet%mk-ii",
  "hornet-f7c-mk2": "%hornet%mk-ii",
  herald: "herald",
  msr: "mercury-star-runner",
  "hull-c": "hull-c",
  caterpillar: "caterpillar",
  golem: "%golem%",
  salvation: "salvation",
  ursa: "%ursa%",
};

// --- Types ---

interface PaintFile {
  Item: {
    className: string;
    name: string;
    required_tags: string;
    stdItem?: {
      Name: string;
      Description: string;
      ClassName: string;
      RequiredTags: string[];
    };
  };
}

interface ParsedPaint {
  className: string;
  name: string;
  description: string;
  vehicleTag: string;
}

// --- GitHub API ---

interface GitHubTreeEntry {
  path: string;
  type: string;
  url: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeEntry[];
}

/**
 * Fetch paint file list from GitHub API, then fetch each paint file.
 * Uses the Git Trees API to list files matching paint_*.json in items/
 */
async function fetchPaintFiles(repo: string, branch: string): Promise<ParsedPaint[]> {
  // Use the Git Trees API to list items/ directory
  const treeURL = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
  const treeResp = await fetch(treeURL, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Fleet-Manager/1.0",
    },
  });

  if (!treeResp.ok) {
    throw new Error(`GitHub API error (${treeResp.status}): ${await treeResp.text()}`);
  }

  const tree = (await treeResp.json()) as GitHubTreeResponse;
  const paintFiles = tree.tree.filter(
    (entry) =>
      entry.type === "blob" &&
      entry.path.startsWith("items/paint_") &&
      entry.path.endsWith(".json"),
  );

  console.log(`[scunpacked] Found ${paintFiles.length} paint files in GitHub repo`);

  const paints: ParsedPaint[] = [];
  let skipped = 0;

  for (const file of paintFiles) {
    try {
      const rawURL = `https://raw.githubusercontent.com/${repo}/${branch}/${file.path}`;
      const resp = await fetch(rawURL, {
        headers: { "User-Agent": "Fleet-Manager/1.0" },
      });
      if (!resp.ok) continue;

      const pf = (await resp.json()) as PaintFile;
      const item = pf.Item;

      // Use stdItem fields if available
      let name = item.name;
      let description = "";
      let className = item.className;

      if (item.stdItem) {
        if (item.stdItem.Name) name = item.stdItem.Name;
        description = item.stdItem.Description ?? "";
        if (item.stdItem.ClassName) className = item.stdItem.ClassName;
      }

      // Filter out placeholders
      if (name.includes("PLACEHOLDER")) {
        skipped++;
        continue;
      }

      // Generate readable name from className if empty
      if (!name) {
        name = nameFromClassName(className);
      }

      // Extract vehicle tag from required_tags
      let vehicleTag = item.required_tags ?? "";
      if (!vehicleTag && item.stdItem?.RequiredTags?.length) {
        vehicleTag = item.stdItem.RequiredTags[0];
      }
      if (vehicleTag.includes(" ")) {
        vehicleTag = vehicleTag.split(/\s+/)[0];
      }
      if (!vehicleTag || !isPaintTag(vehicleTag)) {
        skipped++;
        continue;
      }

      paints.push({ className, name, description, vehicleTag });
    } catch {
      // Skip files that fail to parse
      skipped++;
    }
  }

  console.log(`[scunpacked] Parsed ${paints.length} paints, skipped ${skipped}`);
  return paints;
}

// --- Paint tag helpers ---

function isPaintTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return lower.startsWith("paint_") || lower.endsWith("_paint");
}

function nameFromClassName(className: string): string {
  let s = className.replace(/^Paint_/, "");
  s = s.replace(/_/g, " ");
  return s;
}

function slugFromClassName(className: string): string {
  let s = className.replace(/^Paint_/, "");
  s = s.replace(/_/g, "-");
  return s.toLowerCase();
}

// --- Vehicle ID resolution ---

async function resolveVehicleIDs(db: D1Database, tag: string): Promise<number[]> {
  // Normalize: strip Paint_ prefix / _Paint suffix, replace _ with -, lowercase
  let normalized = tag.toLowerCase();
  normalized = normalized.replace(/^paint_/, "");
  normalized = normalized.replace(/_paint$/, "");
  normalized = normalized.replace(/_/g, "-");

  if (!normalized) return [];

  // Check alias map
  const alias = TAG_ALIASES[normalized];
  if (alias) {
    if (alias.includes("%")) {
      const ids = await findVehicleIDsBySlugLike(db, alias);
      if (ids.length > 0) return ids;
    } else {
      normalized = alias;
    }
  }

  // Try exact slug match
  const exactID = await getVehicleIDBySlug(db, normalized);
  if (exactID !== null) return [exactID];

  // Try prefix match
  const prefixIDs = await findVehicleIDsBySlugPrefix(db, normalized);
  if (prefixIDs.length > 0) return prefixIDs;

  // Try name-contains match
  const nameTerm = normalized.replace(/-/g, " ");
  const nameIDs = await findVehicleIDsByNameContains(db, nameTerm);
  if (nameIDs.length > 0) return nameIDs;

  console.debug(`[scunpacked] No vehicle match for tag "${tag}" (normalized: "${normalized}")`);
  return [];
}

// --- Sync ---

const SYNC_SOURCE_SCUNPACKED = 4;

export async function syncPaints(
  db: D1Database,
  repo: string,
  branch: string,
): Promise<number> {
  const syncID = await insertSyncHistory(db, SYNC_SOURCE_SCUNPACKED, "paints", "running");

  try {
    const paints = await fetchPaintFiles(repo, branch);
    let count = 0;
    let unmatched = 0;

    for (const pp of paints) {
      try {
        const vehicleIDs = await resolveVehicleIDs(db, pp.vehicleTag);
        const slug = slugFromClassName(pp.className);

        const paintID = await upsertPaint(db, {
          name: pp.name,
          slug,
          class_name: pp.className,
          description: pp.description,
        });

        if (vehicleIDs.length > 0) {
          await setPaintVehicles(db, paintID, vehicleIDs);
        } else {
          unmatched++;
        }
        count++;
      } catch (err) {
        console.warn(`[scunpacked] Failed to upsert paint ${pp.className}:`, err);
      }
    }

    await updateSyncHistory(db, syncID, "success", count, "");
    console.log(`[scunpacked] Paint sync complete: ${count} synced, ${unmatched} unmatched`);
    return count;
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}
