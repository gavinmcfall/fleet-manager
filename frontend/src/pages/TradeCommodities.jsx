import React, { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { TrendingUp, MapPin, ArrowUpRight, ArrowDownRight, Package, AlertTriangle, X, Info } from 'lucide-react'

// ── Category badge styles ──────────────────────────────────────────────────
const CATEGORY_BADGE = {
  metals:    'bg-gray-700/60 text-gray-300 border border-gray-600/50',
  minerals:  'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  gas:       'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50',
  vice:      'bg-purple-900/50 text-purple-300 border border-purple-700/50',
  food:      'bg-green-900/50 text-green-300 border border-green-700/50',
  medical:   'bg-red-900/50 text-red-300 border border-red-700/50',
  scrap:     'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  halogen:   'bg-teal-900/50 text-teal-300 border border-teal-700/50',
  agricium:  'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  unknown:   'bg-gray-700/60 text-gray-400 border border-gray-600/50',
}

function categoryBadgeClass(category) {
  return CATEGORY_BADGE[category] || CATEGORY_BADGE.unknown
}

function formatPrice(price) {
  if (price == null || price === 0) return null
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatInventory(val) {
  if (val == null) return '--'
  return Math.round(val).toLocaleString()
}

// ── Location → region mapping ──────────────────────────────────────────────
const LOCATION_REGION = {
  'Area18':               'Stanton — ArcCorp',
  'Lorville':             'Stanton — Hurston',
  'New Babbage':          'Stanton — microTech',
  'Grim HEX':             'Stanton — Crusader',
  'Levski':               'Nyx — Delamar',
  'Port Olisar (Removed)':'Stanton — Crusader (Removed)',
  'All Rest Stops':       'Stanton — Various',
}

function getRegion(locationLabel) {
  return LOCATION_REGION[locationLabel] || locationLabel || 'Unknown'
}

// ── Commodity detail panel ─────────────────────────────────────────────────
function CommodityPanel({ commodity, onClose }) {
  const listings = commodity.listings || []
  const buyListings = listings.filter(l => l.buy_price > 0)
  const sellListings = listings.filter(l => l.sell_price > 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-sc-dark border-l border-sc-border overflow-y-auto animate-fade-in-up">
        {/* Header */}
        <div className="sticky top-0 bg-sc-dark/95 backdrop-blur border-b border-sc-border p-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-white text-sm leading-tight">
              {commodity.name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded ${categoryBadgeClass(commodity.category)}`}>
                {commodity.category}
              </span>
              {commodity.type_name && (
                <span className="text-[10px] font-mono text-gray-500">
                  {commodity.type_name}
                </span>
              )}
              {commodity.is_raw === 1 && (
                <span className="text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/50">
                  Raw
                </span>
              )}
            </div>
            {commodity.description && (
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                {commodity.description}
              </p>
            )}
            {commodity.scu_per_unit && (
              <p className="text-[10px] font-mono text-gray-500 mt-1">
                {commodity.scu_per_unit} SCU/unit
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 p-1"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Dynamic pricing notice */}
          <div className="flex items-start gap-2 p-3 rounded bg-amber-900/20 border border-amber-700/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/80 leading-relaxed">
              Prices and stock levels shown are <span className="text-amber-300 font-semibold">base defaults</span> from game data.
              In-game values fluctuate dynamically based on supply, demand, and player activity.
            </div>
          </div>

          {/* Buy locations */}
          {buyListings.length > 0 && (
            <div>
              <h3 className="text-xs font-display uppercase tracking-widest text-green-400 mb-2 flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                Buy From ({buyListings.length} locations)
              </h3>
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-display uppercase tracking-widest text-gray-500">
                  <span className="flex-1">Location</span>
                  <span className="w-24 text-right">Price</span>
                  <span className="w-20 text-right">Stock</span>
                  <span className="w-20 text-right">Max</span>
                </div>
                {buyListings.sort((a, b) => a.buy_price - b.buy_price).map((l, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/[0.03] transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-200 block truncate">
                        {l.location_label || l.shop_display_name}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 block truncate">
                        {getRegion(l.location_label)}
                      </span>
                    </div>
                    <span className="w-24 text-right text-xs font-mono text-green-400 shrink-0">
                      {formatPrice(l.buy_price)} aUEC
                    </span>
                    <span className="w-20 text-right text-xs font-mono text-gray-400 shrink-0">
                      {formatInventory(l.base_inventory)}
                    </span>
                    <span className="w-20 text-right text-xs font-mono text-gray-500 shrink-0">
                      {formatInventory(l.max_inventory)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sell locations */}
          {sellListings.length > 0 && (
            <div>
              <h3 className="text-xs font-display uppercase tracking-widest text-sc-melt mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Sell To ({sellListings.length} locations)
              </h3>
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-display uppercase tracking-widest text-gray-500">
                  <span className="flex-1">Location</span>
                  <span className="w-24 text-right">Price</span>
                  <span className="w-20 text-right">Stock</span>
                  <span className="w-20 text-right">Max</span>
                </div>
                {sellListings.sort((a, b) => b.sell_price - a.sell_price).map((l, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/[0.03] transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-200 block truncate">
                        {l.location_label || l.shop_display_name}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 block truncate">
                        {getRegion(l.location_label)}
                      </span>
                    </div>
                    <span className="w-24 text-right text-xs font-mono text-sc-melt shrink-0">
                      {formatPrice(l.sell_price)} aUEC
                    </span>
                    <span className="w-20 text-right text-xs font-mono text-gray-400 shrink-0">
                      {formatInventory(l.base_inventory)}
                    </span>
                    <span className="w-20 text-right text-xs font-mono text-gray-500 shrink-0">
                      {formatInventory(l.max_inventory)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listings.length === 0 && (
            <div className="text-center py-8 text-gray-500 font-mono text-sm">
              Not currently sold at any admin shop.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Commodity card ──────────────────────────────────────────────────────────
function CommodityCard({ commodity, onClick }) {
  const listings = commodity.listings || []
  const buyCount = listings.filter(l => l.buy_price > 0).length
  const sellCount = listings.filter(l => l.sell_price > 0).length

  // Best buy (lowest) and best sell (highest) prices
  const bestBuy = listings.reduce((min, l) => l.buy_price > 0 && (min === null || l.buy_price < min) ? l.buy_price : min, null)
  const bestSell = listings.reduce((max, l) => l.sell_price > 0 && (max === null || l.sell_price > max) ? l.sell_price : max, null)

  return (
    <button
      onClick={() => onClick(commodity)}
      className="panel p-4 text-left hover:border-sc-border/80 transition-all duration-150 w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight">
          {commodity.name}
        </h3>
        {commodity.is_raw === 1 && (
          <span className="text-[10px] font-display uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/50 shrink-0">
            Raw
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded ${categoryBadgeClass(commodity.category)}`}>
          {commodity.category}
        </span>
        {commodity.type_name && (
          <span className="text-[10px] font-mono text-gray-500">
            {commodity.type_name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        {bestBuy !== null ? (
          <div className="flex items-center gap-1 text-green-400">
            <ArrowDownRight className="w-3 h-3" />
            <span>{formatPrice(bestBuy)}</span>
            <span className="text-gray-600 text-[10px]">({buyCount})</span>
          </div>
        ) : (
          <span className="text-gray-600">No buy</span>
        )}
        {bestSell !== null ? (
          <div className="flex items-center gap-1 text-sc-melt">
            <ArrowUpRight className="w-3 h-3" />
            <span>{formatPrice(bestSell)}</span>
            <span className="text-gray-600 text-[10px]">({sellCount})</span>
          </div>
        ) : (
          <span className="text-gray-600">No sell</span>
        )}
      </div>

      {commodity.scu_per_unit && (
        <div className="mt-2 text-[10px] font-mono text-gray-500">
          {commodity.scu_per_unit} SCU/unit
        </div>
      )}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
const CATEGORY_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'metals',   label: 'Metals' },
  { key: 'minerals', label: 'Minerals' },
  { key: 'gas',      label: 'Gas' },
  { key: 'food',     label: 'Food' },
  { key: 'vice',     label: 'Vice' },
  { key: 'medical',  label: 'Medical' },
  { key: 'scrap',    label: 'Scrap' },
  { key: 'halogen',  label: 'Halogen' },
]

const INITIAL_COUNT = 30

export default function TradeCommodities() {
  const { data, loading, error, refetch } = useAPI('/gamedata/trade')
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const categoryTab = searchParams.get('cat') || 'all'
  const locationFilter = searchParams.get('loc') || 'all'
  const tradeFilter = searchParams.get('trade') || 'all'
  const setSearch = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set('q', val)
      else next.delete('q')
      return next
    }, { replace: true })
  }, [setSearchParams])
  const setCategoryTab = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val === 'all') next.delete('cat')
      else next.set('cat', val)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const setLocationFilter = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val === 'all') next.delete('loc')
      else next.set('loc', val)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const setTradeFilter = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val === 'all') next.delete('trade')
      else next.set('trade', val)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const [selected, setSelected] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const commodities = data?.commodities
  const locations = data?.locations || []

  // Build category list from actual data
  const categories = useMemo(() => {
    if (!commodities) return []
    return [...new Set(commodities.map(c => c.category).filter(Boolean))].sort()
  }, [commodities])

  // Build dynamic tabs from data
  const tabs = useMemo(() => {
    const dynamicTabs = CATEGORY_TABS.filter(t => t.key === 'all' || categories.includes(t.key))
    // Add any categories from data not in the predefined list
    for (const cat of categories) {
      if (!CATEGORY_TABS.some(t => t.key === cat)) {
        dynamicTabs.push({ key: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) })
      }
    }
    return dynamicTabs
  }, [categories])

  const filtered = useMemo(() => {
    if (!commodities) return []
    let items = commodities

    // Category filter
    if (categoryTab !== 'all') {
      items = items.filter(c => c.category === categoryTab)
    }

    // Location filter — only show commodities traded at a specific location
    if (locationFilter !== 'all') {
      items = items.filter(c =>
        c.listings?.some(l => l.location_label === locationFilter)
      )
    }

    // Trade direction filter
    if (tradeFilter === 'buy') {
      items = items.filter(c => c.listings?.some(l => l.buy_price > 0))
    } else if (tradeFilter === 'sell') {
      items = items.filter(c => c.listings?.some(l => l.sell_price > 0))
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.type_name && c.type_name.toLowerCase().includes(q)) ||
        (c.subtype_name && c.subtype_name.toLowerCase().includes(q))
      )
    }

    return items
  }, [commodities, categoryTab, locationFilter, tradeFilter, search])

  // Reset pagination when filters change
  React.useEffect(() => { setShowAll(false) }, [categoryTab, locationFilter, tradeFilter, search])

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT)
  const hasMore = !showAll && filtered.length > INITIAL_COUNT

  // Stats
  const tradedCount = useMemo(() => {
    if (!commodities) return 0
    return commodities.filter(c => c.listings?.length > 0).length
  }, [commodities])

  if (loading) return <LoadingState message="Loading trade commodities..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="TRADE COMMODITIES"
        subtitle={`${tradedCount} commodities traded across ${locations.length} locations`}
        actions={<TrendingUp className="w-5 h-5 text-gray-500" />}
      />

      {/* Dynamic pricing notice */}
      <div className="flex items-start gap-2 p-3 rounded bg-gray-800/50 border border-gray-700/50">
        <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-400 leading-relaxed">
          Prices and stock levels are <span className="text-gray-300 font-semibold">base defaults</span> from game data files.
          In-game values are <span className="text-gray-300 font-semibold">dynamic</span> — prices shift based on supply/demand and stock replenishes over time.
          Same commodity, different shops: different base prices (e.g., Agricium sells for 25.45 aUEC at Grim HEX but 25.34 at Levski).
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCategoryTab(tab.key)}
            className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
              categoryTab === tab.key
                ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
                : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trade direction filter */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All' },
          { key: 'buy', label: 'Can Buy' },
          { key: 'sell', label: 'Can Sell' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setTradeFilter(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
              tradeFilter === f.key
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Location filter */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setLocationFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
              locationFilter === 'all'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
            }`}
          >
            All Locations
          </button>
          {locations.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-3 py-1.5 rounded text-xs font-display tracking-wide transition-all duration-150 flex items-center gap-1 ${
                locationFilter === loc
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : loc.includes('(Removed)')
                    ? 'text-gray-600 line-through border border-sc-border hover:border-gray-600'
                    : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
              }`}
            >
              <MapPin className="w-3 h-3" />
              {loc}
            </button>
          ))}
        </div>
      )}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search commodities..."
        className="max-w-md"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">
          {filtered.length} commodities
          {filtered.length !== commodities?.length ? ` of ${commodities.length} total` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((commodity) => (
          <CommodityCard key={commodity.id} commodity={commodity} onClick={setSelected} />
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-2">
          <button onClick={() => setShowAll(true)} className="btn-secondary text-xs px-6">
            Show all ({filtered.length - INITIAL_COUNT} more)
          </button>
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">
          No commodities found.
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <CommodityPanel commodity={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
