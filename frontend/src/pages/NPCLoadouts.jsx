import React, { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useNPCLoadouts, useNPCFactionLoadouts,
  useLootCollection, useLootWishlist,
  setLootCollectionQuantity, toggleLootWishlist,
} from '../hooks/useAPI'
import { useSession } from '../lib/auth-client'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { Users, ChevronDown, ChevronRight, ArrowLeft, Shield, Shirt, Crosshair, Wrench, Bug, Swords } from 'lucide-react'
import { toWords } from '../lib/lootLocations'
import DetailPanel from './LootDB/DetailPanel'

// Tags for cosmetic/body items that aren't real gear — filter from display
const HIDDEN_TAGS = new Set([
  'Char_Body', 'Char_Body(Male)', 'Char_Body(Female)',
  'Char_Accessory_Head', 'Char_Accessory_Head(Vanduul)',
  'Char_Accessory_Eyes',
])
// Item name patterns for body parts and system items that aren't real gear
const HIDDEN_ITEM_PATTERNS = /^(Head_|Hair_|m_body_|f_body_|PU_Protos_|PU_Head_|collector_body|collector_head|collector_teeth|collector_eyes|MobiGlas|PersonalMobiGlas|Tattoo_Var_|Color_Var_|Skin_Var_|Shared_Brows|FPS_Default|MineableRock_|harvestable_|invisible_)/i

function isHiddenItem(item) {
  if (item.tag && HIDDEN_TAGS.has(item.tag)) return true
  if (HIDDEN_ITEM_PATTERNS.test(item.item_name)) return true
  return false
}

// Fallback manufacturer names for prefixes that don't exactly match manufacturer codes
const PREFIX_OVERRIDES = {
  behr: 'Behring',
  srvl: 'Survival',
  sc: 'Star Citizen',
  female: '',
  pu: '',
}

/** Build a friendly display name for items without a loot_map match */
function buildFallbackName(item) {
  const prefix = item.item_name.split('_')[0].toLowerCase()
  const mfr = item.manufacturer_name || PREFIX_OVERRIDES[prefix]
  let name = item.item_name

  // Strip known non-gear prefixes (faction/role labels, not manufacturers)
  if (/^(outlaw|slaver|clothing|female|pu)_/i.test(name)) {
    name = name.replace(/^(outlaw|slaver|clothing|female|pu)_/i, '')
  }
  // Strip manufacturer prefix if we resolved a manufacturer name
  else if (mfr) {
    if (prefix.length <= 5) name = name.slice(prefix.length + 1)
  }

  // Clean up with toWords, then capitalize
  let display = toWords(name)
  // Collapse trailing numeric segments: "undersuit 01 01 01" → "Undersuit (Variant 01)"
  // SC item pattern: type_series_variant_color — only last segment is meaningful color variant
  display = display.replace(/(\s\d{2}){2,}$/, (m) => {
    const parts = m.trim().split(/\s+/)
    const last = parts[parts.length - 1]
    return last === '01' ? '' : ` (Variant ${last})`
  })
  display = display.replace(/\b[a-z]/g, c => c.toUpperCase())

  // Prefix with manufacturer if available
  if (mfr && mfr !== 'Unknown' && mfr !== '') {
    display = `${mfr} ${display}`
  }

  return display
}

// ── Loadout name formatter ──────────────────────────────────────────────────
const DIFFICULTY_TIERS = {
  '01_tutorial': 'Tutorial',
  '02_veryeasy': 'Very Easy',
  '03_easy': 'Easy',
  '04_medium': 'Medium',
  '05_mediumrare': 'Medium-Rare',
  '06_hard': 'Hard',
  '06_wellDone': 'Well Done',
  '06_welldone': 'Well Done',
  '07_hard': 'Hard',
  '07_veryhard': 'Very Hard',
  '08_veryhard': 'Very Hard',
  '09_super': 'Super',
  '10_endgame': 'Endgame',
  '11_endgame_rare': 'Endgame Rare',
}

