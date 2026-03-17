import React, { useState, useMemo } from 'react'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Hammer, Gem, FlaskConical } from 'lucide-react'

const TABS = [
  { key: 'elements',     label: 'Elements',          icon: Gem },
  { key: 'compositions', label: 'Rock Compositions', icon: Hammer },
  { key: 'refining',     label: 'Refining',          icon: FlaskConical },
]

/** Maps DB column names (snake_case) to display labels */
const STAT_LABELS = {
  instability: 'Instability',
  resistance: 'Resistance',
  optimal_window_midpoint: 'Optimal Window',
  optimal_window_randomness: 'Window Randomness',
  optimal_window_thinness: 'Window Thinness',
  explosion_multiplier: 'Explosion Multiplier',
  cluster_factor: 'Cluster Factor',
}

const CATEGORY_STYLES = {
  ore: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  raw: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
}

const ROCK_TYPE_STYLES = {
  asteroid: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  surface:  'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  unknown:  'bg-gray-700/60 text-gray-400 border-gray-600/50',
}

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

function instabilityColor(val) {
  if (val == null) return 'text-gray-400'
  if (val >= 0.7) return 'text-red-400'
  if (val >= 0.4) return 'text-amber-400'
  return 'text-green-400'
}

function instabilityBg(val) {
  if (val == null) return 'bg-gray-700'
  if (val >= 0.7) return 'bg-red-500/30'
  if (val >= 0.4) return 'bg-amber-500/30'
  return 'bg-green-500/30'
}

function instabilityBarColor(val) {
  if (val == null) return 'bg-gray-500'
  if (val >= 0.7) return 'bg-red-500'
  if (val >= 0.4) return 'bg-amber-500'
  return 'bg-green-500'
}

function StatRow({ label, value }) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-gray-500">{label}</span>
      <span className="font-mono text-gray-300">{typeof value === 'number' ? value.toFixed(2) : value}</span>
    </div>
  )
}

function Badge({ children, style }) {
  const classes = style || 'bg-gray-700/60 text-gray-400 border-gray-600/50'
  return (
    <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 ${classes}`}>
      {children}
    </span>
  )
}

/** Convert class_name like "aluminium_ore" to "Aluminium Ore" */
function friendlyElementName(className) {
  if (!className) return '--'
  return className
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Strip DataCore "Minableelement <Type> " prefixes from element display names.
 * e.g. "Minableelement Fps Hadanite" → "Hadanite"
 *      "Minableelement Ship Quantanium" → "Quantanium"
 *      "Minableelement Groundvehicle Agricium" → "Agricium"
 */
function cleanElementName(name) {
  if (!name) return '--'
  return name.replace(/^Minableelement\s+(?:Fps|Ship|Groundvehicle)\s+/i, '')
}

function ElementCard({ element }) {
  const instability = element.instability ?? null

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight">{cleanElementName(element.name)}</h3>
        <div className="flex items-center gap-1.5">
          {element.category && (
            <Badge style={CATEGORY_STYLES[element.category]}>
              {element.category}
            </Badge>
          )}
        </div>
      </div>

      {/* Instability bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-500">Instability</span>
          <span className={`font-mono font-semibold ${instabilityColor(instability)}`}>
            {instability != null ? (instability * 100).toFixed(0) + '%' : '--'}
          </span>
        </div>
        {instability != null && (
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${instabilityBg(instability)}`}>
            <div
              className={`h-full rounded-full transition-all ${instabilityBarColor(instability)}`}
              style={{ width: `${(instability * 100).toFixed(0)}%` }}
            />
          </div>
        )}
      </div>

      {/* Remaining typed stat columns */}
      {Object.entries(STAT_LABELS).map(([key, label]) => {
        if (key === 'instability') return null
        const val = element[key]
        return <StatRow key={key} label={label} value={val} />
      })}
    </div>
  )
}

