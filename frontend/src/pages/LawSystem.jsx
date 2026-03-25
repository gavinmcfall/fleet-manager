import React, { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  felony:      'bg-red-900/50 text-red-300 border border-red-700/50',
  misdemeanor: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
}

function severityBadgeClass(severity) {
  if (!severity) return SEVERITY_BADGE.misdemeanor
  return SEVERITY_BADGE[severity.toLowerCase()] || SEVERITY_BADGE.misdemeanor
}

// ── Stat parsing helpers ──────────────────────────────────────────────────────

/** Build stats object from typed columns (was stats_json before migration 0098) */
function parseStats(infraction) {
  const stats = {}
  // Map snake_case DB columns → camelCase keys (matching overrides_json format)
  const mapping = {
    is_felony: 'isFelony',
    grace_allowance: 'graceAllowance',
    grace_allowance_cooldown: 'graceAllowanceCooldown',
    grace_period: 'gracePeriod',
    grace_cooloff_scale: 'graceCooloffScale',
    display_grace_time: 'displayGraceTime',
    escalated_fine_multiplier: 'escalatedPaymentFineMultiplier',
    early_payment_period: 'earlyPaymentPeriod',
    lifetime: 'lifetime',
    cool_off_time: 'coolOffTime',
    press_charges_notification_time: 'pressChargesNotificationTime',
    remove_time_seconds: 'removeTimeSeconds',
    felony_merits: 'felonyMerits',
    ignore_party_member: 'ignoreIfAgainstPartyMember',
    hide_crime_notification: 'hideCrimeNotification',
    hide_crime_journal: 'hideCrimeInJournal',
  }
  for (const [col, key] of Object.entries(mapping)) {
    if (infraction[col] != null) stats[key] = infraction[col]
  }
  return stats
}

