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

function StatRow({ label, value, unit = '' }) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-gray-500">{label}</span>
      <span className="font-mono text-gray-300">{typeof value === 'number' ? value.toFixed(2) : value}{unit}</span>
    </div>
  )
}

function PercentBar({ value, max = 1, color = 'bg-sc-accent' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ElementCard({ element }) {
  const stats = useMemo(() => {
    if (!element.stats_json) return null
    try { return JSON.parse(element.stats_json) } catch { return null }
  }, [element.stats_json])

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight">{element.name}</h3>
        {element.inert === 1 && (
          <span className="text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded bg-gray-700/60 text-gray-400 border border-gray-600/50 shrink-0">
            Inert
          </span>
        )}
      </div>

      {/* Instability */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-500">Instability</span>
          <span className={`font-mono font-semibold ${instabilityColor(element.instability)}`}>
            {element.instability != null ? (element.instability * 100).toFixed(0) + '%' : '--'}
          </span>
        </div>
        {element.instability != null && (
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${instabilityBg(element.instability)}`}>
            <div
              className={`h-full rounded-full transition-all ${instabilityBarColor(element.instability)}`}
              style={{ width: `${(element.instability * 100).toFixed(0)}%` }}
            />
          </div>
        )}
      </div>

      <StatRow label="Resistance" value={element.resistance} />
      <StatRow label="Charge Window" value={element.optimal_charge_window_size} />
      <StatRow label="Charge Rate" value={element.optimal_charge_rate} />

      {/* Extra stats from stats_json */}
      {stats && Object.entries(stats).map(([key, val]) => (
        <StatRow key={key} label={key.replace(/_/g, ' ')} value={val} />
      ))}
    </div>
  )
}

function CompositionCard({ composition }) {
  const elements = useMemo(() => {
    if (!composition.composition_json) return []
    try { return JSON.parse(composition.composition_json) } catch { return [] }
  }, [composition.composition_json])

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight">{composition.name}</h3>
        {composition.rock_type && (
          <span className="text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 shrink-0">
            {composition.rock_type}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
        <span>{composition.min_elements}–{composition.max_elements} elements</span>
      </div>

      {/* Element list */}
      {elements.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-sc-border">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Composition</span>
          {elements.map((el, i) => (
            <div key={el.element_uuid || i} className="flex items-center justify-between text-xs">
              <span className="font-mono text-gray-300">{el.element_name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-500">
                  {el.min_pct != null ? `${(el.min_pct * 100).toFixed(1)}–${(el.max_pct * 100).toFixed(1)}%` : '--'}
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
  const maxSpeed = useMemo(() => Math.max(...processes.map(p => p.refining_speed || 0), 1), [processes])
  const maxQuality = useMemo(() => Math.max(...processes.map(p => p.refining_quality || 0), 1), [processes])

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr] gap-4 px-4 py-2 text-[10px] font-display uppercase tracking-wider text-gray-500">
        <span>Process</span>
        <span>Speed</span>
        <span>Quality</span>
      </div>

      {processes.map((proc) => (
        <div key={proc.id} className="panel p-4 sm:grid sm:grid-cols-[1fr_1fr_1fr] sm:gap-4 sm:items-center space-y-2 sm:space-y-0">
          <h3 className="font-display font-semibold text-white text-sm">{proc.name}</h3>

          {/* Speed */}
          <div className="space-y-1">
            <div className="flex items-center justify-between sm:hidden">
              <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Speed</span>
            </div>
            <div className="flex items-center gap-2">
              <PercentBar value={proc.refining_speed || 0} max={maxSpeed} color="bg-sc-accent" />
              <span className="font-mono text-xs text-gray-300 w-12 text-right shrink-0">
                {proc.refining_speed != null ? proc.refining_speed.toFixed(2) : '--'}
              </span>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-1">
            <div className="flex items-center justify-between sm:hidden">
              <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Quality</span>
            </div>
            <div className="flex items-center gap-2">
              <PercentBar value={proc.refining_quality || 0} max={maxQuality} color="bg-sc-accent2" />
              <span className="font-mono text-xs text-gray-300 w-12 text-right shrink-0">
                {proc.refining_quality != null ? proc.refining_quality.toFixed(2) : '--'}
              </span>
            </div>
          </div>
        </div>
      ))}
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
    return elements.filter((el) => el.name.toLowerCase().includes(q))
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
