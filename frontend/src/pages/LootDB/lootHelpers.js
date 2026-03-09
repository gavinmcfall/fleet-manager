import { ShoppingCart, Package, Swords, Skull, FileText } from 'lucide-react'
import { friendlyShopName } from '../../lib/shopNames'
import { friendlyLocation, friendlyFaction } from '../../lib/lootLocations'

// ── Set name extraction ───────────────────────────────────────────────────────
export const PIECE_SUFFIXES = [
  'Sniper Rifle', 'Assault Rifle', 'Helmet', 'Chestplate', 'Backplate', 'Core', 'Arms', 'Legs',
  'Undersuit', 'Backpack', 'Hat', 'Jacket', 'Pants', 'Rifle', 'Pistol', 'SMG', 'Shotgun',
  'LMG', 'Launcher', 'Blade', 'Knife', 'Carbine', 'Suit', 'Gloves', 'Boots', 'Vest',
]

export function extractSetName(itemName, manufacturerName) {
  let s = itemName
  if (manufacturerName && s.startsWith(manufacturerName)) {
    s = s.slice(manufacturerName.length).trim()
  }
  // Try suffix at end first (base pieces: "Geist Armor Arms" → "Geist Armor")
  for (const suffix of PIECE_SUFFIXES) {
    if (s.endsWith(' ' + suffix)) {
      s = s.slice(0, -(suffix.length + 1)).trim()
      return s || null
    }
    if (s === suffix) return null
  }
  // Try suffix in middle (variant pieces: "Geist Armor Helmet Snow Camo" → "Geist Armor Snow Camo")
  for (const suffix of PIECE_SUFFIXES) {
    const marker = ' ' + suffix + ' '
    const idx = s.indexOf(marker)
    if (idx !== -1) {
      s = (s.slice(0, idx) + ' ' + s.slice(idx + marker.length)).trim()
      return s || null
    }
  }
  return s || null
}

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGE_SIZE_GRID = 60
export const PAGE_SIZE_LIST = 100

// ── Location entry resolver ───────────────────────────────────────────────────
export function resolveLocationEntry(entry, type) {
  if (typeof entry === 'string') return { label: entry, detail: null, probability: null }
  if (type === 'shops') {
    const rawShopKey = entry.shop || entry.name || ''
    const price = entry.buyPrice ? `${Math.round(entry.buyPrice).toLocaleString()} aUEC` : null
    return { label: friendlyShopName(rawShopKey), detail: price, probability: null, rawKey: rawShopKey, shopKey: true }
  }
  if (type === 'npcs' || type === 'corpses') {
    const rawFaction = entry.faction || entry.actor || entry.name
    const faction = friendlyFaction(rawFaction)
    return {
      label: faction,
      detail: entry.slot || null,
      probability: entry.probability ?? null,
      faction,
      rawKey: rawFaction,
      npcKey: true,
    }
  }
  if (type === 'contracts') {
    const guild = entry.guild || entry.contract || '?'
    const contractRef = entry.contract || null
    return { label: guild, detail: null, probability: null, contractKey: true, contractRef }
  }
  // containers, default
  const rawKey = entry.location || entry.locationTag || ''
  return {
    label: entry.location ? friendlyLocation(entry.location) : (entry.locationTag || entry.name || '?'),
    detail: entry.containerType || null,
    probability: entry.perContainer ?? entry.probability ?? null,
    rawKey,
  }
}

// ── JSON parsing ─────────────────────────────────────────────────────────────
export function parseJson(str) {
  if (!str || str === 'null' || str === '[]') return []
  try { return JSON.parse(str) || [] } catch { return [] }
}

// ── Shopping list aggregation ─────────────────────────────────────────────────
export const SOURCE_DEFS = [
  { key: 'shops',     label: 'Shops',      jsonKey: 'shops_json',     icon: ShoppingCart },
  { key: 'containers', label: 'Containers', jsonKey: 'containers_json', icon: Package },
  { key: 'npcs',      label: 'NPCs',       jsonKey: 'npcs_json',      icon: Swords },
  { key: 'corpses',   label: 'Corpses',    jsonKey: 'corpses_json',   icon: Skull },
  { key: 'contracts', label: 'Contracts',  jsonKey: 'contracts_json', icon: FileText },
]

