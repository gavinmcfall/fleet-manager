import { Link } from 'react-router-dom'
import { getLocationGroup } from '../../lib/lootLocations'
import { formatActorName } from '../../lib/npcNames'
import { resolveLocationEntry } from './lootHelpers'
import { LOCATION_TREE, assignShopsToTree } from '../../lib/locationHierarchy'

// ── Spawn template → container location_key mapping ─────────────────────
// Maps spawn template prefixes to the container location_key they correspond to.
// Used to nest NPCs under the correct container location group.
const SPAWN_TO_CONTAINER = [
  // ASD Delving facilities (Stanton)
  { pattern: /^ASDFacility/i, containerKey: 'ASDDelving' },
  // ASD outposts in Pyro — research & data facilities
  { pattern: /^Outpost_ASD_RF/i, containerKey: 'ASDDelving' },
  { pattern: /^Outpost_ASD_DF/i, containerKey: 'ASDDelving' },
  { pattern: /^Outpost_ASD/i, containerKey: 'ASDDelving' },
  // Kaboos asteroid base
  { pattern: /^Kaboos/i, containerKey: 'Kaboos' },
  // DC Delving
  { pattern: /^DCDelving/i, containerKey: 'DCDelving' },
  // Caves
  { pattern: /^Cave_/i, containerKey: 'Caves' },
  // Contested zones
  { pattern: /^ContestedZone/i, containerKey: 'ContestedZones' },
  { pattern: /^GhostArena/i, containerKey: 'ContestedZones' },
  // StormBreaker
  { pattern: /^StormBreaker/i, containerKey: 'StormBreaker' },
  // Kareah
  { pattern: /^Kareah/i, containerKey: 'Kareah' },
  // Colonial outposts
  { pattern: /^ColonialOutpost/i, containerKey: 'ColonialOutpost' },
  // Distribution centres
  { pattern: /^DistributionCentre/i, containerKey: 'DistributionCentre_MultiConfig' },
  // Stations
  { pattern: /^Station/i, containerKey: 'Station' },
  // UGFs
  { pattern: /^UGF/i, containerKey: 'UGFs' },
]

/** Resolve a spawn template name to a container location_key, or null */
function spawnToContainerKey(spawnTemplate) {
  // Strip the MissionLocationTemplate. prefix and the " — spawn point" suffix
  const cleaned = spawnTemplate
    .replace(/^MissionLocationTemplate\./i, '')
    .split(' — ')[0]
  for (const { pattern, containerKey } of SPAWN_TO_CONTAINER) {
    if (pattern.test(cleaned)) return containerKey
  }
  return null
}

const LOCATION_GROUP_CONFIG = {
  named:     { label: 'Named Locations', order: 0 },
  cave:      { label: 'Caves',           order: 1 },
  outpost:   { label: 'Outposts',        order: 2 },
  dc:        { label: 'Distribution Centres', order: 3 },
  facility:  { label: 'Facilities',      order: 4 },
  contested: { label: 'Contested Zones', order: 5 },
  station:   { label: 'Stations',        order: 6 },
  derelict:  { label: 'Derelicts',       order: 7 },
  generic:   { label: 'Generic',         order: 8 },
}

function LocationRow({ row, linkTo }) {
  const labelContent = linkTo ? (
    <Link to={linkTo} className="text-xs font-mono text-sc-accent hover:text-sc-accent/80 break-words min-w-0 transition-colors">
      {row.label}
    </Link>
  ) : (
    <span className="text-xs font-mono text-gray-300 break-words min-w-0">{row.label}</span>
  )

  return (
    <div className="flex items-center justify-between gap-2 pl-2 border-l border-sc-border">
      {labelContent}
      <div className="flex items-center gap-1.5 shrink-0">
        {row.detail && (
          <span className="text-[10px] font-mono text-gray-500">{row.detail}</span>
        )}
        {row.probability != null && (
          <span className="text-[10px] font-mono text-gray-600">{(row.probability * 100).toFixed(1)}%</span>
        )}
      </div>
    </div>
  )
}

/** Render a single NPC row with link to loadout page */
function NpcRow({ actorDisplay, actor, factionCode, probability }) {
  const rowLink = factionCode && actor
    ? `/npc-loadouts?faction=${encodeURIComponent(factionCode)}&loadout=${encodeURIComponent(actor)}`
    : null
  return (
    <div className="flex items-center justify-between gap-2 pl-4 border-l border-sc-accent/20">
      {rowLink ? (
        <Link to={rowLink} className="text-xs font-mono text-sc-accent/70 hover:text-sc-accent transition-colors">
          {actorDisplay}
        </Link>
      ) : (
        <span className="text-xs font-mono text-gray-400">{actorDisplay}</span>
      )}
      {probability != null && (
        <span className="text-[10px] font-mono text-gray-600">{(probability * 100).toFixed(1)}%</span>
      )}
    </div>
  )
}

/**
 * Process NPC data into two tiers:
 * 1. located: NPCs with spawn_locations matched to container rawKeys → Map<containerRawKey, NpcRow[]>
 * 2. unlocated: NPCs without spawn data → grouped by faction
 */
