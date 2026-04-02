import React, { useMemo, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { MapPin, ArrowLeft, Store, ChevronDown, ChevronRight } from 'lucide-react'
import { useLootLocationDetail, useLocationShops } from '../hooks/useAPI'
import { friendlyLocation, friendlyFaction, getLocationGroup, LOCATION_SLUG_MAP } from '../lib/lootLocations'
import { friendlyShopName } from '../lib/shopNames'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'
import {
  RARITY_STYLES, CATEGORY_LABELS, CATEGORY_BADGE_STYLES, CATEGORY_ORDER,
} from '../lib/lootDisplay'

// ── Location group badges ──────────────────────────────────────────────────
const GROUP_LABELS = {
  named:     'Named Location',
  cave:      'Cave',
  outpost:   'Outpost',
  dc:        'Distribution Centre',
  facility:  'Facility',
  contested: 'Contested Zone',
  station:   'Station',
  derelict:  'Derelict',
  generic:   'Generic',
}

// ── Shop type badges ─────────────────────────────────────────────────────────
const SHOP_TYPE_STYLES = {
  admin:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  weapon:   'bg-red-500/10 text-red-400 border-red-500/30',
  armor:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  clothing: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  food:     'bg-green-500/10 text-green-400 border-green-500/30',
  ship:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  default:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

function ShopCard({ shop }) {
  const [expanded, setExpanded] = useState(false)
  const typeStyle = SHOP_TYPE_STYLES[shop.shop_type] || SHOP_TYPE_STYLES.default
  const displayName = shop.displayName || shop.name

  return (
    <div className="border border-sc-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/3 transition-colors text-left"
      >
        <Store className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-200 flex-1 min-w-0 truncate">{displayName}</span>
        {shop.shop_type && (
          <span className={`text-[10px] font-display uppercase px-1.5 py-0.5 rounded border shrink-0 ${typeStyle}`}>
            {shop.shop_type}
          </span>
        )}
        <span className="text-[10px] font-mono text-gray-500 shrink-0">{shop.items.length} items</span>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
      </button>
      {expanded && shop.items.length > 0 && (
        <div className="border-t border-sc-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-display uppercase tracking-wide text-gray-500 border-b border-sc-border">
                <th className="text-left px-3 py-1.5">Item</th>
                <th className="text-right px-3 py-1.5 w-20">Buy</th>
                <th className="text-right px-3 py-1.5 w-20">Sell</th>
              </tr>
            </thead>
            <tbody>
              {shop.items.map((item, i) => (
                <tr key={item.item_uuid || i} className="border-b border-sc-border/50 hover:bg-white/3">
                  <td className="px-3 py-1.5 text-gray-300">{item.resolved_name || item.item_name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                    {item.buy_price != null ? `${Math.round(item.buy_price).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                    {item.sell_price != null ? `${Math.round(item.sell_price).toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Detail page ────────────────────────────────────────────────────────────
export default function POIDetail() {
  const { type, slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const activeCategory = searchParams.get('cat') || 'all'

  const setSearch = (value) => setSearchParams(prev => {
    if (value) prev.set('q', value); else prev.delete('q')
    return prev
  }, { replace: true })

  const setActiveCategory = (cat) => setSearchParams(prev => {
    if (cat && cat !== 'all') prev.set('cat', cat); else prev.delete('cat')
    return prev
  }, { replace: true })

  // Resolve the API type param from the URL structure
  // /poi/:slug → container, /poi/shop/:slug → shop, /poi/npc/:slug → npc
  const apiType = type === 'shop' ? 'shop' : type === 'npc' ? 'npc' : 'container'
  const decodedSlug = slug ? decodeURIComponent(slug) : ''

  const { data, loading, error, refetch } = useLootLocationDetail(apiType, decodedSlug)
  const items = data?.items || []

  // Shop data bridge: map container slug → star_map_locations slug
  const locationSlug = apiType === 'container' ? LOCATION_SLUG_MAP[decodedSlug] : null
  const { data: shopData } = useLocationShops(locationSlug)

  // Resolve display names
  const locationName = apiType === 'shop'
    ? friendlyShopName(decodedSlug)
    : apiType === 'npc'
    ? friendlyFaction(decodedSlug)
    : friendlyLocation(decodedSlug)

  const groupBadge = apiType === 'shop'
    ? 'Shop'
    : apiType === 'npc'
    ? 'NPC Faction'
    : GROUP_LABELS[getLocationGroup(decodedSlug)] || getLocationGroup(decodedSlug)

  // Group items by category
  const categorizedItems = useMemo(() => {
    let filtered = items
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.type && i.type.toLowerCase().includes(q)) ||
        (i.sub_type && i.sub_type.toLowerCase().includes(q))
      )
    }
    if (activeCategory !== 'all') {
      filtered = filtered.filter(i => i.category === activeCategory)
    }

    const groups = new Map()
    for (const item of filtered) {
      const cat = item.category || 'unknown'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat).push(item)
    }

    // Sort groups by category order, items by name within each group
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    for (const [, catItems] of sorted) {
      catItems.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [items, search, activeCategory])

  // Category counts for filter chips
  const categoryCounts = useMemo(() => {
    const counts = { all: items.length }
    for (const item of items) {
      const cat = item.category || 'unknown'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [items])

  const filteredCount = categorizedItems.reduce((sum, [, catItems]) => sum + catItems.length, 0)

  if (loading) return <LoadingState message="Loading location..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  if (!slug || items.length === 0) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <Link to="/poi" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Locations
        </Link>
        <EmptyState
          message={`No items found for this location.`}
          icon={MapPin}
          large
          actionLink={{ to: '/poi', label: 'Browse all locations' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Link to="/poi" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Locations
      </Link>

      <PageHeader
        title={locationName}
        subtitle={`${items.length} items available`}
        actions={
          <span className="text-[10px] font-display uppercase tracking-wide px-2 py-1 rounded bg-sc-accent/10 text-sc-accent border border-sc-accent/30">
            {groupBadge}
          </span>
        }
      />

      {/* Shop section — only for locations with mapped shops */}
      {shopData?.shops?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-display uppercase tracking-widest text-gray-500 pl-1">
            Shops at this location ({shopData.shops.length})
          </h3>
          <div className="space-y-2">
            {shopData.shops.map(shop => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </div>
      )}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search items at this location..."
        className="max-w-md"
      />

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-2.5 py-1 rounded text-[10px] font-display uppercase tracking-wide transition-colors ${
            activeCategory === 'all'
              ? 'bg-sc-accent/10 text-sc-accent border border-sc-accent/30'
              : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:bg-white/5'
          }`}
        >
          All ({categoryCounts.all || 0})
        </button>
        {CATEGORY_ORDER.filter(cat => categoryCounts[cat]).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded text-[10px] font-display uppercase tracking-wide transition-colors ${
              activeCategory === cat
                ? 'bg-sc-accent/10 text-sc-accent border border-sc-accent/30'
                : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:bg-white/5'
            }`}
          >
            {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      <span className="text-xs font-mono text-gray-500">{filteredCount} results</span>

      {/* Items grouped by category */}
      <div className="space-y-6">
        {categorizedItems.map(([category, catItems]) => (
          <div key={category}>
            <h3 className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-3 pl-1">
              {CATEGORY_LABELS[category] || category} ({catItems.length})
            </h3>
            <div className="space-y-0">
              {catItems.map(item => (
                <Link
                  key={item.uuid}
                  to={`/loot/${item.uuid}`}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-sc-border hover:bg-white/3 transition-colors"
                >
                  <span className={`text-[10px] font-display uppercase px-1.5 py-0.5 rounded shrink-0 w-20 text-center ${
                    CATEGORY_BADGE_STYLES[item.category] || CATEGORY_BADGE_STYLES.unknown
                  }`}>
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  <span className="text-xs text-gray-200 flex-1 min-w-0 truncate">{item.name}</span>
                  {item.sub_type && (
                    <span className="text-[10px] font-mono text-gray-500 shrink-0">{item.sub_type}</span>
                  )}
                  {item.rarity && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                      (RARITY_STYLES[item.rarity] || RARITY_STYLES.Common).badge
                    }`}>
                      {item.rarity}
                    </span>
                  )}
                  {item.perContainer != null && (
                    <span className="text-[10px] font-mono text-gray-600 shrink-0">
                      {(item.perContainer * 100).toFixed(1)}%
                    </span>
                  )}
                  {item.buyPrice != null && (
                    <span className="text-[10px] font-mono text-gray-500 shrink-0">
                      {Math.round(item.buyPrice).toLocaleString()} aUEC
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
