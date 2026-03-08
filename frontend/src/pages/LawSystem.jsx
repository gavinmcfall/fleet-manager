import React, { useState, useMemo } from 'react'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Scale, AlertTriangle, Shield } from 'lucide-react'

const TABS = [
  { key: 'infractions', label: 'Infractions', icon: AlertTriangle },
  { key: 'jurisdictions', label: 'Jurisdictions', icon: Shield },
]

const SEVERITY_BADGE = {
  felony:       'bg-red-900/50 text-red-300 border border-red-700/50',
  misdemeanor:  'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  infraction:   'bg-gray-700/60 text-gray-400 border border-gray-600/50',
}

function severityBadgeClass(severity) {
  if (!severity) return SEVERITY_BADGE.infraction
  return SEVERITY_BADGE[severity.toLowerCase()] || SEVERITY_BADGE.infraction
}

function formatGracePeriod(seconds) {
  if (!seconds || seconds <= 0) return null
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s grace period` : `${mins}m grace period`
  }
  return `${seconds}s grace period`
}

function formatMultiplier(value) {
  if (value == null) return '1.0x'
  return `${parseFloat(value).toFixed(1)}x`
}

function formatCredits(amount) {
  if (amount == null || amount === 0) return null
  return `${amount.toLocaleString()} aUEC`
}

function InfractionCard({ infraction, overrides }) {
  const grace = formatGracePeriod(infraction.grace_period_seconds)
  const fine = formatCredits(infraction.fine_amount)
  const hasOverrides = overrides && overrides.length > 0

  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-white text-sm leading-tight">
            {infraction.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {infraction.is_felony === 1 && (
            <span className="text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700/50">
              Felony
            </span>
          )}
          <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded ${severityBadgeClass(infraction.severity)}`}>
            {infraction.severity || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Type */}
      {infraction.infraction_type && (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-700/60 text-gray-400">
          {infraction.infraction_type}
        </span>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        {fine && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Fine</span>
            <span className="text-sc-melt">{fine}</span>
          </div>
        )}
        {infraction.demerit_points > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Demerits</span>
            <span className="text-red-400">{infraction.demerit_points}</span>
          </div>
        )}
        {infraction.merit_points > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Merits</span>
            <span className="text-green-400">{infraction.merit_points}</span>
          </div>
        )}
      </div>

      {/* Grace period */}
      {grace && (
        <div className="text-[10px] font-mono text-amber-400/80 italic">{grace}</div>
      )}

      {/* Description */}
      {infraction.description && (
        <p className="text-xs text-gray-400 leading-relaxed">{infraction.description}</p>
      )}

      {/* Jurisdiction overrides indicator */}
      {hasOverrides && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400/80">
          <Shield className="w-3 h-3" />
          <span>Varies by jurisdiction ({overrides.length})</span>
        </div>
      )}
    </div>
  )
}

function JurisdictionCard({ jurisdiction, overrides }) {
  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-white text-sm leading-tight">
          {jurisdiction.name}
        </h3>
      </div>

      {/* Description */}
      {jurisdiction.description && (
        <p className="text-xs text-gray-400 leading-relaxed">{jurisdiction.description}</p>
      )}

      {/* Default multipliers */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Fine mult</span>
          <span className="text-sc-melt">{formatMultiplier(jurisdiction.default_fine_multiplier)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Merit mult</span>
          <span className="text-green-400">{formatMultiplier(jurisdiction.default_merit_multiplier)}</span>
        </div>
      </div>

      {/* Overrides */}
      {overrides && overrides.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-sc-border">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">
            Local overrides
          </span>
          <ul className="space-y-1">
            {overrides.map((ov) => (
              <li key={ov.id} className="text-xs font-mono text-gray-300 flex items-start gap-2">
                <span className="text-gray-500 shrink-0">-</span>
                {ov.is_suppressed ? (
                  <span>
                    <span className="text-gray-400">{ov.infraction_name}</span>
                    <span className="text-green-400/80 ml-1.5">not enforced</span>
                  </span>
                ) : (
                  <span>
                    <span className="text-gray-400">{ov.infraction_name}:</span>
                    {ov.fine_override != null && (
                      <span className="text-sc-melt ml-1.5">fine {ov.fine_override.toLocaleString()}</span>
                    )}
                    {ov.demerit_override != null && (
                      <span className="text-red-400 ml-1.5">demerits {ov.demerit_override}</span>
                    )}
                    {ov.merit_override != null && (
                      <span className="text-green-400 ml-1.5">merits {ov.merit_override}</span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function LawSystem() {
  const { data, loading, error, refetch } = useAPI('/gamedata/law')
  const [tab, setTab] = useState('infractions')
  const [search, setSearch] = useState('')

  // Index overrides by infraction and jurisdiction
  const overridesByInfraction = useMemo(() => {
    if (!data?.overrides) return {}
    const map = {}
    for (const ov of data.overrides) {
      if (!map[ov.infraction_id]) map[ov.infraction_id] = []
      map[ov.infraction_id].push(ov)
    }
    return map
  }, [data])

  const overridesByJurisdiction = useMemo(() => {
    if (!data?.overrides) return {}
    const map = {}
    for (const ov of data.overrides) {
      if (!map[ov.jurisdiction_id]) map[ov.jurisdiction_id] = []
      map[ov.jurisdiction_id].push(ov)
    }
    return map
  }, [data])

  const filteredInfractions = useMemo(() => {
    if (!data?.infractions) return []
    if (!search) return data.infractions
    const q = search.toLowerCase()
    return data.infractions.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.infraction_type && i.infraction_type.toLowerCase().includes(q)) ||
        (i.severity && i.severity.toLowerCase().includes(q))
    )
  }, [data, search])

  const filteredJurisdictions = useMemo(() => {
    if (!data?.jurisdictions) return []
    if (!search) return data.jurisdictions
    const q = search.toLowerCase()
    return data.jurisdictions.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        (j.description && j.description.toLowerCase().includes(q))
    )
  }, [data, search])

  if (loading) return <LoadingState message="Loading law system..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const items = tab === 'infractions' ? filteredInfractions : filteredJurisdictions
  const countLabel = tab === 'infractions'
    ? `${filteredInfractions.length} infraction${filteredInfractions.length !== 1 ? 's' : ''}`
    : `${filteredJurisdictions.length} jurisdiction${filteredJurisdictions.length !== 1 ? 's' : ''}`

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="LAW SYSTEM"
        subtitle="Infractions, fines, and jurisdiction enforcement across the Stanton system"
        actions={<Scale className="w-5 h-5 text-gray-500" />}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
                tab === t.key
                  ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
                  : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={`Search ${tab}...`}
        className="max-w-md"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">{countLabel}</span>
      </div>

      {tab === 'infractions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredInfractions.map((infraction) => (
            <InfractionCard
              key={infraction.id}
              infraction={infraction}
              overrides={overridesByInfraction[infraction.id]}
            />
          ))}
        </div>
      )}

      {tab === 'jurisdictions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredJurisdictions.map((jurisdiction) => (
            <JurisdictionCard
              key={jurisdiction.id}
              jurisdiction={jurisdiction}
              overrides={overridesByJurisdiction[jurisdiction.id]}
            />
          ))}
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">
          No {tab} found.
        </div>
      )}
    </div>
  )
}