export function buildShoppingList(wishlistItems) {
  if (!wishlistItems?.length) return {}
  const groups = {}
  const parseJson = (str) => { try { return JSON.parse(str) || [] } catch { return [] } }

  wishlistItems.forEach(item => {
    SOURCE_DEFS.forEach(({ key, label, jsonKey, icon }) => {
      const entries = parseJson(item[jsonKey])
      if (!entries.length) return
      if (!groups[key]) groups[key] = { label, icon, locations: {} }
      // Deduplicate locations within this item's JSON array (same location can appear
      // many times — one per container/NPC instance — which would duplicate item names)
      const uniqueLocs = [...new Set(entries.map(e => resolveLocationEntry(e, key).label))]
      uniqueLocs.forEach(loc => {
        if (!groups[key].locations[loc]) groups[key].locations[loc] = []
        groups[key].locations[loc].push(item.name)
      })
    })
  })
  return groups
}

// ── Wishlist grouping ────────────────────────────────────────────────────────

// Top-level groups that merge related DB categories
export const WISHLIST_GROUPS = [
  { key: 'armour',          label: 'Armour',          categories: ['armour', 'helmet'] },
  { key: 'weapons',         label: 'Weapons',         categories: ['weapon'] },
  { key: 'clothing',        label: 'Clothing',        categories: ['clothing'] },
  { key: 'attachments',     label: 'Attachments',     categories: ['attachment'] },
  { key: 'consumables',     label: 'Consumables',     categories: ['consumable'] },
  { key: 'utility',         label: 'Utility',         categories: ['utility'] },
  { key: 'ship_components', label: 'Ship Components', categories: ['ship_component', 'missile'] },
  { key: 'other',           label: 'Other',           categories: ['harvestable', 'prop', 'unknown'] },
]

// Friendly sub-group labels derived from type/sub_type
const TYPE_LABELS = {
  Char_Armor_Arms: 'Arms', Char_Armor_Helmet: 'Helmets', Char_Armor_Torso: 'Core',
  Char_Armor_Legs: 'Legs', Char_Armor_Backpack: 'Backpacks', Char_Armor_Undersuit: 'Undersuits',
  Char_Clothing_Hat: 'Hats', Char_Clothing_Torso_0: 'Shirts', Char_Clothing_Torso_1: 'Jackets',
  Char_Clothing_Legs: 'Pants', Char_Clothing_Feet: 'Boots', Char_Clothing_Hands: 'Gloves',
  Char_Clothing_Backpack: 'Backpacks', Char_Accessory_Eyes: 'Eyewear',
  Cooler: 'Coolers', PowerPlant: 'Power Plants', QuantumDrive: 'Quantum Drives',
  Shield: 'Shields', WeaponGun: 'Ship Weapons', MiningModifier: 'Mining Lasers',
  MissileLauncher: 'Missile Racks', Turret: 'Turrets', Missile: 'Missiles',
  Drink: 'Drinks', Food: 'Food',
  FPS_Consumable: 'Medical', Gadget: 'Gadgets', RemovableChip: 'Data Chips',
  Misc: 'Miscellaneous',
}

// Weapons use sub_type for grouping
const WEAPON_SUB_LABELS = {
  Small: 'Pistols', Medium: 'Rifles', Large: 'Heavy Weapons',
  Knife: 'Melee', Grenade: 'Grenades', Gadget: 'Gadgets',
}
const ATTACHMENT_SUB_LABELS = {
  Barrel: 'Barrels', IronSight: 'Sights', Magazine: 'Magazines',
  BottomAttachment: 'Underbarrel', Utility: 'Utility', Missile: 'Missiles',
}

