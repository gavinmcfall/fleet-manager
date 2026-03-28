import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Package, Users, Crosshair, Shield, Coins, AlertTriangle, FileText, Star, MapPin, FlaskConical, Building2, Clock, Lock, Ban, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useContracts, useAPI, useMissionGivers } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import StatCard from '../components/StatCard'
import { FACTION_LOGOS, getFactionLogo, GUILD_LABELS, cleanMissionDescription, humanizeFactionSlug, humanizeScopeSlug, humanizeStandingSlug, humanizeComparison, formatRepReward, formatRepRequirement } from '../lib/missionConstants'

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border whitespace-nowrap ${
        active
          ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
          : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}

// ── Source / type badges ────────────────────────────────────────────────────

const SOURCE_BADGE = {
  contract:       { label: 'Contract', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  mission_board:  { label: 'Board', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  service_beacon: { label: 'Beacon', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  dynamic:        { label: 'Dynamic', style: 'bg-white/[0.04] text-gray-500 border-white/[0.06]' },
}

const CATEGORY_LABELS = {
  Bounty: 'Bounty', Cargo: 'Cargo', Cave: 'Cave', Collection: 'Collection',
  Defense: 'Defense', Delivery: 'Delivery', General: 'General', Investigation: 'Investigation',
  Mercenary: 'Mercenary', Mining: 'Mining', Prison: 'Prison', Retrieval: 'Retrieval',
  Salvage: 'Salvage', 'Search & Rescue': 'Search & Rescue', Support: 'Support',
  'Combat Gauntlet': 'Combat Gauntlet', 'Navy Patrol Training': 'Navy Patrol',
  'Small Items': 'Collection', 'Standard': 'Collection', 'Favours': 'Favours',
  'Vehicle Delivery': 'Delivery', 'Waste Disposal': 'Collection',
  'Synced Assassination': 'Bounty', Events: 'Events', 'Combined Ops': 'Combined',
  Recovery: 'Recovery', Theft: 'Theft', Tutorial: 'Tutorial', Exploration: 'Exploration',
}

function deriveSystem(locationRef, locality) {
  const val = (locationRef || locality || '').toLowerCase()
  if (val.includes('stanton') || val.startsWith('stanton')) return 'Stanton'
  if (val.includes('pyro') || val.startsWith('pyro')) return 'Pyro'
  if (val.includes('nyx') || val.startsWith('nyx')) return 'Nyx'
  return null
}

function playerCountLabel(maxPlayers) {
  if (maxPlayers == null) return null
  if (maxPlayers === 1) return { label: 'Solo', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20' }
  if (maxPlayers > 50) return { label: 'Server Event', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
  if (maxPlayers >= 2) return { label: `Group (${maxPlayers})`, style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
  if (maxPlayers === -1) return { label: 'Unlimited', style: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
  return null
}

const SYSTEM_BADGE_STYLES = {
  Stanton: 'bg-sc-accent/10 text-sc-accent border-sc-accent/20',
  Nyx: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Pyro: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

function parseRequirements(json) {
  if (!json || json === 'random') return null
  try {
    const reqs = JSON.parse(json)
    return reqs.length > 0 ? reqs : null
  } catch { return null }
}

// ── Expanded section (3-zone layout) ───────────────────────────────────────

function RepRewardCell({ raw }) {
  if (!raw) return null
  const parts = formatRepReward(raw)
  if (!parts) return null
  return (
    <div className="space-y-0.5">
      {parts.map((p, i) => {
        const isPositive = p.amount.startsWith('+')
        const isNegative = p.amount.startsWith('-')
        return (
          <div key={i} className="flex items-center gap-1.5">
            {isPositive ? <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" /> :
             isNegative ? <TrendingDown className="w-3 h-3 text-red-400 shrink-0" /> :
             <Minus className="w-3 h-3 text-gray-500 shrink-0" />}
            <span className={`text-[11px] font-mono ${isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-gray-400'}`}>
              {p.amount}
            </span>
            <span className="text-[11px] font-mono text-gray-500">{p.faction}</span>
          </div>
        )
      })}
    </div>
  )
}

function ExpandedSection({ entry, prerequisites, repRequirements }) {
  const [descExpanded, setDescExpanded] = useState(false)
  const [prereqsExpanded, setPrereqsExpanded] = useState(false)

  const system = deriveSystem(entry.location_ref, entry.locality)
  const players = playerCountLabel(entry.max_players)
  const source = SOURCE_BADGE[entry.source] || SOURCE_BADGE.dynamic
  const requirements = parseRequirements(entry.requirements_json)

  // Clean description
  const briefingText = cleanMissionDescription(entry.description)
  const DESC_MAX = 280
  const isLongDesc = briefingText.length > DESC_MAX
  const displayDesc = isLongDesc && !descExpanded ? briefingText.slice(0, DESC_MAX) + '...' : briefingText

  // Prerequisites / rep requirements
  const mId = entry.mission_id
  const prereqs = (entry.source !== 'contract' && mId != null) ? prerequisites?.[mId] : null
  const repReqs = (entry.source !== 'contract' && mId != null) ? repRequirements?.[mId] : null
  const hasPrereqs = prereqs?.length > 0
  const hasRepReqs = repReqs?.length > 0
  const hasRepRewards = entry.rep_summary || entry.rep_fail || entry.rep_abandon
  const hasCrimeWarnings = entry.fail_if_criminal === 1 || entry.wanted_level_min > 0
  const hasRequirementsSection = hasPrereqs || hasRepReqs || hasRepRewards || hasCrimeWarnings || requirements

  // Reward display
  const reward = entry.reward_amount || 0
  const rewardText = (() => {
    if (entry.reward_text) return entry.reward_text
    if (reward <= 0) return null
    if (entry.reward_max > 0 && entry.reward_max !== reward) {
      return `${reward.toLocaleString()} - ${entry.reward_max.toLocaleString()} aUEC`
    }
    return `${reward.toLocaleString()} aUEC`
  })()

  return (
    <div className="px-4 pb-4 space-y-0">
      {/* ── Zone 1: Mission Intel Bar ────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 border-b border-white/[0.04]">
        {/* Left group: source, category, system */}
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.giver_display && (
            <span className="text-[11px] font-mono text-gray-400">{entry.giver_display}</span>
          )}
          {entry.giver_display && entry.category_display && (
            <span className="text-gray-700 select-none">/</span>
          )}
          {entry.category_display && (
            <span className="text-[11px] font-mono text-gray-500">{entry.category_display}</span>
          )}
          {system && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${SYSTEM_BADGE_STYLES[system] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
              <MapPin className="w-3 h-3" />{system}
            </span>
          )}
        </div>

        {/* Center group: time limit, player count, one-time, prison */}
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.time_limit_minutes != null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
              <Clock className="w-3 h-3" />{entry.time_limit_minutes} min
            </span>
          )}
          {players && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${players.style}`}>
              <Users className="w-3 h-3" />{players.label}
            </span>
          )}
          {entry.once_only === 1 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
              One-time
            </span>
          )}
          {entry.available_in_prison === 1 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-gray-500/10 text-gray-400 border-gray-500/20">
              <Lock className="w-3 h-3" />Prison
            </span>
          )}
        </div>

        {/* Right group: reward, buy-in */}
        <div className="flex items-center gap-2 ml-auto">
          {entry.buy_in_amount > 0 && (
            <span className="text-[10px] font-mono text-gray-500">
              Buy-in: <span className="text-sc-warn">{entry.buy_in_amount.toLocaleString()}</span>
            </span>
          )}
          {rewardText && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border bg-sc-warn/10 text-sc-warn border-sc-warn/20">
              <Coins className="w-3 h-3" />{rewardText}
              {entry.has_standing_bonus === 1 && <span className="text-emerald-400" title="Standing bonus available">+</span>}
            </span>
          )}
          {entry.sequence_num != null && (
            <span className="text-[10px] font-mono text-gray-600">#{entry.sequence_num}</span>
          )}
        </div>
      </div>

      {/* ── Zone 2: Mission Briefing ─────────────────────────── */}
      <div className="py-3">
        {/* Crime warnings — red alert bar */}
        {hasCrimeWarnings && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-red-500/[0.07] border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              {entry.fail_if_criminal === 1 && (
                <span className="text-red-400">Fails if CrimStat gained</span>
              )}
              {entry.wanted_level_min > 0 && (
                <span className="text-red-400">Requires CrimStat {entry.wanted_level_min}+</span>
              )}
              {entry.wanted_level_max > 0 && entry.wanted_level_max < 99 && (
                <span className="text-amber-400">Max CrimStat: {entry.wanted_level_max}</span>
              )}
            </div>
          </div>
        )}

        {/* Linked reward (contract-specific) */}
        {(entry.reward_vehicle_slug || entry.reward_item_uuid) && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-sc-accent2/[0.07] border border-sc-accent2/20">
            <Trophy className="w-4 h-4 text-sc-accent2 shrink-0" />
            <span className="text-xs font-mono text-gray-400">Reward:</span>
            {entry.reward_vehicle_slug && (
              <Link to={`/ships/${entry.reward_vehicle_slug}`} className="text-xs font-mono text-sc-accent2 hover:text-sc-accent transition-colors">{entry.reward_text}</Link>
            )}
            {entry.reward_item_uuid && (
              <Link to={`/loot/${entry.reward_item_uuid}`} className="text-xs font-mono text-sc-accent2 hover:text-sc-accent transition-colors">{entry.reward_text}</Link>
            )}
          </div>
        )}

        {/* Description */}
        {briefingText ? (
          <div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{displayDesc}</p>
            {isLongDesc && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="text-xs text-sc-accent/70 hover:text-sc-accent mt-1 transition-colors"
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-600 italic">No description available</p>
        )}

        {entry.notes && (
          <p className="text-[11px] font-mono text-amber-400/80 italic mt-2">{entry.notes}</p>
        )}
      </div>

      {/* ── Zone 3: Mission Requirements ─────────────────────── */}
      {hasRequirementsSection && (
        <div className="border-t border-white/[0.04] pt-3 space-y-3">

          {/* Contract requirements (delivery items) */}
          {requirements && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Package className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Delivery Requirements</span>
              </div>
              <ul className="space-y-0.5 pl-1">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-mono text-gray-300">
                    <span className="text-sc-accent2 min-w-[2ch] text-right">{req.quantity}x</span>
                    <span>{req.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.requirements_json === 'random' && (
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-mono text-gray-500 italic">Requirements randomized each time</span>
            </div>
          )}

          {/* Prerequisites (mission chain) */}
          {hasPrereqs && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400/70" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70">
                  Prerequisites ({prereqs.length})
                </span>
                {prereqs.length > 3 && (
                  <button
                    onClick={() => setPrereqsExpanded(!prereqsExpanded)}
                    className="text-[10px] text-amber-400/50 hover:text-amber-400 transition-colors ml-1"
                  >
                    {prereqsExpanded ? 'collapse' : 'show all'}
                  </button>
                )}
              </div>
              <ol className="space-y-0.5 pl-1">
                {(prereqs.length <= 3 || prereqsExpanded ? prereqs : prereqs.slice(0, 3)).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-amber-400/50 font-mono min-w-[1.5ch] text-right shrink-0">{i + 1}.</span>
                    <span className="text-gray-300">{p.title}</span>
                  </li>
                ))}
                {prereqs.length > 3 && !prereqsExpanded && (
                  <li className="text-[10px] text-amber-400/40 font-mono pl-5">
                    +{prereqs.length - 3} more
                  </li>
                )}
              </ol>
            </div>
          )}

          {/* Reputation requirements */}
          {hasRepReqs && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star className="w-3.5 h-3.5 text-blue-400/70" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400/70">Reputation Required</span>
              </div>
              <ul className="space-y-1 pl-1">
                {repReqs.map((r, i) => {
                  const fmt = formatRepRequirement(r)
                  if (!fmt) return null
                  return (
                    <li key={i} className="text-xs text-gray-300">
                      <span className="text-blue-400">{fmt.standing}</span>
                      <span className="text-gray-500"> {fmt.cmp} with </span>
                      <span className="font-medium text-gray-200">{fmt.faction}</span>
                      {fmt.scope && (
                        <span className="text-gray-600 ml-1">({fmt.scope})</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Rep rewards table: success / fail / abandon */}
          {hasRepRewards && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Reputation Rewards</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {entry.rep_summary && (
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/60 block mb-1">Success</span>
                    <RepRewardCell raw={entry.rep_summary} />
                  </div>
                )}
                {entry.rep_fail && (
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-red-400/60 block mb-1">Fail</span>
                    <RepRewardCell raw={entry.rep_fail} />
                  </div>
                )}
                {entry.rep_abandon && (
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-red-400/60 block mb-1">Abandon</span>
                    <RepRewardCell raw={entry.rep_abandon} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Unified row ─────────────────────────────────────────────────────────────

function EntryRow({ entry, repFocus, isHighlighted, highlightRef, prerequisites, repRequirements }) {
  const [expanded, setExpanded] = useState(isHighlighted)
  const source = SOURCE_BADGE[entry.source] || SOURCE_BADGE.dynamic
  const reward = entry.reward_amount || 0

  // Extract focused rep amount if filtering by rep
  let focusedRep = null
  if (repFocus && entry.rep_summary) {
    const match = entry.rep_summary.split(', ').find(p => p.startsWith(repFocus + ':'))
    if (match) focusedRep = match.split(':')[1]?.trim()
  }

  return (
    <div ref={highlightRef} className={`border-b border-sc-border/30 last:border-0 ${isHighlighted ? 'bg-sc-accent/[0.06] ring-1 ring-sc-accent/20 rounded' : ''}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-200">{entry.title}</span>
          {entry.giver_display && (
            <span className="text-[10px] text-gray-500 ml-2 font-mono hidden sm:inline">{entry.giver_display}</span>
          )}
        </div>
        <span className={`w-[4.5rem] text-center text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${source.style}`}>
          {source.label}
        </span>
        {repFocus ? (
          <span className="w-28 text-right text-xs font-mono shrink-0">
            {focusedRep ? (
              <span className={focusedRep.includes('+') ? 'text-emerald-400' : 'text-red-400'}>{focusedRep} rep</span>
            ) : <span className="text-gray-700">—</span>}
          </span>
        ) : (
          <span className="w-48 text-right text-xs font-mono shrink-0" title={entry.reward_text || ''}>
            {entry.reward_text ? (
              <span className={entry.reward_vehicle_slug ? 'text-sc-accent2' : entry.reward_currency === 'MG Scrip' ? 'text-blue-300' : 'text-sc-warn'}>
                {entry.reward_text}
              </span>
            ) : reward > 0 ? (
              <>
                <span className="text-sc-warn">
                  {entry.reward_max > 0 && entry.reward_max !== reward
                    ? `${reward.toLocaleString()} - ${entry.reward_max.toLocaleString()}`
                    : reward.toLocaleString()}
                </span>
                {' '}<span className="text-gray-600">aUEC</span>
                {entry.has_standing_bonus === 1 && <span className="text-emerald-400 ml-1" title="Standing bonus available">+</span>}
              </>
            ) : (
              <span className="text-gray-700">—</span>
            )}
          </span>
        )}
        <span className="w-16 text-center shrink-0">
          {entry.is_unlawful && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Unlawful</span>
          )}
        </span>
        <span className="w-5 shrink-0 flex items-center justify-center">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </span>
      </button>
      {expanded && <ExpandedSection entry={entry} prerequisites={prerequisites} repRequirements={repRequirements} />}
    </div>
  )
}

// ── Faction cards (contract generators) ────────────────────────────────────

const SYSTEM_PILL_COLORS = {
  Stanton: 'bg-sc-accent/10 text-sc-accent', Nyx: 'bg-purple-500/10 text-purple-400', Pyro: 'bg-orange-500/10 text-orange-400',
}

function FactionCard({ faction }) {
  const logo = FACTION_LOGOS[faction.name] || FACTION_LOGOS[faction.faction_name]
  const guild = GUILD_LABELS[faction.guild] || ''
  // Always link to faction page by slug
  const factionSlug = faction.faction_slug || faction.name.toLowerCase().replace(/\s+/g, '')
  const linkTo = `/missions/faction/${factionSlug}`
  return (
    <Link
      to={linkTo}
      className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-sc-accent/25 hover:bg-white/[0.04] transition-all group flex gap-4"
    >
      {logo ? (
        <img src={logo} alt="" className="w-16 h-16 rounded-lg border border-white/[0.06] object-cover shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6 text-gray-700" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          {guild && <span className="text-[9px] text-gray-600 uppercase tracking-wider">{guild}</span>}
          {faction.mission_types.slice(0, 3).map(t => (
            <span key={t} className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{t}</span>
          ))}
          {faction.mission_types.length > 3 && (
            <span className="text-[9px] text-gray-600">+{faction.mission_types.length - 3} more</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-white group-hover:text-sc-accent transition-colors truncate">{faction.name}</h3>
        {faction.focus && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{faction.focus}</p>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {faction.systems.map(sys => (
            <span key={sys} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${SYSTEM_PILL_COLORS[sys] || 'bg-gray-500/10 text-gray-400'}`}>
              <MapPin className="w-2.5 h-2.5" />{sys}
            </span>
          ))}
          {faction.blueprint_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FlaskConical className="w-2.5 h-2.5" />{faction.blueprint_count} blueprints
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Missions() {
  const { data: contracts, loading: cLoading, error: cError } = useContracts()
  const { data: missionData, loading: mLoading, error: mError } = useAPI('/gamedata/missions')
  const { data: missionGivers, loading: gLoading } = useMissionGivers()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') || ''
  const view = searchParams.get('view') || 'all'
  const sourceFilter = searchParams.get('source') || ''
  const categoryFilter = searchParams.get('cat') || ''
  const typeFilter = searchParams.get('type') || ''
  const giverFilter = searchParams.get('giver') || ''
  const repFilter = searchParams.get('rep') || ''
  const highlightId = searchParams.get('highlight') || ''
  const guildFilter = searchParams.get('guild') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const PAGE_SIZE = 50

  const setParam = useCallback((key, val, replace = false) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      // Reset page when changing any filter (but not page itself)
      if (key !== 'page') next.delete('page')
      return next
    }, { replace })
  }, [setSearchParams])
  const setParams = useCallback((updates, replace = false) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      let hasNonPageChange = false
      for (const [key, val] of Object.entries(updates)) {
        if (val) next.set(key, val)
        else next.delete(key)
        if (key !== 'page') hasNonPageChange = true
      }
      // Reset page when changing any filter
      if (hasNonPageChange && !('page' in updates)) next.delete('page')
      return next
    }, { replace })
  }, [setSearchParams])

  // Normalize contracts + missions into one list
  const allEntries = useMemo(() => {
    const entries = []

    // Contracts → unified shape
    for (const c of (contracts || [])) {
      entries.push({
        id: `c-${c.id}`,
        mission_id: null,
        contract_id: c.id,
        title: c.title,
        description: c.description,
        source: 'contract',
        category: c.category,
        category_display: c.category,
        giver_display: { wikelo: 'Wikelo', gfs: "Gilly's Flight School", ruto: 'Ruto' }[c.giver_slug] || c.giver_slug,
        giver_slug: c.giver_slug || null,
        reward_amount: c.reward_amount || 0,
        reward_text: c.reward_text || null,
        reward_currency: c.reward_currency,
        reward_vehicle_slug: c.reward_vehicle_slug,
        reward_item_uuid: c.reward_item_uuid,
        is_unlawful: false,
        requirements_json: c.requirements_json,
        sequence_num: c.sequence_num,
        notes: c.notes,
        type_slug: null,
        rep_summary: null,
      })
    }

    // Missions → unified shape
    for (const m of (missionData?.missions || [])) {
      entries.push({
        id: `m-${m.id}`,
        mission_id: m.id,
        contract_id: null,
        title: m.title,
        description: m.description,
        source: m.availability || 'dynamic',
        category: m.category,
        category_display: CATEGORY_LABELS[m.category] || m.category,
        giver_display: (m.giver_name && m.giver_name !== 'SENDER NOT FOUND') ? m.giver_name : null,
        giver_slug: m.giver_slug || null,
        reward_amount: m.reward_amount || 0,
        reward_text: null,
        reward_currency: 'aUEC',
        reward_vehicle_slug: null,
        reward_item_uuid: null,
        is_unlawful: !m.is_lawful,
        requirements_json: null,
        sequence_num: null,
        notes: null,
        type_slug: m.type_slug,
        rep_summary: m.rep_summary,
        contract_key: m.contract_key || null,
        // Enriched mission fields
        time_limit_minutes: m.time_limit_minutes ?? null,
        max_players: m.max_players ?? null,
        can_share: m.can_share ?? 0,
        once_only: m.once_only ?? 0,
        fail_if_criminal: m.fail_if_criminal ?? 0,
        available_in_prison: m.available_in_prison ?? 0,
        wanted_level_min: m.wanted_level_min ?? 0,
        wanted_level_max: m.wanted_level_max ?? 0,
        buy_in_amount: m.buy_in_amount ?? 0,
        reward_max: m.reward_max ?? 0,
        has_standing_bonus: m.has_standing_bonus ?? 0,
        location_ref: m.location_ref ?? null,
        locality: m.locality ?? null,
        rep_fail: m.rep_fail ?? null,
        rep_abandon: m.rep_abandon ?? null,
      })
    }

    return entries
  }, [contracts, missionData])

  // Categories + source counts for filters
  const categories = useMemo(() => {
    const counts = {}
    for (const e of allEntries) counts[e.category] = (counts[e.category] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [allEntries])

  // Group categories by display label to avoid duplicates like "Delivery" appearing twice
  const displayCategories = useMemo(() => {
    const grouped = {}
    for (const [raw, count] of categories) {
      const label = CATEGORY_LABELS[raw] || raw
      if (!grouped[label]) grouped[label] = { label, rawValues: [], count: 0 }
      grouped[label].rawValues.push(raw)
      grouped[label].count += count
    }
    return Object.values(grouped).sort((a, b) => b.count - a.count)
  }, [categories])

  // Filter
  const filtered = useMemo(() => {
    let items = allEntries
    if (sourceFilter) items = items.filter(e => e.source === sourceFilter)
    if (categoryFilter) {
      // categoryFilter is a display label — find all raw values that map to it
      const matchingGroup = displayCategories.find(dc => dc.label === categoryFilter)
      if (matchingGroup) {
        const rawSet = new Set(matchingGroup.rawValues)
        items = items.filter(e => rawSet.has(e.category))
      } else {
        // Fallback: try direct match on raw category
        items = items.filter(e => e.category === categoryFilter)
      }
    }
    if (typeFilter) items = items.filter(e => e.type_slug === typeFilter || e.type_slug === ('missiontype-' + typeFilter.replace('missiontype-', '')))
    if (giverFilter) items = items.filter(e => e.giver_display === giverFilter)
    if (repFilter) items = items.filter(e => e.rep_summary && e.rep_summary.includes(repFilter + ':'))
    if (guildFilter) {
      const gf = guildFilter.toLowerCase()
      items = items.filter(e =>
        (e.giver_display && e.giver_display.toLowerCase().includes(gf)) ||
        (e.giver_slug && e.giver_slug.toLowerCase().includes(gf)) ||
        (e.contract_key && e.contract_key.toLowerCase().includes(gf))
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(e =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.giver_display && e.giver_display.toLowerCase().includes(q))
      )
    }
    // Sort: reward descending
    items.sort((a, b) => (b.reward_amount || 0) - (a.reward_amount || 0))
    return items
  }, [allEntries, displayCategories, sourceFilter, categoryFilter, typeFilter, giverFilter, repFilter, guildFilter, search])

  const sourceCounts = useMemo(() => {
    const counts = { contract: 0, mission_board: 0, service_beacon: 0, dynamic: 0 }
    for (const e of allEntries) counts[e.source] = (counts[e.source] || 0) + 1
    return counts
  }, [allEntries])

  // Rep scopes — extract from rep_summary strings
  const repScopes = useMemo(() => {
    const scopes = {}
    for (const e of allEntries) {
      if (!e.rep_summary) continue
      for (const part of e.rep_summary.split(', ')) {
        const [scope, amtStr] = part.split(':').map(s => s.trim())
        if (!scope) continue
        if (!scopes[scope]) scopes[scope] = { name: scope, missions: [], totalPositive: 0, totalNegative: 0 }
        const amt = parseInt(amtStr) || 0
        if (amt > 0) scopes[scope].totalPositive += amt
        else scopes[scope].totalNegative += amt
        scopes[scope].missions.push(e)
      }
    }
    return Object.values(scopes).sort((a, b) => b.missions.length - a.missions.length)
  }, [allEntries])

  const hasActiveFilter = sourceFilter || categoryFilter || typeFilter || giverFilter || repFilter || guildFilter

  // Highlight: scroll to and auto-expand a specific entry (linked from ArmorSetDetail)
  const highlightRef = useRef(null)
  const highlightScrolled = useRef(false)
  useEffect(() => {
    if (highlightId && highlightRef.current && !highlightScrolled.current) {
      highlightScrolled.current = true
      // Small delay to let DOM settle after render
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [highlightId, filtered])

  const loading = cLoading || mLoading || gLoading
  const error = cError || mError

  if (loading) return <LoadingState message="Loading missions & contracts..." />
  if (error) return <ErrorState message={error} />

  // Stats
  const totalReward = allEntries.reduce((s, e) => s + (e.reward_amount || 0), 0)
  const avgReward = allEntries.length > 0 ? Math.round(totalReward / allEntries.length) : 0
  const unlawfulCount = allEntries.filter(e => e.is_unlawful).length
  const onceOnlyCount = allEntries.filter(e => e.once_only === 1).length

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="MISSIONS & CONTRACTS"
        subtitle={`${allEntries.length} entries from in-game mission board, service beacons, and NPC contracts`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Crosshair} label="Missions" value={sourceCounts.mission_board + sourceCounts.dynamic + sourceCounts.service_beacon} />
        <StatCard icon={FileText} label="Contracts" value={sourceCounts.contract} />
        <StatCard icon={Coins} label="Avg Reward" value={`${avgReward.toLocaleString()} aUEC`} color="text-sc-warn" />
        <StatCard icon={AlertTriangle} label="Unlawful" value={unlawfulCount} color="text-red-400" />
        <StatCard icon={Lock} label="One-time" value={onceOnlyCount} color="text-indigo-400" />
      </div>

      {/* View pills */}
      <div className="flex flex-wrap gap-2">
        <Pill active={view === 'all'} onClick={() => setParam('view', '')}>
          All Missions <span className="opacity-60 ml-1">{allEntries.length}</span>
        </Pill>
        <Pill active={view === 'factions'} onClick={() => setParam('view', 'factions')}>
          <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Factions <span className="opacity-60">{new Set((missionGivers || []).map(g => g.display_name)).size}</span></span>
        </Pill>
        <Pill active={view === 'reputation'} onClick={() => setParam('view', 'reputation')}>
          <span className="flex items-center gap-1.5"><Star className="w-3 h-3" /> Reputation <span className="opacity-60">{repScopes.length}</span></span>
        </Pill>
      </div>

      {/* Filters */}
      {view === 'all' && (
        <div className="flex flex-wrap gap-3 items-start">
          <SearchInput value={search} onChange={v => setParam('q', v, true)} placeholder="Search..." className="max-w-sm flex-1" />
          <select value={sourceFilter} onChange={e => setParam('source', e.target.value)} className="bg-sc-darker border border-sc-border rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-sc-accent/40">
            <option value="">All Sources</option>
            <option value="contract">Contracts ({sourceCounts.contract})</option>
            <option value="mission_board">Mission Board ({sourceCounts.mission_board})</option>
            <option value="service_beacon">Service Beacons ({sourceCounts.service_beacon})</option>
            <option value="dynamic">Dynamic ({sourceCounts.dynamic})</option>
          </select>
          <select value={categoryFilter} onChange={e => setParam('cat', e.target.value)} className="bg-sc-darker border border-sc-border rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-sc-accent/40">
            <option value="">All Categories</option>
            {displayCategories.map(dc => (
              <option key={dc.label} value={dc.label}>{dc.label} ({dc.count})</option>
            ))}
          </select>
        </div>
      )}

      {view !== 'all' && (
        <SearchInput value={search} onChange={v => setParam('q', v, true)} placeholder="Search..." className="max-w-sm" />
      )}

      {/* Active filter tags */}
      {hasActiveFilter && view === 'all' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600">Filtered:</span>
          {sourceFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
              {SOURCE_BADGE[sourceFilter]?.label || sourceFilter}
              <button onClick={() => setParam('source', '')} className="hover:text-white ml-1">&times;</button>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
              {CATEGORY_LABELS[categoryFilter] || categoryFilter}
              <button onClick={() => setParam('cat', '')} className="hover:text-white ml-1">&times;</button>
            </span>
          )}
          {typeFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
              {typeFilter}
              <button onClick={() => setParam('type', '')} className="hover:text-white ml-1">&times;</button>
            </span>
          )}
          {giverFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
              {giverFilter}
              <button onClick={() => setParam('giver', '')} className="hover:text-white ml-1">&times;</button>
            </span>
          )}
          {repFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Star className="w-3 h-3" /> {repFilter}
              <button onClick={() => setParam('rep', '')} className="hover:text-white ml-1">&times;</button>
            </span>
          )}
          {guildFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
              Guild: {guildFilter}
              <button onClick={() => setParam('guild', '')} className="hover:text-white ml-1">&times;</button>
            </span>
          )}
          <button onClick={() => setParams({ source: '', cat: '', type: '', giver: '', rep: '', guild: '' })} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear all</button>
        </div>
      )}

      {/* Factions view */}
      {view === 'factions' && (() => {
        // Group generators by display_name into unique factions
        const factionMap = new Map()
        for (const g of (missionGivers || [])) {
          const key = g.display_name || g.generator_key
          if (!factionMap.has(key)) {
            factionMap.set(key, {
              name: g.display_name,
              faction_name: g.faction_name,
              faction_slug: g.faction_slug,
              guild: g.guild,
              focus: g.focus,
              description: g.description,
              mission_types: [],
              systems: new Set(),
              blueprint_count: 0,
              generators: [],
            })
          }
          const f = factionMap.get(key)
          if (g.mission_type && !f.mission_types.includes(g.mission_type)) f.mission_types.push(g.mission_type)
          for (const sys of g.systems.filter(Boolean)) f.systems.add(sys)
          f.blueprint_count += g.blueprint_count || 0
          f.generators.push(g)
        }
        let factions = [...factionMap.values()].map(f => ({ ...f, systems: [...f.systems] }))

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase()
          factions = factions.filter(f =>
            f.name.toLowerCase().includes(q) ||
            (f.focus || '').toLowerCase().includes(q) ||
            f.mission_types.some(t => t.toLowerCase().includes(q))
          )
        }

        // Sort: with blueprints first, then by name
        factions.sort((a, b) => (b.blueprint_count > 0 ? 1 : 0) - (a.blueprint_count > 0 ? 1 : 0) || a.name.localeCompare(b.name))

        const withBlueprints = factions.filter(f => f.blueprint_count > 0)
        const withoutBlueprints = factions.filter(f => f.blueprint_count === 0)

        return (
          <>
            <div className="space-y-6">
              {withBlueprints.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                    <FlaskConical className="w-3.5 h-3.5" /> With Blueprint Rewards ({withBlueprints.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {withBlueprints.map(f => <FactionCard key={f.name} faction={f} />)}
                  </div>
                </div>
              )}
              {withoutBlueprints.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                    Other Factions ({withoutBlueprints.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {withoutBlueprints.map(f => <FactionCard key={f.name} faction={f} />)}
                  </div>
                </div>
              )}
            </div>
          </>
        )
      })()}

      {/* All entries view */}
      {view === 'all' && (() => {
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const safePage = Math.min(page, totalPages)
        const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

        return (
          <>
            <p className="text-xs font-mono text-gray-600">{filtered.length} results</p>
            {filtered.length === 0 ? (
              <div className="panel p-12 text-center">
                <Crosshair className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                <p className="text-gray-500 text-sm">No missions or contracts match your filters.</p>
              </div>
            ) : (
              <>
                <div className="panel overflow-hidden">
                  {pageSlice.map(e => {
                    const isMatch = highlightId && (e.contract_id === Number(highlightId) || e.id === `c-${highlightId}`)
                    return <EntryRow key={e.id} entry={e} repFocus={repFilter || null} isHighlighted={!!isMatch} highlightRef={isMatch ? highlightRef : undefined} prerequisites={missionData?.prerequisites} repRequirements={missionData?.rep_requirements} />
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 text-xs font-mono">
                    <button
                      onClick={() => setParam('page', String(safePage - 1))}
                      disabled={safePage <= 1}
                      className="px-3 py-1.5 rounded border border-sc-border/30 text-gray-400 hover:text-white hover:border-sc-accent/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Prev
                    </button>
                    <span className="text-gray-500">
                      Page {safePage} of {totalPages} <span className="text-gray-700">({filtered.length} total)</span>
                    </span>
                    <button
                      onClick={() => setParam('page', String(safePage + 1))}
                      disabled={safePage >= totalPages}
                      className="px-3 py-1.5 rounded border border-sc-border/30 text-gray-400 hover:text-white hover:border-sc-accent/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )
      })()}

      {/* Reputation view */}
      {view === 'reputation' && (() => {
        // Merge contract generator factions into rep scopes
        const factionReps = (missionGivers || [])
          .filter(g => g.faction_name && g.description)
          .reduce((acc, g) => {
            // Deduplicate by faction name
            if (!acc.some(a => a.name === g.display_name)) {
              acc.push({
                name: g.display_name,
                focus: g.focus,
                generator_key: g.generator_key,
                isFaction: true,
              })
            }
            return acc
          }, [])

        return (
          <>
            {/* Faction rep tracks (from contract generators) */}
            {factionReps.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Faction Reputation ({factionReps.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {factionReps.map(scope => {
                    const logo = getFactionLogo(scope.name)
                    return (
                      <Link
                        key={scope.name}
                        to={`/missions/faction/${scope.faction_slug || scope.name.toLowerCase().replace(/\s+/g, '')}`}
                        className="panel overflow-hidden text-left w-full hover:border-sc-accent/30 transition-colors group flex"
                      >
                        <div className="flex-1 p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Star className="w-4 h-4 text-emerald-400 shrink-0" />
                            <h3 className="font-display font-semibold text-white text-sm group-hover:text-sc-accent transition-colors">{scope.name}</h3>
                          </div>
                          {scope.focus && <p className="text-[10px] text-gray-500">{scope.focus}</p>}
                        </div>
                        <div className="w-24 shrink-0 flex items-center justify-center p-2">
                          {logo ? (
                            <img src={logo} alt={scope.name} className="w-16 h-16 object-contain opacity-60 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <span className="text-xl font-display font-bold text-gray-700 group-hover:text-gray-500 transition-colors">
                              {scope.name.split(/[\s()]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Mission board rep tracks (existing) */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5" /> Career Reputation ({repScopes.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {repScopes.map(scope => {
                  const logo = getFactionLogo(scope.name)
                  const initials = scope.name.split(/[\s()]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase()
                  return (
                    <button
                      key={scope.name}
                      onClick={() => setParams({ view: 'all', rep: scope.name, cat: '', type: '', giver: '', source: '' })}
                      className="panel overflow-hidden text-left w-full hover:border-sc-accent/30 transition-colors group flex"
                    >
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-emerald-400 shrink-0" />
                          <h3 className="font-display font-semibold text-white text-sm group-hover:text-sc-accent transition-colors">{scope.name}</h3>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sc-accent/10 text-sc-accent border border-sc-accent/20">
                          {scope.missions.length} missions
                        </span>
                      </div>
                      <div className="w-24 shrink-0 flex items-center justify-center p-2">
                        {logo ? (
                          <img src={logo} alt={scope.name} className="w-16 h-16 object-contain opacity-60 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <span className="text-xl font-display font-bold text-gray-700 group-hover:text-gray-500 transition-colors">{initials}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