function formatLoadoutName(raw) {
  // Check difficulty tier pattern: "02_veryeasy_01" or "02_veryeasy_01_weps"
  for (const [prefix, label] of Object.entries(DIFFICULTY_TIERS)) {
    if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rest = raw.slice(prefix.length)
      const variantMatch = rest.match(/^_(\d+)(?:_weps(?:_(\d+))?)?$/)
      if (variantMatch) {
        const variant = variantMatch[1]
        const wepVariant = variantMatch[2]
        if (rest.includes('_weps')) {
          return `${label} #${variant} — Weapons${wepVariant ? ` (${wepVariant})` : ''}`
        }
        return `${label} #${variant}`
      }
      return `${label} ${toWords(rest.replace(/^_/, ''))}`
    }
  }
  // Named patterns: "890Jump_Chef_01" → "890 Jump Chef #01"
  // "9tails_new_light_01" → "9 Tails New Light #01"
  // "AdvocacyAgent_01" → "Advocacy Agent #01"
  // "m_adv_AgentFlightsuit" → "Adv Agent Flightsuit (M)"
  // Gender prefix
  let name = raw
  let genderSuffix = ''
  if (/^[mf]_/.test(name)) {
    genderSuffix = name[0] === 'm' ? ' (M)' : ' (F)'
    name = name.slice(2)
  }

  // Convert to words and clean up
  let display = toWords(name)

  // Pull trailing number as variant: "Agent 01" → "Agent #01"
  display = display.replace(/\s(\d{1,3})$/, ' #$1')

  // Capitalize first letter of each word
  display = display.replace(/\b[a-z]/g, c => c.toUpperCase())

  // Expand common abbreviations used in loadout identifiers
  const ABBREVIATIONS = {
    'Adv': 'Advocacy', 'Asd': 'ASD', 'Atc': 'ATC', 'Bhg': 'Bounty Hunter',
    'Cfp': 'CFP', 'Ccc': "CC's Conversions", 'Tdd': 'TDD',
    'Io': 'IO', 'Blacjac': 'BlacJac', '9Tails': 'Nine Tails',
    '9tails': 'Nine Tails', 'Newmedium': 'New Medium',
    'Weps': 'Weapons', 'Nohelmet': 'No Helmet', 'No Helmet': 'No Helmet',
    'Medunit': 'Med Unit', 'Offduty': 'Off-Duty',
    'Newbabbage': 'New Babbage', 'Grimhex': 'GrimHEX',
    'Roughready': 'Rough & Ready', 'Shatteredblade': 'Shattered Blade',
    'Vlk': 'Vanduul', 'Quasigrazer': 'Quasigrazer',
    'Uba': 'UBA', 'Rrs': 'RRS', 'Ksar': 'Kastak Arms',
    'Srvl': 'Survival', 'Qrt': 'Quirinus', 'Thp': 'Tehachapi',
    'Gys': 'Gyson', 'Grin': 'Greycat', 'Cds': 'CDS',
    'Drn': 'Derion', 'Rsi': 'RSI', 'Hdtc': 'Hardin Tactical',
    'Hdh': 'Habidash', 'Eld': 'Escar', 'Alb': 'Alejo Brothers',
    'Dmc': 'DMC', 'Scu': 'SCU', 'Gsb': 'GSB', 'Fio': 'Fiore',
    'Ninetails': 'Nine Tails', 'Pyrolight': 'Pyro Light',
    'Firerat': 'Fire Rat', 'Druglab': 'Drug Lab',
    'Fleetweek': 'Fleet Week', 'Shokeeper': 'Shopkeeper',
    'Shopkeep': 'Shopkeeper',
  }

  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    display = display.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full)
  }

  return display + genderSuffix
}

const CATEGORY_ICONS = {
  armor: Shield,
  clothing: Shirt,
  weapon: Crosshair,
  utility: Wrench,
  creature: Bug,
  vanduul: Swords,
  banu: Users,
  body: Users,
  unknown: Users,
}

const CATEGORY_COLORS = {
  armor: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  clothing: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  weapon: 'text-red-400 bg-red-400/10 border-red-400/30',
  utility: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  creature: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  vanduul: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  banu: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  body: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  unknown: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
}