function partitionNpcs(npcData) {
  if (!npcData || !Array.isArray(npcData) || npcData.length === 0) {
    return { located: new Map(), unlocated: [] }
  }

  // containerRawKey → [{actorDisplay, actor, factionCode, probability}]
  const located = new Map()
  // Faction-grouped fallback
  const factionMap = new Map()
  const seenActors = new Set()

  for (const entry of npcData) {
    const row = resolveLocationEntry(entry, 'npcs')
    const actorKey = row.actor || row.detail || '—'

    // Deduplicate by actor
    if (seenActors.has(actorKey)) continue
    seenActors.add(actorKey)

    const npcInfo = {
      actorDisplay: row.actor ? formatActorName(row.actor) : (row.detail || '—'),
      actor: row.actor,
      factionCode: row.factionCode,
      probability: row.probability,
    }

    // Try to match spawn locations to container keys
    let matched = false
    if (row.spawnLocations) {
      const matchedKeys = new Set()
      for (const template of row.spawnLocations) {
        const containerKey = spawnToContainerKey(template)
        if (containerKey) matchedKeys.add(containerKey)
      }
      if (matchedKeys.size > 0) {
        matched = true
        for (const key of matchedKeys) {
          if (!located.has(key)) located.set(key, [])
          located.get(key).push(npcInfo)
        }
      }
    }

    // Fallback: group by faction
    if (!matched) {
      const factionName = row.faction || row.label
      if (!factionMap.has(factionName)) {
        factionMap.set(factionName, { factionCode: row.factionCode, actors: [] })
      }
      const bucket = factionMap.get(factionName)
      if (row.factionCode) bucket.factionCode = row.factionCode
      bucket.actors.push(npcInfo)
    }
  }

  const unlocated = [...factionMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([factionName, { factionCode, actors }]) => ({
      factionName,
      factionCode,
      actors,
    }))

  return { located, unlocated }
}

