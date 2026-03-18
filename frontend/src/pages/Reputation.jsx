import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Star, Lock, TrendingDown, ChevronDown, ChevronRight, Users, Layers, Shield } from 'lucide-react'

/** Clean internal standing names into human-friendly labels */
function friendlyStandingName(name) {
  if (!name) return ''
  let s = name
  s = s.replace(/^(Affinity|Racing_GravLev|Racing_Ground|Reliability)_/, '')
  s = s.replace(/_/g, ' ')
  s = s.replace(/^\d{2,}\s+/, '')
  s = s.replace(/([a-zA-Z])(\d)/, '$1 $2')
  s = s.replace(/\b\w/g, (c) => c.toUpperCase())
  return s.trim()
}

/** Color based on position index within the standings list (0 = worst, last = best) */
const STANDING_COLORS = [
  { bg: 'bg-red-900/50', text: 'text-red-300', border: 'border-red-700/40', bar: 'bg-red-700/60' },
  { bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-700/40', bar: 'bg-orange-700/60' },
  { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700/40', bar: 'bg-yellow-700/60' },
  { bg: 'bg-emerald-900/50', text: 'text-emerald-300', border: 'border-emerald-700/40', bar: 'bg-emerald-700/60' },
  { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700/40', bar: 'bg-green-700/60' },
]

function getStandingColor(index, total) {
  if (total <= 1) return STANDING_COLORS[2]
  const ratio = index / (total - 1)
  const colorIndex = Math.min(Math.floor(ratio * STANDING_COLORS.length), STANDING_COLORS.length - 1)
  return STANDING_COLORS[colorIndex]
}

function StandingSegment({ standing, index, total, widthPercent }) {
  const color = getStandingColor(index, total)
  const hasDrift = standing.drift_reputation != null && standing.drift_time_hours != null

  return (
    <div className="group relative" style={{ width: `${Math.max(widthPercent, 6)}%` }}>
      <div
        className={`h-7 ${color.bar} border-r border-sc-bg/60 flex items-center justify-center gap-1 cursor-default transition-all duration-150 group-hover:brightness-125 ${index === 0 ? 'rounded-l' : ''} ${index === total - 1 ? 'rounded-r' : ''}`}
        title={`${friendlyStandingName(standing.name)}: ${standing.min_reputation}+ rep${standing.is_gated ? ' (Gated)' : ''}${hasDrift ? ` — Drifts to ${standing.drift_reputation} over ${standing.drift_time_hours}h` : ''}`}
      >
        {standing.is_gated && <Lock className="w-3 h-3 text-current opacity-70 shrink-0" />}
        <span className={`text-[10px] font-mono truncate ${color.text}`}>
          {friendlyStandingName(standing.name)}
        </span>
      </div>

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded bg-sc-panel border border-sc-border shadow-xl z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
        <p className={`text-xs font-display font-semibold ${color.text}`}>
          {friendlyStandingName(standing.name)}
          {standing.is_gated && (
            <span className="ml-1.5 text-[10px] text-amber-400 font-mono">(Gated)</span>
          )}
        </p>
        <p className="text-[10px] font-mono text-gray-500 mt-1">
          Min reputation: {standing.min_reputation.toLocaleString()}
        </p>
        {hasDrift && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-gray-400">
            <TrendingDown className="w-3 h-3 text-gray-500 shrink-0" />
            Drifts to {standing.drift_reputation.toLocaleString()} over {standing.drift_time_hours}h
          </div>
        )}
        {standing.perk_description && (
          <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
            {standing.perk_description}
          </p>
        )}
      </div>
    </div>
  )
}

function ScopeCard({ scope }) {
  const [expanded, setExpanded] = useState(false)
  const standings = (scope.standings || []).filter(
    (s) => s.name !== '<= PLACEHOLDER =>'
  )
  const gatedCount = standings.filter((s) => s.is_gated).length
  const driftCount = standings.filter((s) => s.drift_reputation != null).length
  const maxRep = scope.max_reputation || 0

  const widths = useMemo(() => {
    if (standings.length === 0) return []
    if (maxRep === 0 || standings.length === 1) {
      return standings.map(() => 100 / standings.length)
    }
    return standings.map((s, i) => {
      const nextMin = i < standings.length - 1 ? standings[i + 1].min_reputation : maxRep
      const range = nextMin - s.min_reputation
      const pct = (range / maxRep) * 100
      return Math.max(pct, 1)
    })
  }, [standings, maxRep])

  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const normalizedWidths = totalWidth > 0
    ? widths.map((w) => (w / totalWidth) * 100)
    : widths

  const primaryFaction = scope.factions?.find((f) => f.is_primary)
  const otherFactions = scope.factions?.filter((f) => !f.is_primary) || []

  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-white text-sm leading-tight">
              {scope.name}
            </h3>
            {primaryFaction && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sc-accent/15 text-sc-accent border border-sc-accent/30">
                <Star className="w-2.5 h-2.5" />
                {primaryFaction.faction_name}
              </span>
            )}
          </div>
          {scope.description && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{scope.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gatedCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400" title={`${gatedCount} gated standing${gatedCount !== 1 ? 's' : ''}`}>
              <Lock className="w-3 h-3" />
              {gatedCount}
            </span>
          )}
          {driftCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-gray-500" title={`${driftCount} standing${driftCount !== 1 ? 's' : ''} with decay`}>
              <TrendingDown className="w-3 h-3" />
              {driftCount}
            </span>
          )}
        </div>
      </div>

      {/* Other factions (if any beyond primary) */}
      {otherFactions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {otherFactions.map((f) => (
            <span
              key={f.faction_id}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-700/40 text-gray-400 border border-gray-600/30"
            >
              {f.faction_name}
            </span>
          ))}
        </div>
      )}

      {/* Reputation bar */}
      {standings.length > 0 ? (
        <div className="space-y-1">
          <div className="flex w-full rounded overflow-visible">
            {standings.map((standing, i) => (
              <StandingSegment
                key={standing.sort_order ?? i}
                standing={standing}
                index={i}
                total={standings.length}
                widthPercent={normalizedWidths[i]}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            {maxRep > 0 && (
              <div className="flex justify-between flex-1 text-[10px] font-mono text-gray-600">
                <span>{standings[0].min_reputation.toLocaleString()}</span>
                <span>{maxRep.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs font-mono text-gray-600 italic">No standings defined</p>
      )}

      {/* Expandable standing details */}
      {standings.length > 0 && (
        <div className="border-t border-sc-border/50 pt-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors w-full py-1"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {standings.length} standing{standings.length !== 1 ? 's' : ''}
            {maxRep > 0 && <span className="text-gray-600 ml-1">· max {maxRep.toLocaleString()}</span>}
          </button>
          {expanded && (
            <div className="space-y-1 mt-1">
              {standings.map((standing, i) => {
                const color = getStandingColor(i, standings.length)
                const hasDrift = standing.drift_reputation != null && standing.drift_time_hours != null
                return (
                  <div key={standing.sort_order ?? i} className="flex items-start gap-2 py-1">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${color.bg} ${color.border} border`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${color.text}`}>{friendlyStandingName(standing.name)}</span>
                        {standing.is_gated && <Lock className="w-3 h-3 text-amber-400" />}
                        {hasDrift && <TrendingDown className="w-3 h-3 text-gray-600" />}
                        <span className="text-[10px] font-mono text-gray-600 ml-auto shrink-0">
                          {standing.min_reputation.toLocaleString()}+
                        </span>
                      </div>
                      {standing.perk_description && (
                        <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">
                          {standing.perk_description}
                        </p>
                      )}
                      {hasDrift && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-gray-600">
                          <TrendingDown className="w-3 h-3 shrink-0" />
                          Drifts to {standing.drift_reputation.toLocaleString()} over {standing.drift_time_hours}h
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Reputation() {
  const { data, loading, error, refetch } = useAPI('/gamedata/reputation')
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const factionFilter = searchParams.get('faction') || 'all'

  const setSearch = (val) => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (val) { next.set('q', val) } else { next.delete('q') }; return next }, { replace: true })
  const setFactionFilter = (val) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('faction', val); return next }, { replace: true })

  const scopes = data?.scopes || []

  // Build faction filter options from primary factions
  const factionOptions = useMemo(() => {
    const fMap = new Map()
    for (const scope of scopes) {
      const pf = scope.factions?.find((f) => f.is_primary)
      if (pf && !fMap.has(pf.faction_name)) {
        fMap.set(pf.faction_name, { name: pf.faction_name, count: 0 })
      }
      if (pf) fMap.get(pf.faction_name).count++
    }
    return Array.from(fMap.values()).sort((a, b) => b.count - a.count)
  }, [scopes])

  const filtered = useMemo(() => {
    let result = scopes
    if (factionFilter !== 'all') {
      result = result.filter((s) =>
        s.factions?.some((f) => f.is_primary && f.faction_name === factionFilter)
      )
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.scope_key && s.scope_key.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.standings?.some((st) => st.name.toLowerCase().includes(q) || friendlyStandingName(st.name).toLowerCase().includes(q)) ||
          s.factions?.some((f) => f.faction_name.toLowerCase().includes(q))
      )
    }
    return result
  }, [scopes, search, factionFilter])

  // Summary stats
  const stats = useMemo(() => {
    const totalStandings = scopes.reduce((n, s) => n + (s.standings?.filter((st) => st.name !== '<= PLACEHOLDER =>').length || 0), 0)
    const uniqueFactions = new Set()
    for (const s of scopes) {
      for (const f of s.factions || []) uniqueFactions.add(f.faction_name)
    }
    const gatedScopes = scopes.filter((s) =>
      s.standings?.some((st) => st.is_gated)
    ).length
    return { totalStandings, uniqueFactions: uniqueFactions.size, gatedScopes }
  }, [scopes])

  if (loading) return <LoadingState message="Loading reputation data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="REPUTATION"
        subtitle={`${scopes.length} reputation scopes across ${stats.uniqueFactions} factions`}
        actions={<Star className="w-5 h-5 text-gray-500" />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel px-3 py-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sc-accent shrink-0" />
          <div>
            <p className="text-sm font-display font-semibold text-white">{scopes.length}</p>
            <p className="text-[10px] font-mono text-gray-500 uppercase">Scopes</p>
          </div>
        </div>
        <div className="panel px-3 py-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-display font-semibold text-white">{stats.uniqueFactions}</p>
            <p className="text-[10px] font-mono text-gray-500 uppercase">Factions</p>
          </div>
        </div>
        <div className="panel px-3 py-2 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 shrink-0" />
          <div>
            <p className="text-sm font-display font-semibold text-white">{stats.totalStandings}</p>
            <p className="text-[10px] font-mono text-gray-500 uppercase">Standings</p>
          </div>
        </div>
        <div className="panel px-3 py-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-display font-semibold text-white">{stats.gatedScopes}</p>
            <p className="text-[10px] font-mono text-gray-500 uppercase">Gated</p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search scopes, standings, or factions..."
          className="flex-1 max-w-md"
        />
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFactionFilter('all')}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all ${
              factionFilter === 'all'
                ? 'bg-sc-accent/20 text-sc-accent border-sc-accent/40'
                : 'bg-transparent text-gray-500 border-sc-border hover:text-gray-300'
            }`}
          >
            All
          </button>
          {factionOptions.map((f) => (
            <button
              key={f.name}
              onClick={() => setFactionFilter(factionFilter === f.name ? 'all' : f.name)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all ${
                factionFilter === f.name
                  ? 'bg-sc-accent/20 text-sc-accent border-sc-accent/40'
                  : 'bg-transparent text-gray-500 border-sc-border hover:text-gray-300'
              }`}
            >
              {f.name} <span className="text-gray-600 ml-0.5">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">
          {filtered.length} scope{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map((scope) => (
          <ScopeCard key={scope.scope_key || scope.id} scope={scope} />
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">
          No scopes found.
        </div>
      )}
    </div>
  )
}
