/**
 * Crafting resource color groupings.
 *
 * Groups the 22 crafting resources into 5 logical buckets by value tier,
 * each assigned a distinct color for the blueprint card resource row.
 * Approved by Gavin 2026-04-10.
 *
 * Future: these colors will be replaced with per-resource SVG icons
 * (W.I.P.). The grouping itself is stable — icons inherit the group
 * color as a fallback/accent.
 *
 * Bucket rationale:
 *   base       — cheap, common bulk filler (steel grey)
 *   industrial — mid-tier construction metals (bronze/amber)
 *   precious   — high-value staples (gold)
 *   rare       — premium crafting exotics (teal)
 *   exotic     — top-tier Pyro/quantum materials (violet)
 */

export const RESOURCE_GROUPS = {
  base: {
    color: '#6b7280',
    members: ['Aluminum', 'Copper', 'Iron', 'Tin', 'Quartz', 'Silicon'],
  },
  industrial: {
    color: '#f5a623',
    members: ['Beryl', 'Titanium', 'Tungsten', 'Corundum', 'Hephaestanite'],
  },
  precious: {
    color: '#fbbf24',
    members: ['Gold', 'Agricium', 'Laranite', 'Taranite'],
  },
  rare: {
    color: '#2ec4b6',
    members: ['Riccite', 'Stileron', 'Ouratite'],
  },
  exotic: {
    color: '#a78bfa',
    members: ['Lindinium', 'Savrilium', 'Aslarite', 'Torite'],
  },
}

const FALLBACK_COLOR = '#6b7280'

// Build a case-insensitive lookup map: lowercase name → { group, color }
const LOOKUP = new Map()
for (const [group, { color, members }] of Object.entries(RESOURCE_GROUPS)) {
  for (const name of members) {
    LOOKUP.set(name.toLowerCase(), { group, color })
  }
}

/**
 * Get the group key for a resource name (case-insensitive).
 * Returns 'unknown' for resources not in the mapping.
 */
export function getResourceGroup(name) {
  return LOOKUP.get(name?.toLowerCase())?.group ?? 'unknown'
}

/**
 * Get the display color for a resource name (case-insensitive).
 * Returns the fallback steel grey for unknown resources.
 */
export function getResourceColor(name) {
  return LOOKUP.get(name?.toLowerCase())?.color ?? FALLBACK_COLOR
}