function CompositionCard({ composition }) {
  const elements = useMemo(() => {
    if (!composition.composition_json) return []
    try { return JSON.parse(composition.composition_json) } catch { return [] }
  }, [composition.composition_json])

  const rockStyle = ROCK_TYPE_STYLES[composition.rock_type] || ROCK_TYPE_STYLES.unknown

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight">{composition.name}</h3>
        {composition.rock_type && (
          <Badge style={rockStyle}>
            {composition.rock_type}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
        <span>Min elements: {composition.min_elements ?? '--'}</span>
      </div>

      {/* Element list */}
      {elements.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-sc-border">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Composition</span>
          {elements.map((el, i) => (
            <div key={el.element || i} className="flex items-center justify-between text-xs gap-2">
              <span className="font-mono text-gray-300 truncate">{friendlyElementName(el.element)}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-gray-500">
                  {el.minPct != null ? `${(el.minPct * 100).toFixed(1)}–${(el.maxPct * 100).toFixed(1)}%` : '--'}
                </span>
                {el.probability != null && (
                  <span className="font-mono text-gray-600 text-[10px]">
                    ({(el.probability * 100).toFixed(0)}% chance)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RefiningTable({ processes }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-[10px] font-display uppercase tracking-wider text-gray-500">
        <span>Process</span>
        <span className="w-24 text-center">Speed</span>
        <span className="w-24 text-center">Quality</span>
      </div>

      {processes.map((proc) => {
        const speedStyle = SPEED_STYLES[proc.speed] || SPEED_STYLES.Normal
        const qualityStyle = QUALITY_STYLES[proc.quality] || QUALITY_STYLES.Normal

        return (
          <div key={proc.id} className="panel p-4 sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4 sm:items-center space-y-2 sm:space-y-0">
            <h3 className="font-display font-semibold text-white text-sm">{proc.name}</h3>

            {/* Speed */}
            <div className="flex items-center gap-2 sm:justify-center">
              <span className="text-[10px] font-display uppercase tracking-wider text-gray-500 sm:hidden">Speed:</span>
              <Badge style={speedStyle}>
                {proc.speed || '--'}
              </Badge>
            </div>

            {/* Quality */}
            <div className="flex items-center gap-2 sm:justify-center">
              <span className="text-[10px] font-display uppercase tracking-wider text-gray-500 sm:hidden">Quality:</span>
              <Badge style={qualityStyle}>
                {proc.quality || '--'}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function MiningGuide() {
  const { data, loading, error, refetch } = useAPI('/gamedata/mining')
  const [tab, setTab] = useState('elements')
  const [search, setSearch] = useState('')

  const elements = data?.elements || []
  const compositions = data?.compositions || []
  const refining = data?.refining || []

  const filteredElements = useMemo(() => {
    if (!search) return elements
    const q = search.toLowerCase()
    return elements.filter((el) => cleanElementName(el.name).toLowerCase().includes(q))
  }, [elements, search])

  const filteredCompositions = useMemo(() => {
    if (!search) return compositions
    const q = search.toLowerCase()
    return compositions.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.rock_type && c.rock_type.toLowerCase().includes(q))
    )
  }, [compositions, search])

  const filteredRefining = useMemo(() => {
    if (!search) return refining
    const q = search.toLowerCase()
    return refining.filter((r) => r.name.toLowerCase().includes(q))
  }, [refining, search])

  const counts = {
    elements: filteredElements.length,
    compositions: filteredCompositions.length,
    refining: filteredRefining.length,
  }

  if (loading) return <LoadingState message="Loading mining data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="MINING GUIDE"
        subtitle="Elements, rock compositions, and refining processes"
        actions={<Hammer className="w-5 h-5 text-gray-500" />}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
              tab === key
                ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
                : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span className="font-mono text-[10px] ml-1 opacity-60">{counts[key]}</span>
          </button>
        ))}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={`Search ${tab}...`}
        className="max-w-md"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">{counts[tab]} {tab}</span>
      </div>

      {/* Elements */}
      {tab === 'elements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredElements.map((el) => (
            <ElementCard key={el.id} element={el} />
          ))}
        </div>
      )}

      {/* Compositions */}
      {tab === 'compositions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCompositions.map((c) => (
            <CompositionCard key={c.id} composition={c} />
          ))}
        </div>
      )}

      {/* Refining */}
      {tab === 'refining' && (
        <RefiningTable processes={filteredRefining} />
      )}

      {counts[tab] === 0 && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">
          No {tab} found.
        </div>
      )}
    </div>
  )
}