function parseTriggers(infraction) {
  if (!infraction.triggers_json) return []
  try {
    const parsed = typeof infraction.triggers_json === 'string'
      ? JSON.parse(infraction.triggers_json)
      : infraction.triggers_json
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function parseOverridesJson(override) {
  if (!override.overrides_json) return {}
  try {
    return typeof override.overrides_json === 'string'
      ? JSON.parse(override.overrides_json)
      : override.overrides_json
  } catch { return {} }
}

function formatDuration(hours) {
  if (!hours || hours <= 0) return null
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const rem = hours % 24
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`
  }
  return `${hours}h`
}

function formatCoolOff(seconds) {
  if (!seconds || seconds <= 0) return null
  if (seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

function formatCredits(amount) {
  if (amount == null || amount === 0) return null
  return `${Number(amount).toLocaleString()} aUEC`
}

// ── Stat display row ──────────────────────────────────────────────────────────

function StatPill({ label, value, color = 'text-gray-300', title }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`${color}`}>{value}</span>
    </div>
  )
}

function InfractionStats({ stats }) {
  const pills = []

  if (stats.felonyMerits > 0) pills.push(
    <StatPill key="felony-merits" label="Felony Merits" value={stats.felonyMerits} color="text-green-300" title="Merit points specifically for clearing felony-level infractions" />
  )
  if (stats.lifetime) pills.push(
    <StatPill key="lifetime" label="Lifetime" value={formatDuration(stats.lifetime)} color="text-blue-400" title="How long this infraction stays on your record before expiring" />
  )
  if (stats.coolOffTime) pills.push(
    <StatPill key="cooloff" label="Cool-off" value={formatCoolOff(stats.coolOffTime)} color="text-amber-400" title="Time before this infraction can be triggered again" />
  )
  if (stats.escalatedPaymentFineMultiplier && stats.escalatedPaymentFineMultiplier !== 1) pills.push(
    <StatPill key="escalated" label="Escalated" value={`${stats.escalatedPaymentFineMultiplier}x`} color="text-orange-400" title="Fine multiplier applied when infraction is repeated or escalated" />
  )

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
      {pills}
    </div>
  )
}

// ── Infraction Card ───────────────────────────────────────────────────────────

function InfractionCard({ infraction, overrides }) {
  const stats = parseStats(infraction)
  const triggers = parseTriggers(infraction)
  const hasOverrides = overrides && overrides.length > 0

  return (
    <div className="panel p-4 flex flex-col h-full">
      {/* 1. Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-white text-sm leading-tight flex-1 min-w-0">
          {infraction.name}
        </h3>
        <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${severityBadgeClass(infraction.severity)}`}>
          {infraction.severity || 'Unknown'}
        </span>
      </div>

      {/* 2. Description */}
      {infraction.description && (
        <p className="text-xs text-gray-400 leading-relaxed mt-3">{infraction.description}</p>
      )}

      {/* 3. Metadata stats */}
      <div className="mt-3">
        <InfractionStats stats={stats} />
      </div>

      {/* 4. Jurisdiction overrides */}
      {hasOverrides && (
        <div className="space-y-1.5 pt-1 mt-3 border-t border-sc-border">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Jurisdiction overrides ({overrides.length})
          </span>
          <ul className="space-y-1">
            {overrides.map((ov) => {
              const parsed = parseOverridesJson(ov)
              const entries = Object.entries(parsed)
              return (
                <li key={`${ov.jurisdiction_id}-${ov.infraction_id}`} className="text-xs font-mono text-gray-300 flex items-start gap-2">
                  <span className="text-gray-500 shrink-0">-</span>
                  <span>
                    <span className="text-blue-400">{ov.jurisdiction_name}:</span>
                    {entries.map(([key, val]) => (
                      <span key={key} className="text-amber-400 ml-1.5">
                        {formatOverrideEntry(key, val)}
                      </span>
                    ))}
                    {entries.length === 0 && (
                      <span className="text-gray-500 ml-1.5 italic">custom enforcement</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 5. Triggers — always at bottom */}
      {triggers.length > 0 && (
        <div className="space-y-1 mt-auto pt-3">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Triggers</span>
          <div className="flex flex-wrap gap-1.5">
            {triggers.map((t, i) => (
              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-700/60 text-gray-400">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatOverrideEntry(key, value) {
  if (key === 'escalatedPaymentFineMultiplier') return `escalated fine ${value}x`
  if (key === 'fine') return `fine ${formatCredits(value)}`
  if (key === 'demeritPoints') return `demerits ${value}`
  if (key === 'meritPoints') return `merits ${value}`
  if (key === 'felonyMerits') return `felony merits ${value}`
  // Fallback: camelCase → spaced
  const label = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return `${label} ${value}`
}

// ── Jurisdiction Card ─────────────────────────────────────────────────────────

function JurisdictionCard({ jurisdiction, infractions, overrides }) {
  // Build a lookup of override data keyed by infraction_id
  const overrideMap = useMemo(() => {
    const map = {}
    if (overrides) {
      for (const ov of overrides) {
        map[ov.infraction_id] = ov
      }
    }
    return map
  }, [overrides])

  const overrideCount = overrides ? overrides.length : 0

  // Group infractions by severity
  const { felonies, misdemeanors } = useMemo(() => {
    if (!infractions) return { felonies: [], misdemeanors: [] }
    return {
      felonies: infractions.filter((i) => i.severity === 'felony'),
      misdemeanors: infractions.filter((i) => i.severity !== 'felony'),
    }
  }, [infractions])

  function renderInfractionRow(inf) {
    const ov = overrideMap[inf.id]
    const isModified = !!ov
    const parsed = ov ? parseOverridesJson(ov) : {}
    const entries = Object.entries(parsed)

    return (
      <div
        key={inf.id}
        className={`text-xs font-mono flex items-center gap-2 ${isModified ? 'text-amber-300' : 'text-gray-400'}`}
      >
        <span className={`shrink-0 ${isModified ? 'text-amber-500' : 'text-gray-600'}`}>
          {isModified ? '*' : '-'}
        </span>
        <span className="flex-1">
          <span className={isModified ? 'text-amber-300' : 'text-gray-400'}>
            {inf.name}
          </span>
          {isModified && entries.length > 0 && (
            <span className="text-amber-400/80 ml-1.5">
              ({entries.map(([key, val]) => formatOverrideEntry(key, val)).join(', ')})
            </span>
          )}
          {!isModified && (
            <span className="text-gray-600 ml-1.5 italic">standard</span>
          )}
        </span>
        <span className={`text-[10px] font-display uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
          inf.severity === 'felony'
            ? 'bg-red-900/50 text-red-300 border border-red-700/50'
            : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
        }`}>
          {inf.severity === 'felony' ? 'Felony' : 'Misd.'}
        </span>
      </div>
    )
  }

  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-white text-sm leading-tight flex-1 min-w-0">
          {jurisdiction.name}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {jurisdiction.is_prison === 1 && (
            <span className="text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700/50">
              Prison
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
        {jurisdiction.base_fine != null && jurisdiction.base_fine > 0 && (
          <StatPill label="Base fine" value={formatCredits(jurisdiction.base_fine)} color="text-sc-melt" />
        )}
        {jurisdiction.max_stolen_goods_scu != null && jurisdiction.max_stolen_goods_scu > 0 && (
          <StatPill label="Max stolen SCU" value={jurisdiction.max_stolen_goods_scu} color="text-orange-400" />
        )}
      </div>

      {/* Infraction enforcement list — grouped by severity */}
      {infractions && infractions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-sc-border">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">
            Enforcement ({infractions.length} infractions{overrideCount > 0 ? `, ${overrideCount} modified` : ''})
          </span>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {/* Felonies group */}
            {felonies.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-display uppercase tracking-wider text-red-400">
                    Felonies ({felonies.length})
                  </span>
                </div>
                {felonies.map(renderInfractionRow)}
              </div>
            )}

            {/* Misdemeanors group */}
            {misdemeanors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Scale className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] font-display uppercase tracking-wider text-yellow-400">
                    Misdemeanors ({misdemeanors.length})
                  </span>
                </div>
                {misdemeanors.map(renderInfractionRow)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LawSystem() {
  const { data, loading, error, refetch } = useAPI('/gamedata/law')
  const VALID_TABS = ['infractions', 'jurisdictions']
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab = VALID_TABS.includes(tabParam) ? tabParam : 'infractions'
  const setTab = useCallback((t) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (t === 'infractions') next.delete('tab')
      else next.set('tab', t)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const search = searchParams.get('search') || ''
  const setSearch = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('search', val)
      } else {
        next.delete('search')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

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

  // Infractions grouped by severity: felonies first, then misdemeanors, alphabetical within each
  const groupedInfractions = useMemo(() => {
    if (!data?.infractions) return { felonies: [], misdemeanors: [] }
    const q = search.toLowerCase()
    const filtered = search
      ? data.infractions.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description && i.description.toLowerCase().includes(q)) ||
            (i.severity && i.severity.toLowerCase().includes(q))
        )
      : data.infractions
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    return {
      felonies: sorted.filter((i) => i.severity === 'felony'),
      misdemeanors: sorted.filter((i) => i.severity !== 'felony'),
    }
  }, [data, search])

  const totalInfractions = groupedInfractions.felonies.length + groupedInfractions.misdemeanors.length

  const filteredJurisdictions = useMemo(() => {
    if (!data?.jurisdictions) return []
    if (!search) return data.jurisdictions
    const q = search.toLowerCase()
    return data.jurisdictions.filter(
      (j) => j.name.toLowerCase().includes(q)
    )
  }, [data, search])

  // For jurisdictions tab: all infractions sorted for the enforcement list
  const allInfractionsSorted = useMemo(() => {
    if (!data?.infractions) return []
    return [...data.infractions].sort((a, b) => {
      // Felonies first, then alphabetical
      if (a.severity === 'felony' && b.severity !== 'felony') return -1
      if (a.severity !== 'felony' && b.severity === 'felony') return 1
      return a.name.localeCompare(b.name)
    })
  }, [data])

  if (loading) return <LoadingState message="Loading law system..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const countLabel = tab === 'infractions'
    ? `${totalInfractions} infraction${totalInfractions !== 1 ? 's' : ''}`
    : `${filteredJurisdictions.length} jurisdiction${filteredJurisdictions.length !== 1 ? 's' : ''}`

  const isEmpty = tab === 'infractions' ? totalInfractions === 0 : filteredJurisdictions.length === 0

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

      {/* Infractions tab — grouped by severity */}
      {tab === 'infractions' && (
        <div className="space-y-6">
          {groupedInfractions.felonies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h2 className="font-display text-sm uppercase tracking-wider text-red-400">
                  Felonies ({groupedInfractions.felonies.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedInfractions.felonies.map((infraction) => (
                  <InfractionCard
                    key={infraction.id}
                    infraction={infraction}
                    overrides={overridesByInfraction[infraction.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {groupedInfractions.misdemeanors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-yellow-400" />
                <h2 className="font-display text-sm uppercase tracking-wider text-yellow-400">
                  Misdemeanors ({groupedInfractions.misdemeanors.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedInfractions.misdemeanors.map((infraction) => (
                  <InfractionCard
                    key={infraction.id}
                    infraction={infraction}
                    overrides={overridesByInfraction[infraction.id]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jurisdictions tab */}
      {tab === 'jurisdictions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredJurisdictions.map((jurisdiction) => (
            <JurisdictionCard
              key={jurisdiction.id}
              jurisdiction={jurisdiction}
              infractions={allInfractionsSorted}
              overrides={overridesByJurisdiction[jurisdiction.id]}
            />
          ))}
        </div>
      )}

      {isEmpty && !loading && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">
          No {tab} found.
        </div>
      )}
    </div>
  )
}
