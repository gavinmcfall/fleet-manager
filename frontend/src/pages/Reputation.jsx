import React, { useState, useMemo } from 'react'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Star, Lock, TrendingDown } from 'lucide-react'

/** Color based on position index within the standings list (0 = worst, last = best) */
const STANDING_COLORS = [
  { bg: 'bg-red-900/50', text: 'text-red-300', border: 'border-red-700/40', bar: 'bg-red-700/60' },
  { bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-700/40', bar: 'bg-orange-700/60' },
  { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700/40', bar: 'bg-yellow-700/60' },
  { bg: 'bg-emerald-900/50', text: 'text-emerald-300', border: 'border-emerald-700/40', bar: 'bg-emerald-700/60' },
  { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700/40', bar: 'bg-green-700/60' },
]

function getStandingColor(index, total) {
  if (total <= 1) return STANDING_COLORS[2] // neutral yellow for single-standing scopes
  const ratio = index / (total - 1)
  const colorIndex = Math.min(Math.floor(ratio * STANDING_COLORS.length), STANDING_COLORS.length - 1)
  return STANDING_COLORS[colorIndex]
}

/** Format scope_key for display: strip leading namespace before first underscore if it matches name, replace remaining underscores with spaces */
function formatScopeKey(scopeKey) {
  if (!scopeKey) return ''
  return scopeKey.replace(/_/g, ' ')
}

function StandingSegment({ standing, index, total, widthPercent }) {
  const color = getStandingColor(index, total)
  const hasDrift = standing.drift_reputation != null && standing.drift_time_hours != null

  return (
    <div className="group relative" style={{ width: `${Math.max(widthPercent, 6)}%` }}>
      {/* Bar segment */}
      <div
        className={`h-7 ${color.bar} border-r border-sc-bg/60 flex items-center justify-center gap-1 cursor-default transition-all duration-150 group-hover:brightness-125 ${index === 0 ? 'rounded-l' : ''} ${index === total - 1 ? 'rounded-r' : ''}`}
        title={`${standing.name}: ${standing.min_reputation}+ rep${standing.is_gated ? ' (Gated)' : ''}${hasDrift ? ` — Drifts to ${standing.drift_reputation} over ${standing.drift_time_hours}h` : ''}`}
      >
        {standing.is_gated && <Lock className="w-3 h-3 text-current opacity-70 shrink-0" />}
        <span className={`text-[10px] font-mono truncate ${color.text}`}>
          {standing.name}
        </span>
      </div>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded bg-sc-panel border border-sc-border shadow-xl z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
        <p className={`text-xs font-display font-semibold ${color.text}`}>
          {standing.name}
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
  // Standings arrive sorted by sort_order from the backend
  const standings = scope.standings || []
  const gatedCount = standings.filter((s) => s.is_gated).length
  const maxRep = scope.max_reputation || 0

  // Compute proportional widths: use reputation ranges when possible, equal widths as fallback
  const widths = useMemo(() => {
    if (standings.length === 0) return []
    if (maxRep === 0 || standings.length === 1) {
      return standings.map(() => 100 / standings.length)
    }
    return standings.map((s, i) => {
      const nextMin = i < standings.length - 1 ? standings[i + 1].min_reputation : maxRep
      const range = nextMin - s.min_reputation
      const pct = (range / maxRep) * 100
      // Clamp to at least 1% so zero-range standings are still visible
      return Math.max(pct, 1)
    })
  }, [standings, maxRep])

  // Normalize widths so they sum to 100
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const normalizedWidths = totalWidth > 0
    ? widths.map((w) => (w / totalWidth) * 100)
    : widths

  const subtitle = formatScopeKey(scope.scope_key)

  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-white text-sm leading-tight">
            {scope.name}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-mono text-gray-500 mt-0.5">{subtitle}</p>
          )}
          {scope.description && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{scope.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gatedCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
              <Lock className="w-3 h-3" />
              {gatedCount}
            </span>
          )}
          {maxRep > 0 && (
            <span className="text-[10px] font-mono text-gray-500 bg-sc-bg/50 border border-sc-border px-2 py-0.5 rounded">
              Max {maxRep.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Reputation bar */}
      {standings.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">
              {standings.length} standing{standings.length !== 1 ? 's' : ''}
            </span>
          </div>
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
          {maxRep > 0 && (
            <div className="flex justify-between text-[10px] font-mono text-gray-600">
              <span>{standings[0].min_reputation.toLocaleString()}</span>
              <span>{maxRep.toLocaleString()}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs font-mono text-gray-600 italic">No standings defined</p>
      )}

      {/* Standing details list */}
      {standings.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-sc-border/50">
          {standings.map((standing, i) => {
            const color = getStandingColor(i, standings.length)
            const hasDrift = standing.drift_reputation != null && standing.drift_time_hours != null
            return (
              <div key={standing.sort_order ?? i} className="flex items-start gap-2 py-1">
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${color.bg} ${color.border} border`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${color.text}`}>{standing.name}</span>
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
  )
}

export default function Reputation() {
  const { data, loading, error, refetch } = useAPI('/gamedata/reputation')
  const [search, setSearch] = useState('')

  const scopes = data?.scopes || []

  const filtered = useMemo(() => {
    if (!search) return scopes
    const q = search.toLowerCase()
    return scopes.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.scope_key && s.scope_key.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.standings?.some((st) => st.name.toLowerCase().includes(q))
    )
  }, [scopes, search])

  if (loading) return <LoadingState message="Loading reputation data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="REPUTATION"
        subtitle={`${scopes.length} scope${scopes.length !== 1 ? 's' : ''} with reputation tracking`}
        actions={<Star className="w-5 h-5 text-gray-500" />}
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search scopes or standings..."
        className="max-w-md"
      />

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