const FACTION_COLORS = [
  'border-red-500/40 hover:border-red-500/60',
  'border-amber-500/40 hover:border-amber-500/60',
  'border-emerald-500/40 hover:border-emerald-500/60',
  'border-cyan-500/40 hover:border-cyan-500/60',
  'border-blue-500/40 hover:border-blue-500/60',
  'border-violet-500/40 hover:border-violet-500/60',
  'border-pink-500/40 hover:border-pink-500/60',
  'border-orange-500/40 hover:border-orange-500/60',
  'border-lime-500/40 hover:border-lime-500/60',
  'border-teal-500/40 hover:border-teal-500/60',
  'border-indigo-500/40 hover:border-indigo-500/60',
  'border-rose-500/40 hover:border-rose-500/60',
]

function FactionCard({ faction, index, onClick }) {
  const borderColor = FACTION_COLORS[index % FACTION_COLORS.length]
  return (
    <button
      onClick={onClick}
      className={`panel p-4 text-left transition-all duration-150 hover:bg-white/[0.04] border-l-2 ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display uppercase tracking-wider text-white">{faction.name}</h3>
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex gap-3 mt-2 text-xs text-gray-500 font-mono">
        <span>{faction.loadout_count} loadouts</span>
        <span>{faction.item_count} items</span>
      </div>
    </button>
  )
}

function LoadoutTree({ items, onSelectItem }) {
  if (!items || items.length === 0) return null

  // Filter out body/cosmetic items
  const gearItems = items.filter(i => !isHiddenItem(i))
  if (gearItems.length === 0) return null

  // Build tree from flat items using parent_port
  const portNames = new Set(gearItems.map(i => i.port_name))
  const topLevel = gearItems.filter(i => !i.parent_port || !portNames.has(i.parent_port))
  const childrenOf = (portName) => gearItems.filter(i => i.parent_port === portName)

  function renderItem(item, depth = 0) {
    const children = childrenOf(item.port_name)
    const displayName = item.resolved_name || buildFallbackName(item)
    const hasLootLink = item.loot_uuid

    return (
      <div key={`${item.port_name}-${item.item_name}`} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 py-1">
          <span className="text-[10px] font-mono text-gray-600 uppercase shrink-0 w-24 truncate" title={item.port_name}>
            {toWords(item.port_name.replace('Armor_', '').replace('wep_stocked_', 'Weapon '))}
          </span>
          {hasLootLink ? (
            <button
              onClick={() => onSelectItem(item.loot_uuid, item.loot_item_id)}
              className="text-xs font-mono text-sc-accent hover:underline truncate text-left"
              title={displayName}
            >
              {displayName}
            </button>
          ) : (
            <span className="text-xs font-mono text-gray-500 truncate" title={item.item_name}>
              Unknown <span className="text-[10px] text-gray-600">({buildFallbackName(item)})</span>
            </span>
          )}
          {item.tag && (
            <span className="text-[9px] font-mono text-gray-600 shrink-0">
              {toWords(item.tag.replace('Char_Armor_', '').replace('Char_', '').replace('WeaponPersonal', 'Weapon'))}
            </span>
          )}
        </div>
        {children.map(child => renderItem(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      {topLevel.map(item => renderItem(item))}
    </div>
  )
}

function LoadoutCard({ loadout, defaultExpanded, onSelectItem }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const categoryColor = CATEGORY_COLORS[loadout.category] || CATEGORY_COLORS.unknown
  const CategoryIcon = CATEGORY_ICONS[loadout.category] || Users

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <CategoryIcon className="w-4 h-4 text-gray-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-mono text-gray-200 truncate block">
            {formatLoadoutName(loadout.loadout_name)}
          </span>
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${categoryColor}`}>
          {loadout.category}
        </span>
        {loadout.sub_category && (
          <span className="text-[10px] font-mono text-gray-600 px-1.5 py-0.5 rounded bg-gray-800">
            {loadout.sub_category}
          </span>
        )}
        <span className="text-[10px] font-mono text-gray-600">
          {(loadout.items?.filter(i => !isHiddenItem(i))?.length || 0)} items
        </span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        )}
      </button>
      {expanded && loadout.items && (
        <div className="border-t border-sc-border/30 bg-sc-bg/50">
          <LoadoutTree items={loadout.items} onSelectItem={onSelectItem} />
        </div>
      )}
    </div>
  )
}

