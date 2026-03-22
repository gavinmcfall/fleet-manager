import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Gem, MapPin, Wrench, Calculator, Layers, FlaskConical, Hammer } from 'lucide-react'
import { useMining } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import StatsRow from './StatsRow'
import FilterBar from './FilterBar'
import ElementCard from './ElementCard'
import LocationCard from './LocationCard'
import EquipmentCard from './EquipmentCard'
import RockCalculator from './RockCalculator'
import { cleanElementName, humanizeLocationName, friendlyElementName } from './miningUtils'

const TABS = [
  { key: 'ores',         label: 'Ores & Elements', icon: Gem },
  { key: 'locations',    label: 'Locations',        icon: MapPin },
  { key: 'equipment',    label: 'Equipment',        icon: Wrench },
  { key: 'calculator',   label: 'Rock Calculator',  icon: Calculator },
  { key: 'compositions', label: 'Compositions',     icon: Layers },
  { key: 'refining',     label: 'Refining',         icon: FlaskConical },
]

// Legacy composition/refining components (kept from original MiningGuide)
function CompositionCard({ composition }) {
  const elements = useMemo(() => {
    if (!composition.composition_json) return []
    try { return JSON.parse(composition.composition_json) } catch { return [] }
  }, [composition.composition_json])

  const ROCK_TYPE_STYLES = {
    asteroid: { badge: 'bg-violet-900/40 text-violet-300 border-violet-700/50', label: 'Asteroid' },
    surface:  { badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50', label: 'Surface' },
    fps:      { badge: 'bg-amber-900/40 text-amber-300 border-amber-700/50', label: 'Hand Mining' },
  }
  const rockInfo = ROCK_TYPE_STYLES[composition.rock_type] || { badge: 'bg-gray-700/60 text-gray-400 border-gray-600/50', label: composition.rock_type }

  // Use primary element as the card title (what players care about)
  const primaryElement = elements.length > 0 ? friendlyElementName(elements[0].element) : composition.name

  return (
    <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold text-white text-sm leading-tight">{primaryElement}</h3>
          <p className="text-[10px] text-gray-600 mt-0.5">{composition.name}</p>
        </div>
        <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 ${rockInfo.badge}`}>
          {rockInfo.label}
        </span>
      </div>
      {elements.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
          {elements.map((el, i) => {
            const pct = el.maxPct != null ? `${el.minPct.toFixed(1)}–${el.maxPct.toFixed(1)}%` : null
            return (
              <div key={el.element || i} className="flex items-center justify-between text-xs gap-2">
                <span className="text-gray-300 truncate">{friendlyElementName(el.element)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {pct && (
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-sc-accent/50 rounded-full" style={{ width: `${el.maxPct || 0}%` }} />
                      </div>
                      <span className="font-mono text-gray-500 text-[11px]">{pct}</span>
                    </div>
                  )}
                  {el.probability != null && el.probability < 1 && (
                    <span className="font-mono text-gray-600 text-[10px]">
                      {(el.probability * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RefiningTable({ processes }) {
  const SPEED_STYLES = {
    'Very Fast': 'bg-green-900/40 text-green-300 border-green-700/50',
    'Fast':      'bg-green-900/40 text-green-300 border-green-700/50',
    'Normal':    'bg-gray-700/60 text-gray-400 border-gray-600/50',
    'Slow':      'bg-amber-900/40 text-amber-300 border-amber-700/50',
    'Very Slow': 'bg-red-900/40 text-red-300 border-red-700/50',
  }
  const QUALITY_STYLES = {
    'Careful':   'bg-green-900/40 text-green-300 border-green-700/50',
    'Normal':    'bg-gray-700/60 text-gray-400 border-gray-600/50',
    'Rushed':    'bg-amber-900/40 text-amber-300 border-amber-700/50',
    'Reckless':  'bg-red-900/40 text-red-300 border-red-700/50',
  }

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-[10px] font-display uppercase tracking-wider text-gray-500">
        <span>Process</span>
        <span className="w-24 text-center">Speed</span>
        <span className="w-24 text-center">Quality</span>
      </div>
      {processes.map((proc) => {
        const speedStyle = SPEED_STYLES[proc.speed] || SPEED_STYLES.Normal
        const qualityStyle = QUALITY_STYLES[proc.quality] || QUALITY_STYLES.Normal
        return (
          <div key={proc.id} className="bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4 sm:items-center space-y-2 sm:space-y-0">
            <h3 className="font-display font-semibold text-white text-sm">{proc.name}</h3>
            <div className="flex items-center gap-2 sm:justify-center">
              <span className="text-[10px] font-display uppercase tracking-wider text-gray-500 sm:hidden">Speed:</span>
              <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded border ${speedStyle}`}>
                {proc.speed || '--'}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:justify-center">
              <span className="text-[10px] font-display uppercase tracking-wider text-gray-500 sm:hidden">Quality:</span>
              <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded border ${qualityStyle}`}>
                {proc.quality || '--'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Mining() {
  const { data, loading, error, refetch } = useMining()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = searchParams.get('tab') || 'ores'
  const search = searchParams.get('q') || ''
  const systemFilter = searchParams.get('system') || ''
  const typeFilter = searchParams.get('type') || ''
  const sizeFilter = searchParams.get('size') || ''

  const setFilter = (updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  }

  const setTab = (newTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams()
      if (newTab !== 'ores') next.set('tab', newTab)
      // Preserve search when switching tabs
      const q = prev.get('q')
      if (q) next.set('q', q)
      return next
    })
  }

  const elements = data?.elements || []
  const compositions = data?.compositions || []
  const refining = data?.refining || []
  const locations = data?.locations || []
  const deposits = data?.deposits || []
  const lasers = data?.lasers || []
  const modules = data?.modules || []
  const gadgets = data?.gadgets || []

  // Build location-to-element lookup for ElementCard top locations
  const elementLocationMap = useMemo(() => {
    if (!deposits.length || !locations.length) return new Map()
    const map = new Map()
    for (const dep of deposits) {
      if (!dep.composition_json) continue
      try {
        const els = JSON.parse(dep.composition_json)
        const loc = locations.find(l => l.id === dep.mining_location_id)
        if (!loc) continue
        for (const el of els) {
          const key = el.element?.toLowerCase()
          if (!key) continue
          if (!map.has(key)) map.set(key, [])
          map.get(key).push(loc)
        }
      } catch { /* skip */ }
    }
    // Dedupe per element
    for (const [key, locs] of map) {
      const seen = new Set()
      map.set(key, locs.filter(l => {
        if (seen.has(l.id)) return false
        seen.add(l.id)
        return true
      }))
    }
    return map
  }, [deposits, locations])

  // Build deposits-per-location lookup
  const depositsByLocation = useMemo(() => {
    const map = new Map()
    for (const dep of deposits) {
      if (!map.has(dep.mining_location_id)) map.set(dep.mining_location_id, [])
      map.get(dep.mining_location_id).push(dep)
    }
    return map
  }, [deposits])

  // Filtering
  const filteredElements = useMemo(() => {
    let items = elements
    if (typeFilter) items = items.filter(e => e.category === typeFilter)
    if (systemFilter) {
      // Filter elements that have locations in the selected system
      items = items.filter(e => {
        const locs = elementLocationMap.get(e.class_name?.toLowerCase()) || []
        return locs.some(l => l.system === systemFilter)
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(e => cleanElementName(e.name).toLowerCase().includes(q))
    }
    return items
  }, [elements, typeFilter, systemFilter, search, elementLocationMap])

  const filteredLocations = useMemo(() => {
    let items = locations
    if (systemFilter) items = items.filter(l => l.system === systemFilter)
    if (typeFilter) items = items.filter(l => l.location_type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(l => humanizeLocationName(l.name).toLowerCase().includes(q))
    }
    return items
  }, [locations, systemFilter, typeFilter, search])

  const filteredEquipment = useMemo(() => {
    let items = []
    if (!typeFilter || typeFilter === 'laser') items.push(...lasers.map(l => ({ ...l, _type: 'laser' })))
    if (!typeFilter || typeFilter === 'module') items.push(...modules.map(m => ({ ...m, _type: 'module' })))
    if (!typeFilter || typeFilter === 'gadget') items.push(...gadgets.map(g => ({ ...g, _type: 'gadget' })))
    if (sizeFilter) items = items.filter(i => i.size != null && String(i.size) === sizeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.manufacturer || '').toLowerCase().includes(q))
    }
    return items
  }, [lasers, modules, gadgets, typeFilter, sizeFilter, search])

  const filteredCompositions = useMemo(() => {
    // Filter out unknown/salvage compositions that have no useful data
    let items = compositions.filter(c =>
      c.rock_type && c.rock_type !== 'unknown' && !c.name.toLowerCase().includes('salvage')
    )
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) || (c.rock_type || '').toLowerCase().includes(q)
      )
    }
    return items
  }, [compositions, search])

  const filteredRefining = useMemo(() => {
    if (!search.trim()) return refining
    const q = search.toLowerCase()
    return refining.filter(r => r.name.toLowerCase().includes(q))
  }, [refining, search])

  const counts = {
    ores: filteredElements.length,
    locations: filteredLocations.length,
    equipment: filteredEquipment.length,
    calculator: compositions.length,
    compositions: filteredCompositions.length,
    refining: filteredRefining.length,
  }

  if (loading) return <LoadingState fullScreen message="Loading mining data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="relative mb-8">
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t border-l border-sc-accent/20" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t border-r border-sc-accent/20" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b border-l border-sc-accent/20" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b border-r border-sc-accent/20" />

        <div className="py-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-sc-accent/60 mb-2 font-mono">
            Star Citizen · Mining Companion
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white tracking-wide mb-2"
            style={{ textShadow: '0 0 30px rgba(34, 211, 238, 0.2)' }}
          >
            Mining Guide
          </h1>
          <p className="text-sm text-gray-500">
            <span className="text-sc-accent font-mono font-bold" style={{ textShadow: '0 0 8px rgba(34, 211, 238, 0.4)' }}>
              {elements.length}
            </span> elements across{' '}
            <span className="text-sc-accent font-mono font-bold" style={{ textShadow: '0 0 8px rgba(34, 211, 238, 0.4)' }}>
              {locations.length}
            </span> locations
          </p>
        </div>
      </div>

      <StatsRow data={data} />

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
              tab === key
                ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
                : 'text-gray-400 hover:text-gray-300 border border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span className="font-mono text-[10px] ml-1 opacity-60">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Filters (not shown for calculator/refining tabs) */}
      {tab !== 'calculator' && tab !== 'refining' && (
        <FilterBar
          search={search}
          onSearchChange={v => setFilter({ q: v })}
          tab={tab}
          systemFilter={systemFilter}
          typeFilter={typeFilter}
          sizeFilter={sizeFilter}
          onFilterChange={setFilter}
        />
      )}

      {/* Count */}
      {tab !== 'calculator' && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-mono text-gray-500">
            {counts[tab]} {tab}
          </span>
        </div>
      )}

      {/* Ores tab */}
      {tab === 'ores' && (
        filteredElements.length === 0 ? (
          <div className="text-center py-16">
            <Gem className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500">No elements match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredElements.map((el, i) => (
              <ElementCard
                key={el.id}
                element={el}
                topLocations={elementLocationMap.get(el.class_name?.toLowerCase()) || []}
                index={i}
              />
            ))}
          </div>
        )
      )}

      {/* Locations tab */}
      {tab === 'locations' && (
        filteredLocations.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500">No locations match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredLocations.map((loc, i) => (
              <LocationCard
                key={loc.id}
                location={loc}
                deposits={depositsByLocation.get(loc.id) || []}
                compositions={compositions}
                index={i}
              />
            ))}
          </div>
        )
      )}

      {/* Equipment tab */}
      {tab === 'equipment' && (
        filteredEquipment.length === 0 ? (
          <div className="text-center py-16">
            <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500">No equipment matches your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredEquipment.map((item, i) => (
              <EquipmentCard key={`${item._type}-${item.id}`} item={item} equipType={item._type} index={i} />
            ))}
          </div>
        )
      )}

      {/* Rock Calculator tab */}
      {tab === 'calculator' && (
        <RockCalculator data={data} />
      )}

      {/* Compositions tab */}
      {tab === 'compositions' && (
        filteredCompositions.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500">No compositions found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCompositions.map(c => (
              <CompositionCard key={c.id} composition={c} />
            ))}
          </div>
        )
      )}

      {/* Refining tab */}
      {tab === 'refining' && (
        filteredRefining.length === 0 ? (
          <div className="text-center py-16">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500">No refining processes found.</p>
          </div>
        ) : (
          <RefiningTable processes={filteredRefining} />
        )
      )}
    </div>
  )
}