export default function LocationSection({ label, icon: Icon, data, type, npcData }) {
  const hasData = data && Array.isArray(data) && data.length > 0
  const hasNpcData = npcData && Array.isArray(npcData) && npcData.length > 0
  // For containers, render even if container data is empty but NPC data exists
  if (!hasData && !(type === 'containers' && hasNpcData)) return null

  // Deduplicate: npcs key by faction+slot; others by label
  const seen = new Map()
  for (const entry of (data || [])) {
    const row = resolveLocationEntry(entry, type)
    const key = (type === 'npcs')
      ? `${row.label}|${row.detail || ''}`
      : row.label
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, row)
    } else if (row.probability != null && (existing.probability == null || row.probability > existing.probability)) {
      existing.probability = row.probability
    }
  }

  const rows = [...seen.values()]

  // Grouped rendering for containers (+ nested NPCs)
  if (type === 'containers') {
    // Bucket rows by group
    const buckets = new Map()
    // Also track which rawKeys exist in each group for NPC matching
    const rawKeyToGroup = new Map()
    for (const row of rows) {
      const groupKey = getLocationGroup(row.rawKey)
      if (!buckets.has(groupKey)) buckets.set(groupKey, [])
      buckets.get(groupKey).push(row)
      if (row.rawKey) rawKeyToGroup.set(row.rawKey, groupKey)
    }

    // Sort groups by config order; sort rows within each group alphabetically
    const sortedGroups = [...buckets.entries()].sort(([a], [b]) => {
      const ao = LOCATION_GROUP_CONFIG[a]?.order ?? 99
      const bo = LOCATION_GROUP_CONFIG[b]?.order ?? 99
      return ao - bo
    })
    for (const [, groupRows] of sortedGroups) {
      groupRows.sort((a, b) => a.label.localeCompare(b.label))
    }

    // Partition NPCs into located (matched to container keys) and unlocated (faction fallback)
    const { located, unlocated } = partitionNpcs(npcData)

    // Build a map: groupKey → NPC rows (for NPCs matched to container rawKeys in this group)
    const npcsByGroup = new Map()
    for (const [containerRawKey, npcs] of located) {
      // Find which group this container belongs to
      let groupKey = rawKeyToGroup.get(containerRawKey)
      if (!groupKey) {
        // Container key from spawn mapping might not be in our container data,
        // but we can still determine its group
        groupKey = getLocationGroup(containerRawKey)
      }
      if (!npcsByGroup.has(groupKey)) npcsByGroup.set(groupKey, [])
      npcsByGroup.get(groupKey).push(...npcs)
    }

    const hasAnyNpcs = located.size > 0 || unlocated.length > 0
    const sectionLabel = hasAnyNpcs ? 'Containers & NPCs' : label

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-400">{sectionLabel}</span>
        </div>
        <div className="space-y-3">
          {sortedGroups.map(([groupKey, groupRows]) => {
            const groupNpcs = npcsByGroup.get(groupKey) || []
            return (
            <div key={groupKey}>
              <p className="text-[10px] font-display uppercase tracking-wider text-gray-500 mb-1 pl-2">
                {LOCATION_GROUP_CONFIG[groupKey]?.label ?? groupKey}
              </p>
              <div className="space-y-1">
                {groupRows.map((row, i) => (
                  <LocationRow
                    key={i}
                    row={row}
                    linkTo={row.rawKey ? `/poi/${encodeURIComponent(row.rawKey)}` : undefined}
                  />
                ))}
                {groupNpcs.map((npc, i) => (
                  <NpcRow key={`npc-${i}`} {...npc} />
                ))}
              </div>
            </div>
            )
          })}
          {/* NPCs matched to locations that don't have container rows — render as new groups */}
          {[...npcsByGroup.entries()]
            .filter(([groupKey]) => !buckets.has(groupKey))
            .sort(([a], [b]) => {
              const ao = LOCATION_GROUP_CONFIG[a]?.order ?? 99
              const bo = LOCATION_GROUP_CONFIG[b]?.order ?? 99
              return ao - bo
            })
            .map(([groupKey, npcs]) => (
              <div key={`npc-group-${groupKey}`}>
                <p className="text-[10px] font-display uppercase tracking-wider text-gray-500 mb-1 pl-2">
                  {LOCATION_GROUP_CONFIG[groupKey]?.label ?? groupKey}
                </p>
                <div className="space-y-1">
                  {npcs.map((npc, i) => (
                    <NpcRow key={`npc-${i}`} {...npc} />
                  ))}
                </div>
              </div>
            ))}
          {/* Unlocated NPCs — fallback grouped by faction */}
          {unlocated.map(({ factionName, factionCode, actors }) => (
            <div key={factionName}>
              {factionCode ? (
                <Link to={`/npc-loadouts?faction=${encodeURIComponent(factionCode)}`} className="text-[10px] font-display uppercase tracking-wider text-sc-accent hover:text-sc-accent/80 mb-1 pl-2 block transition-colors">
                  {factionName} NPCs
                </Link>
              ) : (
                <p className="text-[10px] font-display uppercase tracking-wider text-gray-500 mb-1 pl-2">
                  {factionName} NPCs
                </p>
              )}
              <div className="space-y-1">
                {actors.map((npc, i) => (
                  <NpcRow key={`npc-${i}`} {...npc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // NPCs are rendered inside the containers section via npcData prop — skip standalone rendering
  if (type === 'npcs') return null

  // Shops: hierarchical grouping by star system / planet / location
  if (type === 'shops') {
    // Map rows to objects compatible with assignShopsToTree (needs location_name)
    const shopObjects = rows.map(row => ({ ...row, location_name: row.locationLabel }))
    const { tree, unmatched } = assignShopsToTree(LOCATION_TREE, shopObjects)

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-400">{label}</span>
        </div>
        <div className="space-y-1">
          {tree.map(node => (
            <ShopTreeSection key={node.name} node={node} depth={0} />
          ))}
          {unmatched.length > 0 && (
            <div>
              <p className="text-[10px] font-display uppercase tracking-wider text-gray-500 mb-1 pl-2">Other</p>
              <div className="space-y-1">
                {unmatched.map((row, i) => (
                  <LocationRow
                    key={i}
                    row={row}
                    linkTo={row.rawKey ? `/poi/shop/${encodeURIComponent(row.rawKey)}` : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default flat rendering (contracts)
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] font-display uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className="space-y-1">
        {rows.map((row, i) => (
          <LocationRow
            key={i}
            row={row}
            linkTo={
              row.contractKey && row.contractRef ? `/missions?view=all&guild=${encodeURIComponent(row.contractRef)}`
              : row.contractKey ? '/missions'
              : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}

/** Recursive tree node for shops — only renders branches with shops */
function ShopTreeSection({ node, depth }) {
  const hasShops = node.shops?.length > 0
  const hasChildren = node.children?.length > 0

  // Count total shops in this subtree
  let total = node.shops?.length || 0
  if (node.children) {
    for (const child of node.children) {
      total += countNodeShops(child)
    }
  }
  if (total === 0) return null

  const indentStyle = depth > 0 ? { marginLeft: `${depth * 0.75}rem` } : undefined

  return (
    <div style={indentStyle}>
      <p className={`text-[10px] font-display uppercase tracking-wider mb-1 pl-2 ${
        depth === 0 ? 'text-gray-400 font-semibold' : 'text-gray-500'
      }`}>
        {node.name}
      </p>
      {hasShops && (
        <div className="space-y-1">
          {node.shops.map((row, i) => (
            <LocationRow
              key={i}
              row={row}
              linkTo={row.rawKey ? `/poi/shop/${encodeURIComponent(row.rawKey)}` : undefined}
            />
          ))}
        </div>
      )}
      {hasChildren && node.children.map(child => (
        <ShopTreeSection key={child.name} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function countNodeShops(node) {
  let count = node.shops?.length || 0
  if (node.children) {
    for (const child of node.children) {
      count += countNodeShops(child)
    }
  }
  return count
}