function FactionDetail({ factionCode, autoExpandLoadout, onBack, onSelectItem }) {
  const { data, loading, error, refetch } = useNPCFactionLoadouts(factionCode)

  if (loading) return <LoadingState message="Loading loadouts..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { faction, loadouts } = data

  // Filter out loadouts with zero visible items (e.g. body-only loadouts like "The Collector")
  const visibleLoadouts = loadouts.filter(loadout =>
    loadout.items?.some(i => !isHiddenItem(i))
  )

  // Group loadouts by category
  const grouped = {}
  for (const loadout of visibleLoadouts) {
    const cat = loadout.category || 'unknown'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(loadout)
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Factions
        </button>
        <h2 className="font-display font-bold text-xl tracking-wider text-white">{faction.name}</h2>
        <span className="text-xs font-mono text-gray-500">{visibleLoadouts.length} loadouts</span>
      </div>

      <div className="glow-line" />

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catLoadouts]) => (
        <div key={category}>
          <h3 className="text-xs font-display uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
            {React.createElement(CATEGORY_ICONS[category] || Users, { className: 'w-3.5 h-3.5' })}
            {category} ({catLoadouts.length})
          </h3>
          <div className="space-y-1">
            {catLoadouts.map((loadout) => (
              <LoadoutCard
                key={loadout.id}
                loadout={loadout}
                defaultExpanded={autoExpandLoadout ? loadout.loadout_name.toLowerCase() === autoExpandLoadout.toLowerCase() : false}
                onSelectItem={onSelectItem}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NPCLoadouts() {
  const { data: factions, loading, error, refetch } = useNPCLoadouts()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: session } = useSession()
  const isAuthed = !!session?.user

  const selectedFaction = searchParams.get('faction') || null
  const autoExpandLoadout = searchParams.get('loadout') || null

  // Detail panel state
  const [detailUuid, setDetailUuid] = useState(null)
  const [detailItemId, setDetailItemId] = useState(null)

  // Collection & wishlist (same pattern as LootDB)
  const { data: collectionIds, refetch: refetchCollection } = useLootCollection(isAuthed)
  const { data: wishlistItems, refetch: refetchWishlist } = useLootWishlist(isAuthed)

  const collected = useMemo(() => {
    if (!collectionIds) return new Map()
    return new Map(collectionIds.map(e => [e.loot_map_id, e.quantity]))
  }, [collectionIds])

  const wishlistIds = useMemo(
    () => new Set(wishlistItems?.map(i => i.id) ?? []),
    [wishlistItems]
  )

  const handleSelectItem = useCallback((uuid, itemId) => {
    setDetailUuid(uuid)
    setDetailItemId(itemId ?? null)
  }, [])

  const handleSetCollectionQty = useCallback(async (uuid, qty) => {
    try {
      await setLootCollectionQuantity(uuid, qty)
      refetchCollection()
    } catch { /* silent */ }
  }, [refetchCollection])

  const handleToggleWishlist = useCallback(async (uuid, isWishlisted) => {
    try {
      await toggleLootWishlist(uuid, isWishlisted)
      refetchWishlist()
    } catch { /* silent */ }
  }, [refetchWishlist])

  const setSelectedFaction = useCallback((code) => {
    if (code) {
      setSearchParams({ faction: code })
    } else {
      setSearchParams({})
    }
  }, [setSearchParams])

  if (loading) return <LoadingState message="Loading NPC factions..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <>
      {selectedFaction ? (
        <FactionDetail
          factionCode={selectedFaction}
          autoExpandLoadout={autoExpandLoadout}
          onBack={() => setSelectedFaction(null)}
          onSelectItem={handleSelectItem}
        />
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          <PageHeader
            title="NPC Loadouts"
            subtitle="What gear do NPCs wear and carry, organized by faction"
          />

          <div className="glow-line" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(factions || []).map((faction, i) => (
              <FactionCard
                key={faction.id}
                faction={faction}
                index={i}
                onClick={() => setSelectedFaction(faction.code)}
              />
            ))}
          </div>
        </div>
      )}

      {detailUuid && (
        <DetailPanel
          uuid={detailUuid}
          manufacturerName={null}
          collectionQty={collected.get(detailItemId) ?? 0}
          onSetCollectionQty={handleSetCollectionQty}
          wishlisted={wishlistIds.has(detailItemId)}
          onToggleWishlist={handleToggleWishlist}
          isAuthed={isAuthed}
          onClose={() => { setDetailUuid(null); setDetailItemId(null) }}
        />
      )}
    </>
  )
}
