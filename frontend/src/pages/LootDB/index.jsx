import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, ShoppingCart, Package, Swords, FileText, MapPin,
  LayoutGrid, List, X, ChevronRight, ChevronDown, Check, Plus, Bookmark, BookmarkPlus,
  ArrowUpDown, ChevronsUpDown, ChevronsDownUp,
} from 'lucide-react'
import {
  useLoot, useLootCollection, toggleLootCollection,
  useLootWishlist, toggleLootWishlist,
  setLootCollectionQuantity, setLootWishlistQuantity,
} from '../../hooks/useAPI'
import { useSession } from '../../lib/auth-client'
import useGameVersion from '../../hooks/useGameVersion'
import PageHeader from '../../components/PageHeader'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import SearchInput from '../../components/SearchInput'
import {
  RARITY_ORDER, RARITY_STYLES, rarityStyle,
  CATEGORY_LABELS, CATEGORY_BADGE_STYLES, effectiveCategory,
} from '../../lib/lootDisplay'

import {
  extractSetName, PAGE_SIZE_GRID, PAGE_SIZE_LIST,
  buildShoppingList, groupWishlistItems, groupWishlistByLocation, getPrimarySource, SOURCE_DEFS,
} from './lootHelpers'
import SourceIcons from './SourceIcons'
import CollectionStepper from './CollectionStepper'
import ItemCard from './ItemCard'
import DetailPanel from './DetailPanel'
import WishlistRow from './WishlistRow'

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LootDB() {
  const { uuid: routeUuid } = useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const isAuthed = !!session?.user

  const { activeCode } = useGameVersion()
  const { data: allItems, loading, error, refetch } = useLoot(activeCode)
  const { data: collectionIds, refetch: refetchCollection } = useLootCollection(isAuthed)
  const { data: wishlistItems, refetch: refetchWishlist } = useLootWishlist(isAuthed)

  // Map<loot_map_id, quantity> — backend now returns [{loot_map_id, quantity}]
  const collected = useMemo(() => {
    if (!collectionIds) return new Map()
    return new Map(collectionIds.map(e => [e.loot_map_id, e.quantity]))
  }, [collectionIds])

  // Map<loot_map_id, wishlist_quantity>
  const wishlistMap = useMemo(
    () => new Map(wishlistItems?.map(i => [i.id, i.wishlist_quantity ?? 1]) ?? []),
    [wishlistItems]
  )
  const wishlistIds = useMemo(
    () => new Set(wishlistItems?.map(i => i.id) ?? []),
    [wishlistItems]
  )

  const [actionError, setActionError] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_TABS = ['browse', 'collection', 'wishlist']
  const tabParam = searchParams.get('tab')
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'browse'
  const setActiveTab = useCallback((tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (tab === 'browse') next.delete('tab')
      else next.set('tab', tab)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const search = searchParams.get('q') || ''
  const category = searchParams.get('cat') || 'all'
  const brand = searchParams.get('brand') || null
  const setName = searchParams.get('set') || null
  const raritiesParam = searchParams.get('rarities') || ''
  const rarities = useMemo(() => raritiesParam ? new Set(raritiesParam.split(',')) : new Set(), [raritiesParam])
  const sourcesParam = searchParams.get('sources') || ''
  const sources = useMemo(() => sourcesParam ? new Set(sourcesParam.split(',')) : new Set(), [sourcesParam])
  const viewMode = searchParams.get('view') || 'grid'
  const sortBy = searchParams.get('sort') || 'name'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const setSearch = useCallback((value) => {
    setSearchParams(prev => {
      if (value) prev.set('q', value); else prev.delete('q')
      prev.delete('page')
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setCategory = useCallback((value) => {
    setSearchParams(prev => {
      if (value && value !== 'all') prev.set('cat', value); else prev.delete('cat')
      prev.delete('brand')
      prev.delete('set')
      prev.delete('page')
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setBrand = useCallback((value) => {
    setSearchParams(prev => {
      if (value) prev.set('brand', value); else prev.delete('brand')
      prev.delete('set')
      prev.delete('page')
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setSetName = useCallback((value) => {
    setSearchParams(prev => {
      if (value) prev.set('set', value); else prev.delete('set')
      prev.delete('page')
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setViewMode = useCallback((value) => {
    setSearchParams(prev => {
      if (value && value !== 'grid') prev.set('view', value); else prev.delete('view')
      prev.delete('page')
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setSortBy = useCallback((value) => {
    setSearchParams(prev => {
      if (value && value !== 'name') prev.set('sort', value); else prev.delete('sort')
      prev.delete('page')
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setPage = useCallback((updater) => {
    setSearchParams(prev => {
      const current = parseInt(prev.get('page') || '1', 10)
      const next = typeof updater === 'function' ? updater(current) : updater
      if (next <= 1) prev.delete('page'); else prev.set('page', String(next))
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const [detailUuid, setDetailUuid] = useState(routeUuid || null)

  // Auto-open detail panel when arriving via /loot/:uuid route
  useEffect(() => {
    if (routeUuid) setDetailUuid(routeUuid)
  }, [routeUuid])

  // Collection tab state
  const [collSearch, setCollSearch] = useState('')
  const [collCategory, setCollCategory] = useState('all')

  // Wishlist tab state
  const [wishSearch, setWishSearch] = useState('')
  const [wishViewMode, setWishViewMode] = useState('item') // 'item' | 'location'
  const [collapsedWishGroups, setCollapsedWishGroups] = useState(new Set())
  const [wishShopSort, setWishShopSort] = useState('count') // 'alpha' | 'count'
  const [wishShopSortDesc, setWishShopSortDesc] = useState(true)

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!allItems) return {}
    const counts = {}
    for (const item of allItems) {
      const cat = effectiveCategory(item)
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [allItems])

  // Collection tab — items the user has collected
  const collectedItems = useMemo(() => {
    if (!allItems) return []
    return allItems.filter(i => collected.has(i.id))
  }, [allItems, collected])

  // Per-category collection stats: { weapon: { total, collected }, ... }
  const collectionCategoryStats = useMemo(() => {
    if (!allItems) return {}
    const stats = {}
    for (const item of allItems) {
      const cat = effectiveCategory(item)
      if (!stats[cat]) stats[cat] = { total: 0, collected: 0 }
      stats[cat].total++
      if (collected.has(item.id)) stats[cat].collected++
    }
    return stats
  }, [allItems, collected])

  const filteredCollectedItems = useMemo(() => {
    let items = collectedItems
    if (collCategory !== 'all') items = items.filter(i => effectiveCategory(i) === collCategory)
    if (collSearch.trim()) {
      const q = collSearch.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q))
    }
    return items
  }, [collectedItems, collCategory, collSearch])

  // All categories present in data
  const categories = useMemo(() => {
    if (!allItems) return []
    const seen = new Set(allItems.map((i) => effectiveCategory(i)))
    const ordered = ['weapon', 'armour', 'helmet', 'clothing', 'attachment', 'consumable', 'harvestable', 'prop', 'utility', 'ship_weapon', 'ship_component', 'missile', 'unknown']
    return ordered.filter((c) => seen.has(c))
  }, [allItems])

  // Brand counts (scoped to current category)
  const brands = useMemo(() => {
    if (!allItems) return new Map()
    const map = new Map()
    const base = category !== 'all' ? allItems.filter(i => effectiveCategory(i) === category) : allItems
    for (const item of base) {
      if (item.manufacturer_name) {
        map.set(item.manufacturer_name, (map.get(item.manufacturer_name) || 0) + 1)
      }
    }
    return map
  }, [allItems, category])

  // Set/model name counts (scoped to current brand + category)
  const setNames = useMemo(() => {
    if (!allItems || !brand) return new Map()
    const map = new Map()
    let base = allItems.filter(i => i.manufacturer_name === brand)
    if (category !== 'all') base = base.filter(i => effectiveCategory(i) === category)
    for (const item of base) {
      const sn = extractSetName(item.name, item.manufacturer_name)
      if (sn) {
        map.set(sn, (map.get(sn) || 0) + 1)
      }
    }
    return map
  }, [allItems, brand, category])

  // Filtered items
  const filtered = useMemo(() => {
    if (!allItems) return []
    let items = allItems

    if (category !== 'all') {
      items = items.filter((i) => effectiveCategory(i) === category)
    }

    if (brand) {
      items = items.filter((i) => i.manufacturer_name === brand)
    }

    if (setName) {
      items = items.filter((i) => extractSetName(i.name, i.manufacturer_name) === setName)
    }

    if (rarities.size > 0) {
      items = items.filter((i) => rarities.has(i.rarity || 'Common'))
    }

    if (sources.size > 0) {
      items = items.filter((i) => {
        if (sources.has('shops')     && i.has_shops)     return true
        if (sources.has('containers') && i.has_containers) return true
        if (sources.has('npcs')      && i.has_npcs)     return true
        if (sources.has('contracts') && i.has_contracts) return true
        return false
      })
    }

    if (search.trim()) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
      items = items.filter((i) => {
        const name = i.name.toLowerCase()
        const type = i.type ? i.type.toLowerCase() : ''
        const subType = i.sub_type ? i.sub_type.toLowerCase() : ''
        const haystack = `${name} ${type} ${subType}`
        return tokens.every((t) => haystack.includes(t))
      })
    }

    // Sort
    const rarityRank = { Legendary: 0, Epic: 1, Rare: 2, Uncommon: 3, Common: 4, 'N/A': 5 }
    if (sortBy === 'rarity') {
      items.sort((a, b) => (rarityRank[a.rarity] ?? 5) - (rarityRank[b.rarity] ?? 5) || a.name.localeCompare(b.name))
    } else if (sortBy === 'category') {
      items.sort((a, b) => (effectiveCategory(a)).localeCompare(effectiveCategory(b)) || a.name.localeCompare(b.name))
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name))
    }

    return items
  }, [allItems, category, brand, setName, rarities, sources, search, sortBy])

  const pageSize = viewMode === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const collectionCount = collected.size  // unique items collected (not sum of quantities)
  const totalCount = allItems?.length || 0

  const shoppingList = useMemo(() => buildShoppingList(wishlistItems), [wishlistItems])

  // Wishlist: search-filtered items
  const filteredWishlistItems = useMemo(() => {
    if (!wishlistItems) return []
    if (!wishSearch.trim()) return wishlistItems
    const q = wishSearch.toLowerCase()
    return wishlistItems.filter(i => i.name.toLowerCase().includes(q))
  }, [wishlistItems, wishSearch])

  // Wishlist: grouped by category > sub-type (for "By Item" view)
  const wishlistGrouped = useMemo(
    () => groupWishlistItems(filteredWishlistItems),
    [filteredWishlistItems],
  )

  // Wishlist: grouped by location (for "By Location" view)
  const wishlistByLocation = useMemo(
    () => groupWishlistByLocation(filteredWishlistItems),
    [filteredWishlistItems],
  )

  // Primary source for each wishlist item (best place to find it)
  const primarySourceMap = useMemo(() => {
    const map = new Map()
    if (!filteredWishlistItems?.length) return map
    for (const item of filteredWishlistItems) {
      const src = getPrimarySource(item)
      if (src) map.set(item.id, src)
    }
    return map
  }, [filteredWishlistItems])

  // qty=0 removes from collection (backend handles via PATCH)
  const handleSetCollectionQty = useCallback(async (uuid, qty) => {
    try {
      await setLootCollectionQuantity(uuid, qty)
      refetchCollection()
    } catch (err) {
      setActionError('Collection update failed: ' + err.message)
      setTimeout(() => setActionError(null), 3000)
    }
  }, [refetchCollection])

  const handleToggleWishlist = useCallback(async (uuid, isWishlisted) => {
    try {
      await toggleLootWishlist(uuid, isWishlisted)
      refetchWishlist()
    } catch (err) {
      setActionError('Wishlist toggle failed: ' + err.message)
      setTimeout(() => setActionError(null), 3000)
    }
  }, [refetchWishlist])

  // qty=0 removes from wishlist (backend handles via PATCH)
  const handleSetWishlistQty = useCallback(async (uuid, qty) => {
    try {
      await setLootWishlistQuantity(uuid, qty)
      refetchWishlist()
    } catch (err) {
      setActionError('Wishlist update failed: ' + err.message)
      setTimeout(() => setActionError(null), 3000)
    }
  }, [refetchWishlist])

  const toggleRarity = (r) => {
    setSearchParams(prev => {
      const current = prev.get('rarities') ? new Set(prev.get('rarities').split(',')) : new Set()
      current.has(r) ? current.delete(r) : current.add(r)
      if (current.size > 0) prev.set('rarities', [...current].join(',')); else prev.delete('rarities')
      prev.delete('page')
      return prev
    }, { replace: true })
  }

  const toggleSource = (s) => {
    setSearchParams(prev => {
      const current = prev.get('sources') ? new Set(prev.get('sources').split(',')) : new Set()
      current.has(s) ? current.delete(s) : current.add(s)
      if (current.size > 0) prev.set('sources', [...current].join(',')); else prev.delete('sources')
      prev.delete('page')
      return prev
    }, { replace: true })
  }

  if (loading) return <LoadingState message="Loading items..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const wishlistCount = wishlistIds.size

  // Lookup full item from allItems for the detail panel (provides id, manufacturer_name)
  const detailItemMeta = detailUuid ? allItems?.find(i => i.uuid === detailUuid) ?? null : null
  const detailItemId = detailItemMeta?.id ?? null

  return (
    <>
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="ITEM FINDER"
        subtitle={`${totalCount.toLocaleString()} items — find loot, gear, and collectibles`}
        actions={<Search className="w-5 h-5 text-gray-500" />}
      />

      {actionError && (
        <div className="panel p-4 flex items-center gap-2 text-sm animate-fade-in border-sc-danger/30 text-sc-danger">
          {actionError}
        </div>
      )}

      {/* Tab bar (auth only) */}
      {isAuthed && (
        <div className="flex gap-0 border-b border-sc-border">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wide border-b-2 transition-colors -mb-px ${
              activeTab === 'browse'
                ? 'border-sc-accent text-sc-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('collection')}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              activeTab === 'collection'
                ? 'border-sc-accent text-sc-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Collection
            {collectionCount > 0 && (
              <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                activeTab === 'collection' ? 'bg-sc-accent/20 text-sc-accent' : 'bg-gray-700 text-gray-400'
              }`}>
                {collectionCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              activeTab === 'wishlist'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Bookmark className="w-3 h-3" />
            Wishlist
            {wishlistCount > 0 && (
              <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                activeTab === 'wishlist' ? 'bg-amber-400/20 text-amber-400' : 'bg-gray-700 text-gray-400'
              }`}>
                {wishlistCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Browse tab ── */}
      {activeTab === 'browse' && (
        <div className="flex gap-4">
          {/* ── Sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-4 w-56 shrink-0">
            {/* Category */}
            <div>
              <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Category</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setCategory('all')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                    category === 'all' ? 'text-sc-accent bg-sc-accent/10' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span className="font-display tracking-wide">All</span>
                  <span className="font-mono text-[10px] text-gray-500">{totalCount.toLocaleString()}</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                      category === cat ? 'text-sc-accent bg-sc-accent/10' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-display tracking-wide">{CATEGORY_LABELS[cat] || cat}</span>
                    <span className="font-mono text-[10px] text-gray-500">{(categoryCounts[cat] || 0).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand */}
            {brands.size > 0 && (
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Brand</p>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {[...brands.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([brandName, count]) => (
                    <button
                      key={brandName}
                      onClick={() => setBrand(brand === brandName ? null : brandName)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                        brand === brandName ? 'text-sc-accent bg-sc-accent/10' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="font-display tracking-wide truncate">{brandName}</span>
                      <span className="font-mono text-[10px] text-gray-500 shrink-0">{count.toLocaleString()}</span>
                    </button>
                  ))}
                </div>

                {/* Set/model sub-filter */}
                {brand && setNames.size > 1 && (
                  <div className="mt-2 ml-2 pl-2 border-l border-sc-border">
                    <p className="text-[10px] font-display uppercase tracking-widest text-gray-600 mb-1.5">Set</p>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                      {[...setNames.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sn, count]) => (
                        <button
                          key={sn}
                          onClick={() => setSetName(setName === sn ? null : sn)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors ${
                            setName === sn ? 'text-sc-accent bg-sc-accent/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="font-display tracking-wide truncate">{sn}</span>
                          <span className="font-mono text-[10px] text-gray-600 shrink-0">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rarity */}
            <div>
              <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Rarity</p>
              <div className="space-y-1">
                {RARITY_ORDER.map((r) => {
                  const rs = RARITY_STYLES[r]
                  const active = rarities.has(r)
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRarity(r)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                        active ? 'bg-white/5' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        active ? 'border-sc-accent bg-sc-accent/20' : 'border-gray-600'
                      }`}>
                        {active && <Check className="w-2.5 h-2.5 text-sc-accent" />}
                      </div>
                      <span className={`font-mono ${rs.dot}`}>{rs.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Found in */}
            <div>
              <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Found In</p>
              <div className="space-y-1">
                {[
                  { key: 'shops', icon: ShoppingCart, label: 'Shops' },
                  { key: 'containers', icon: Package, label: 'Containers' },
                  { key: 'npcs', icon: Swords, label: 'NPCs' },
                  { key: 'contracts', icon: FileText, label: 'Contracts' },
                ].map(({ key, icon: Icon, label }) => {
                  const active = sources.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSource(key)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                        active ? 'bg-white/5' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        active ? 'border-sc-accent bg-sc-accent/20' : 'border-gray-600'
                      }`}>
                        {active && <Check className="w-2.5 h-2.5 text-sc-accent" />}
                      </div>
                      <Icon className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400 font-display tracking-wide">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Collection stats (auth only) */}
            {isAuthed && (
              <div className="border-t border-sc-border pt-4">
                <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Collection</p>
                <p className="text-xs font-mono text-gray-300">
                  {collectionCount.toLocaleString()} / {totalCount.toLocaleString()} collected
                </p>
                <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sc-accent/60 rounded-full transition-all duration-300"
                    style={{ width: totalCount > 0 ? `${(collectionCount / totalCount) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-[10px] font-mono text-gray-600 mt-1">
                  {totalCount > 0 ? ((collectionCount / totalCount) * 100).toFixed(1) : 0}%
                </p>
              </div>
            )}
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search items..."
                className="flex-1 min-w-48"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs bg-sc-darker border border-sc-border rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:border-sc-accent font-display tracking-wide"
              >
                <option value="name">Name A-Z</option>
                <option value="rarity">Rarity</option>
                <option value="category">Category</option>
              </select>
              <div className="flex items-center gap-1 border border-sc-border rounded p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-sc-accent/20 text-sc-accent' : 'text-gray-400 hover:text-gray-300'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-sc-accent/20 text-sc-accent' : 'text-gray-400 hover:text-gray-300'}`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mobile category tabs */}
            <div className="lg:hidden flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setCategory('all')}
                className={`px-2.5 py-1 rounded text-[10px] font-display uppercase tracking-wide whitespace-nowrap transition-colors shrink-0 ${
                  category === 'all' ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40' : 'text-gray-400 border border-sc-border'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[10px] font-display uppercase tracking-wide whitespace-nowrap transition-colors shrink-0 ${
                    category === cat ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40' : 'text-gray-400 border border-sc-border'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>

            {/* Active filters pills */}
            {(brand || setName) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {brand && (
                  <span className="flex items-center gap-1 text-[10px] font-mono bg-sc-accent/10 border border-sc-accent/30 text-sc-accent px-2 py-0.5 rounded">
                    {brand}
                    <button onClick={() => setBrand(null)} className="hover:text-white ml-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {setName && (
                  <span className="flex items-center gap-1 text-[10px] font-mono bg-sc-accent/10 border border-sc-accent/30 text-sc-accent px-2 py-0.5 rounded">
                    {setName}
                    <button onClick={() => setSetName(null)} className="hover:text-white ml-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Result count */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500">
                {filtered.length.toLocaleString()} items
                {filtered.length !== totalCount && ` of ${totalCount.toLocaleString()}`}
              </span>
              {totalPages > 1 && (
                <span className="text-xs font-mono text-gray-500">
                  Page {page} / {totalPages}
                </span>
              )}
            </div>

            {/* Grid or list */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {paged.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    collectionQty={collected.get(item.id) ?? 0}
                    onSetCollectionQty={handleSetCollectionQty}
                    wishlisted={wishlistIds.has(item.id)}
                    onToggleWishlist={handleToggleWishlist}
                    isAuthed={isAuthed}
                    onSelect={setDetailUuid}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-sc-border border border-sc-border rounded">
                {paged.map((item) => {
                  const rs = item.rarity ? rarityStyle(item.rarity) : null
                  const eCat = effectiveCategory(item)
                  const catStyle = CATEGORY_BADGE_STYLES[eCat] || CATEGORY_BADGE_STYLES.unknown
                  const catLabel = CATEGORY_LABELS[eCat] || eCat
                  const itemCollectionQty = collected.get(item.id) ?? 0
                  const isWishlisted = wishlistIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-white/3 cursor-pointer transition-colors"
                      onClick={() => setDetailUuid(item.uuid)}
                    >
                      <span className={`text-[10px] font-display uppercase px-1.5 py-0.5 rounded w-20 text-center shrink-0 ${catStyle}`}>
                        {catLabel}
                      </span>
                      <span className="text-xs text-gray-200 flex-1 min-w-0 truncate">{item.name}</span>
                      {item.rarity && rs && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${rs.badge} shrink-0`}>
                          {item.rarity}
                        </span>
                      )}
                      <SourceIcons item={item} />
                      <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                      {isAuthed && (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleWishlist(item.uuid, isWishlisted)}
                            className={`flex items-center justify-center transition-all duration-150 shrink-0 ${
                              isWishlisted ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {isWishlisted ? <Bookmark className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                          </button>
                          <CollectionStepper
                            qty={itemCollectionQty}
                            onSetQty={(qty) => handleSetCollectionQty(item.uuid, qty)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-500 font-mono text-sm">
                No items found.
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide border border-sc-border text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs font-mono text-gray-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide border border-sc-border text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Collection/Wishlist auth gate ── */}
      {(activeTab === 'collection' || activeTab === 'wishlist') && !isAuthed && (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-400 font-mono text-sm">Sign in to track your collection and wishlist</p>
          <a href="/login" className="inline-block text-sc-accent hover:text-sc-accent/80 text-sm font-mono transition-colors">Sign in</a>
        </div>
      )}

      {/* ── Collection tab ── */}
      {activeTab === 'collection' && isAuthed && (
        <div className="space-y-6">
          {collectedItems.length === 0 ? (
            <div className="text-center py-16 text-gray-500 font-mono text-sm">
              Nothing collected yet. Browse items and use the{' '}
              <Plus className="w-3.5 h-3.5 inline-block mx-0.5" /> button to mark them.
            </div>
          ) : (
            <>
              {/* Overall progress */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-display uppercase tracking-widest text-gray-500">Overall Progress</p>
                  <span className="text-xs font-mono text-sc-accent">
                    {collectionCount.toLocaleString()} / {totalCount.toLocaleString()} items
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sc-accent/70 rounded-full transition-all duration-500"
                    style={{ width: `${(collectionCount / totalCount) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-gray-500 text-right">
                  {((collectionCount / totalCount) * 100).toFixed(1)}%
                </p>
              </div>

              {/* Per-category breakdown */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-3">By Category</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {['weapon','armour','helmet','clothing','attachment','consumable','harvestable','prop','utility','ship_component','missile'].map(cat => {
                    const s = collectionCategoryStats[cat]
                    if (!s || s.total === 0) return null
                    const pct = (s.collected / s.total) * 100
                    const catStyle = CATEGORY_BADGE_STYLES[cat]
                    return (
                      <button
                        key={cat}
                        onClick={() => setCollCategory(collCategory === cat ? 'all' : cat)}
                        className={`panel p-3 space-y-2 text-left transition-all ${
                          collCategory === cat ? 'border-sc-accent/60' : 'hover:border-sc-border/80'
                        }`}
                      >
                        <span className={`text-[10px] font-display uppercase px-1.5 py-0.5 rounded ${catStyle}`}>
                          {CATEGORY_LABELS[cat]}
                        </span>
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-sc-accent/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-sc-accent">{s.collected}</span>
                          <span className="text-[10px] font-mono text-gray-600">/ {s.total}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Search + filter */}
              <div className="flex items-center gap-2">
                <SearchInput
                  value={collSearch}
                  onChange={setCollSearch}
                  placeholder="Search collection..."
                  className="flex-1"
                />
                {collCategory !== 'all' && (
                  <button
                    onClick={() => setCollCategory('all')}
                    className="flex items-center gap-1 text-[10px] font-mono bg-sc-accent/10 border border-sc-accent/30 text-sc-accent px-2 py-1 rounded"
                  >
                    {CATEGORY_LABELS[collCategory]}
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Collected items list */}
              <div>
                <p className="text-[10px] font-mono text-gray-500 mb-2">
                  {filteredCollectedItems.length.toLocaleString()} item{filteredCollectedItems.length !== 1 ? 's' : ''}
                  {collSearch || collCategory !== 'all' ? ' matching filters' : ' collected'}
                </p>
                <div className="border border-sc-border rounded overflow-hidden">
                  {filteredCollectedItems.map((item) => {
                    const rs = item.rarity ? rarityStyle(item.rarity) : null
                    const eCat = effectiveCategory(item)
                    const catStyle = CATEGORY_BADGE_STYLES[eCat] || CATEGORY_BADGE_STYLES.unknown
                    const catLabel = CATEGORY_LABELS[eCat] || eCat
                    const qty = collected.get(item.id) ?? 0
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-sc-border last:border-0 hover:bg-white/3 cursor-pointer transition-colors"
                        onClick={() => setDetailUuid(item.uuid)}
                      >
                        <span className={`text-[10px] font-display uppercase px-1.5 py-0.5 rounded shrink-0 w-20 text-center ${catStyle}`}>
                          {catLabel}
                        </span>
                        <span className="text-xs text-gray-200 flex-1 min-w-0 truncate">{item.name}</span>
                        {item.rarity && rs && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${rs.badge} shrink-0`}>
                            {item.rarity}
                          </span>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <CollectionStepper
                            qty={qty}
                            onSetQty={(q) => handleSetCollectionQty(item.uuid, q)}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {filteredCollectedItems.length === 0 && (
                    <div className="py-8 text-center text-gray-500 font-mono text-sm">
                      No items match your filters.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Wishlist tab ── */}
      {activeTab === 'wishlist' && isAuthed && (
        <div className="space-y-6">
          {wishlistItems && wishlistItems.length > 0 ? (
            <>
              {/* Shopping list — full-width rows per source, 3-col locations inside */}
              {Object.keys(shoppingList).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] font-display uppercase tracking-widest text-gray-500">Shopping List</p>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => { setWishShopSort('alpha'); setWishShopSortDesc(d => wishShopSort === 'alpha' ? !d : false) }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-display uppercase tracking-wide transition-colors ${
                          wishShopSort === 'alpha' ? 'bg-amber-400/20 text-amber-400' : 'text-gray-500 hover:text-gray-400'
                        }`}
                      >A–Z{wishShopSort === 'alpha' ? (wishShopSortDesc ? ' ↓' : ' ↑') : ''}</button>
                      <button
                        onClick={() => { setWishShopSort('count'); setWishShopSortDesc(d => wishShopSort === 'count' ? !d : true) }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-display uppercase tracking-wide transition-colors ${
                          wishShopSort === 'count' ? 'bg-amber-400/20 text-amber-400' : 'text-gray-500 hover:text-gray-400'
                        }`}
                      ># Items{wishShopSort === 'count' ? (wishShopSortDesc ? ' ↓' : ' ↑') : ''}</button>
                    </div>
                  </div>
                  {Object.entries(shoppingList).map(([key, { label, icon: Icon, locations }]) => {
                    let locEntries = Object.entries(locations)
                    if (wishShopSort === 'alpha') {
                      locEntries.sort((a, b) => wishShopSortDesc ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]))
                    } else {
                      locEntries.sort((a, b) => wishShopSortDesc ? b[1].length - a[1].length : a[1].length - b[1].length)
                    }
                    return (
                      <div key={key} className="panel p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[10px] font-display uppercase tracking-wider text-gray-400">{label}</span>
                          <span className="text-[10px] font-mono text-gray-600 ml-auto">
                            {locEntries.length} location{locEntries.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-0">
                          {locEntries.map(([loc, items]) => (
                            <div key={loc} className="flex items-center justify-between py-1 border-t border-sc-border/50">
                              <span className="text-xs text-gray-300 truncate mr-2">{loc}</span>
                              <span className="text-[10px] font-mono text-gray-500 shrink-0">
                                {[...new Set(items)].length}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Toolbar: search + view toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <SearchInput
                  value={wishSearch}
                  onChange={setWishSearch}
                  placeholder="Search wishlist..."
                  className="flex-1 min-w-48"
                />
                <div className="flex items-center gap-1 border border-sc-border rounded p-0.5">
                  <button
                    onClick={() => setWishViewMode('item')}
                    className={`px-2 py-1 rounded text-[10px] font-display uppercase tracking-wide transition-colors ${
                      wishViewMode === 'item' ? 'bg-amber-400/20 text-amber-400' : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    By Item
                  </button>
                  <button
                    onClick={() => setWishViewMode('location')}
                    className={`px-2 py-1 rounded text-[10px] font-display uppercase tracking-wide transition-colors ${
                      wishViewMode === 'location' ? 'bg-amber-400/20 text-amber-400' : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    By Location
                  </button>
                </div>
              </div>

              {/* Result count */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">
                  {filteredWishlistItems.length} item{filteredWishlistItems.length !== 1 ? 's' : ''}
                  {filteredWishlistItems.length !== wishlistItems.length && ` of ${wishlistItems.length}`}
                </span>
              </div>

              {/* ── By Item view: grouped by category > sub-type ── */}
              {wishViewMode === 'item' && (
                <div className="space-y-2">
                  {wishlistGrouped.map((group) => {
                    const groupKey = `group::${group.key}`
                    const isGroupCollapsed = collapsedWishGroups.has(groupKey)
                    return (
                      <div key={group.key} className="border border-sc-border rounded overflow-hidden">
                        {/* Top-level group header */}
                        <div className="flex items-center bg-sc-darker/50">
                          <button
                            onClick={() => setCollapsedWishGroups(prev => {
                              const next = new Set(prev)
                              next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey)
                              return next
                            })}
                            className="flex-1 flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`} />
                            <span className="text-xs font-display uppercase tracking-wider text-amber-400">{group.label}</span>
                            <span className="text-[10px] font-mono text-gray-500">{group.count}</span>
                          </button>
                          {!isGroupCollapsed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setCollapsedWishGroups(prev => {
                                  const next = new Set(prev)
                                  const subKeys = group.subGroups.map(s => `sub::${group.key}::${s.label}`)
                                  const allCollapsed = subKeys.every(k => next.has(k))
                                  subKeys.forEach(k => allCollapsed ? next.delete(k) : next.add(k))
                                  return next
                                })
                              }}
                              className="px-3 py-2.5 text-gray-500 hover:text-gray-300 transition-colors"
                              title={group.subGroups.every(s => collapsedWishGroups.has(`sub::${group.key}::${s.label}`)) ? 'Expand all' : 'Collapse all'}
                            >
                              {group.subGroups.every(s => collapsedWishGroups.has(`sub::${group.key}::${s.label}`))
                                ? <ChevronsDownUp className="w-3.5 h-3.5" />
                                : <ChevronsUpDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {!isGroupCollapsed && group.subGroups.map((sub) => {
                          const subKey = `sub::${group.key}::${sub.label}`
                          const isSubCollapsed = collapsedWishGroups.has(subKey)
                          return (
                            <div key={sub.label}>
                              {/* Sub-group header */}
                              <button
                                onClick={() => setCollapsedWishGroups(prev => {
                                  const next = new Set(prev)
                                  next.has(subKey) ? next.delete(subKey) : next.add(subKey)
                                  return next
                                })}
                                className="w-full flex items-center gap-3 px-4 py-2 pl-8 bg-sc-darker/30 hover:bg-white/3 transition-colors border-t border-sc-border/50"
                              >
                                <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isSubCollapsed ? '-rotate-90' : ''}`} />
                                <span className="text-[11px] font-display tracking-wide text-gray-300">{sub.label}</span>
                                <span className="text-[10px] font-mono text-gray-600">{sub.items.length}</span>
                              </button>

                              {!isSubCollapsed && sub.items.map((item) => (
                                <WishlistRow
                                  key={item.id}
                                  item={item}
                                  primarySource={primarySourceMap.get(item.id)}
                                  collectionQty={collected.get(item.id) ?? 0}
                                  onSetCollectionQty={handleSetCollectionQty}
                                  wishlistQty={wishlistMap.get(item.id) ?? 1}
                                  onSetWishlistQty={handleSetWishlistQty}
                                  onSelect={setDetailUuid}
                                />
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── By Location view: grouped by source type > location ── */}
              {wishViewMode === 'location' && (
                <div className="space-y-2">
                  {(() => {
                    // Group locations by source type
                    const bySource = new Map()
                    for (const loc of wishlistByLocation) {
                      if (!bySource.has(loc.sourceType)) bySource.set(loc.sourceType, [])
                      bySource.get(loc.sourceType).push(loc)
                    }
                    return [...bySource.entries()].map(([sourceType, locations]) => {
                      const sourceKey = `locsrc::${sourceType}`
                      const isSourceCollapsed = collapsedWishGroups.has(sourceKey)
                      const SourceIcon = locations[0].sourceIcon
                      return (
                        <div key={sourceType} className="border border-sc-border rounded overflow-hidden">
                          {/* Source type header */}
                          <div className="flex items-center bg-sc-darker/50">
                            <button
                              onClick={() => setCollapsedWishGroups(prev => {
                                const next = new Set(prev)
                                next.has(sourceKey) ? next.delete(sourceKey) : next.add(sourceKey)
                                return next
                              })}
                              className="flex-1 flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors"
                            >
                              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isSourceCollapsed ? '-rotate-90' : ''}`} />
                              <SourceIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs font-display uppercase tracking-wider text-amber-400">{locations[0].sourceLabel}</span>
                              <span className="text-[10px] font-mono text-gray-500">{locations.length} location{locations.length !== 1 ? 's' : ''}</span>
                            </button>
                            {!isSourceCollapsed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCollapsedWishGroups(prev => {
                                    const next = new Set(prev)
                                    const locKeys = locations.map(l => `loc::${sourceType}::${l.location}`)
                                    const allCollapsed = locKeys.every(k => next.has(k))
                                    locKeys.forEach(k => allCollapsed ? next.delete(k) : next.add(k))
                                    return next
                                  })
                                }}
                                className="px-3 py-2.5 text-gray-500 hover:text-gray-300 transition-colors"
                                title={locations.every(l => collapsedWishGroups.has(`loc::${sourceType}::${l.location}`)) ? 'Expand all' : 'Collapse all'}
                              >
                                {locations.every(l => collapsedWishGroups.has(`loc::${sourceType}::${l.location}`))
                                  ? <ChevronsDownUp className="w-3.5 h-3.5" />
                                  : <ChevronsUpDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>

                          {!isSourceCollapsed && locations.map((loc) => {
                            const locKey = `loc::${sourceType}::${loc.location}`
                            const isLocCollapsed = collapsedWishGroups.has(locKey)
                            return (
                              <div key={loc.location}>
                                {/* Location header */}
                                <button
                                  onClick={() => setCollapsedWishGroups(prev => {
                                    const next = new Set(prev)
                                    next.has(locKey) ? next.delete(locKey) : next.add(locKey)
                                    return next
                                  })}
                                  className="w-full flex items-center gap-3 px-4 py-2 pl-8 bg-sc-darker/30 hover:bg-white/3 transition-colors border-t border-sc-border/50"
                                >
                                  <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isLocCollapsed ? '-rotate-90' : ''}`} />
                                  <MapPin className="w-3 h-3 text-gray-500" />
                                  <span className="text-[11px] text-gray-300 flex-1 text-left truncate">{loc.location}</span>
                                  <span className="text-[10px] font-mono text-gray-600 shrink-0">{loc.items.length} item{loc.items.length !== 1 ? 's' : ''}</span>
                                </button>

                                {!isLocCollapsed && loc.items.map((item) => (
                                  <WishlistRow
                                    key={`${loc.location}-${item.id}`}
                                    item={item}
                                    primarySource={primarySourceMap.get(item.id)}
                                    collectionQty={collected.get(item.id) ?? 0}
                                    onSetCollectionQty={handleSetCollectionQty}
                                    wishlistQty={wishlistMap.get(item.id) ?? 1}
                                    onSetWishlistQty={handleSetWishlistQty}
                                    onSelect={setDetailUuid}
                                  />
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })
                  })()}

                  {wishlistByLocation.length === 0 && (
                    <div className="py-8 text-center text-gray-500 font-mono text-sm">
                      No location data available for wishlisted items.
                    </div>
                  )}
                </div>
              )}

              {filteredWishlistItems.length === 0 && (
                <div className="py-8 text-center text-gray-500 font-mono text-sm">
                  No items match your search.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-gray-500 font-mono text-sm">
              No wishlisted items. Browse items and click the{' '}
              <Bookmark className="w-3.5 h-3.5 inline-block mx-0.5" /> icon to add them.
            </div>
          )}
        </div>
      )}

    </div>
    {/* Detail slide-over — rendered outside animated container to avoid stacking context trap */}
    {detailUuid && (
      <DetailPanel
        uuid={detailUuid}
        manufacturerName={detailItemMeta?.manufacturer_name ?? null}
        collectionQty={collected.get(detailItemId) ?? 0}
        onSetCollectionQty={handleSetCollectionQty}
        wishlisted={wishlistIds.has(detailItemId)}
        onToggleWishlist={handleToggleWishlist}
        isAuthed={isAuthed}
        onClose={() => { setDetailUuid(null); if (routeUuid) navigate('/loot', { replace: true }) }}
      />
    )}
    </>
  )
}