// Get a friendly sub-group label for an item
export function getSubGroupKey(item) {
  if (item.category === 'weapon') return WEAPON_SUB_LABELS[item.sub_type] || item.sub_type || 'Other'
  if (item.category === 'attachment') return ATTACHMENT_SUB_LABELS[item.sub_type] || item.sub_type || 'Other'
  return TYPE_LABELS[item.type] || item.type || 'Other'
}

// Group items into top-level groups > sub-groups
// Returns: [{ key, label, count, subGroups: [{ label, items }] }]
export function groupWishlistItems(items) {
  if (!items?.length) return []
  const catSet = new Set(items.map(i => i.category))
  return WISHLIST_GROUPS
    .filter(g => g.categories.some(c => catSet.has(c)))
    .map(g => {
      const groupItems = items.filter(i => g.categories.includes(i.category))
      // Build sub-groups
      const subMap = new Map()
      for (const item of groupItems) {
        const subLabel = getSubGroupKey(item)
        if (!subMap.has(subLabel)) subMap.set(subLabel, [])
        subMap.get(subLabel).push(item)
      }
      const subGroups = [...subMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, items]) => ({ label, items }))
      return { key: g.key, label: g.label, count: groupItems.length, subGroups }
    })
}

// ── Primary source (best place to find an item) ─────────────────────────────
// Priority: shops (guaranteed purchase) > highest-probability container/NPC/corpse > contracts
export function getPrimarySource(item) {
  const parse = (str) => { try { return JSON.parse(str) || [] } catch { return [] } }

  // Shops are guaranteed — pick cheapest
  const shops = parse(item.shops_json)
  if (shops.length) {
    const best = shops.reduce((a, b) => {
      const pa = a.buyPrice ?? Infinity
      const pb = b.buyPrice ?? Infinity
      return pa <= pb ? a : b
    })
    const entry = resolveLocationEntry(best, 'shops')
    return { label: entry.label, type: 'shop', detail: entry.detail }
  }

  // Containers / NPCs / corpses — pick highest probability
  let best = null
  let bestProb = -1
  for (const [key, jsonKey] of [['containers', 'containers_json'], ['npcs', 'npcs_json'], ['corpses', 'corpses_json']]) {
    const entries = parse(item[jsonKey])
    for (const e of entries) {
      const resolved = resolveLocationEntry(e, key)
      const prob = resolved.probability ?? 0
      if (prob > bestProb || (!best && prob === 0)) {
        best = { label: resolved.label, type: key, detail: prob > 0 ? `${Math.round(prob * 100)}%` : null }
        bestProb = prob
      }
    }
  }
  if (best) return best

  // Contracts fallback
  const contracts = parse(item.contracts_json)
  if (contracts.length) {
    const entry = resolveLocationEntry(contracts[0], 'contracts')
    return { label: entry.label, type: 'contract', detail: null }
  }

  return null
}

// Build location-grouped view: { locationLabel: { sourceType, items[] } }
export function groupWishlistByLocation(items) {
  if (!items?.length) return []
  const locMap = new Map() // locationLabel → { sourceType, sourceLabel, sourceIcon, itemNames: Set }
  const parseJson = (str) => { try { return JSON.parse(str) || [] } catch { return [] } }

  for (const item of items) {
    for (const { key, label, jsonKey, icon } of SOURCE_DEFS) {
      const entries = parseJson(item[jsonKey])
      if (!entries.length) continue
      const uniqueLocs = [...new Set(entries.map(e => resolveLocationEntry(e, key).label))]
      for (const loc of uniqueLocs) {
        const mapKey = `${key}::${loc}`
        if (!locMap.has(mapKey)) {
          locMap.set(mapKey, { location: loc, sourceType: key, sourceLabel: label, sourceIcon: icon, items: [] })
        }
        locMap.get(mapKey).items.push(item)
      }
    }
  }

  // Sort by location name, group by source type
  return [...locMap.values()].sort((a, b) => a.location.localeCompare(b.location))
}
