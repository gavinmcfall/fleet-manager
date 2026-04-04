import React, { useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Package, Users, Crosshair, Shield, Coins, AlertTriangle, FileText, Star } from 'lucide-react'
import { useContracts, useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import StatCard from '../components/StatCard'

// ── Faction logos from game data (CF Images) ────────────────────────────────

const FACTION_LOGOS = {
  "ArcCorp": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-arccorp/thumb",
  "BitZeros": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-bitzeros/thumb",
  "BlacJac": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-blacjac/thumb",
  "Bounty Hunters Guild": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-bounty/thumb",
  "CDF": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-cdf/thumb",
  "CFP": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-cfp/thumb",
  "Clovus Darneely": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-clovusdarneely/thumb",
  "Constantine Hurston": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-constantinehurston/thumb",
  "Covalex": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-covalex/thumb",
  "Crusader Industries": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-crusaderindustries/thumb",
  "Crusader Security": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-crusadersecurity/thumb",
  "Headhunters": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-headhunters/thumb",
  "Hurston Dynamics": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-hurstondynamics/thumb",
  "Miles Eckhart": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-mileseckhart/thumb",
  "Nine Tails": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-ninetails/thumb",
  "NorthRock": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-northrock/thumb",
  "Recco Battaglia": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-reccobattaglia/thumb",
  "Rough & Ready": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-roughready/thumb",
  "Ruto": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-ruto/thumb",
  "Tarpits": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-tarpits/thumb",
  "Tecia Pacheco": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-teciapacheco/thumb",
  "Vaughn": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-vaughn/thumb",
  "Wallace Klim": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-wallaceklim/thumb",
  "XenoThreat": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-xenothreat/thumb",
  "microTech": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-microtech/thumb",
  "Courier": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-courier/thumb",
  "Bounty": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-bounty/thumb",
  "Hired Muscle": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-security/thumb",
  "Assassination": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-security/thumb",
  "Security": "https://imagedelivery.net/_nHFky6xiv-JbnhLN5CCrQ/faction-logo-security/thumb",
}

/** Get faction logo URL from a rep scope name like "Ruto" or "Hurston Dynamics (Security)" */
function getFactionLogo(scopeName) {
  // Direct match
  if (FACTION_LOGOS[scopeName]) return FACTION_LOGOS[scopeName]
  // Strip parenthetical scope: "Hurston Dynamics (Security)" → "Hurston Dynamics"
  const base = scopeName.replace(/\s*\(.*\)$/, '')
  return FACTION_LOGOS[base] || null
}

// ── Shared ──────────────────────────────────────────────────────────────────

function cleanDesc(text) {
  if (!text) return ''
  return text.replace(/<[^>]+>/g, '').trim()
}

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

function parseRequirements(json) {
  if (!json || json === 'random') return null
  try {
    const reqs = JSON.parse(json)
    return reqs.length > 0 ? reqs : null
  } catch { return null }
}

// ── Unified row ─────────────────────────────────────────────────────────────

function EntryRow({ entry, repFocus }) {
  const [expanded, setExpanded] = useState(false)
  const source = SOURCE_BADGE[entry.source] || SOURCE_BADGE.dynamic
  const reward = entry.reward_amount || 0
  const desc = cleanDesc(entry.description)
  const requirements = parseRequirements(entry.requirements_json)

  // Extract focused rep amount if filtering by rep
  let focusedRep = null
  if (repFocus && entry.rep_summary) {
    const match = entry.rep_summary.split(', ').find(p => p.startsWith(repFocus + ':'))
    if (match) focusedRep = match.split(':')[1]?.trim()
  }

  return (
    <div className="border-b border-sc-border/30 last:border-0">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-200">{entry.title}</span>
          {entry.giver_display && (
            <span className="text-[10px] text-gray-600 ml-2 font-mono hidden sm:inline">{entry.giver_display}</span>
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
              <><span className="text-sc-warn">{reward.toLocaleString()}</span> <span className="text-gray-600">aUEC</span></>
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
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {desc ? (
            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">{desc}</p>
          ) : (
            <p className="text-xs text-gray-600 italic">No description available</p>
          )}

          {/* Contract-specific: requirements */}
          {requirements && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Package className="w-3 h-3 text-gray-600" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-600">Requirements</span>
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
              <Package className="w-3 h-3 text-gray-600" />
              <span className="text-xs font-mono text-gray-500 italic">Randomized each time</span>
            </div>
          )}

          {/* Contract-specific: linked reward */}
          {entry.reward_vehicle_slug && (
            <div className="text-xs font-mono">
              Reward: <Link to={`/ships/${entry.reward_vehicle_slug}`} className="text-sc-accent2 hover:text-sc-accent transition-colors">{entry.reward_text}</Link>
            </div>
          )}
          {entry.reward_item_uuid && (
            <div className="text-xs font-mono">
              Reward: <Link to={`/loot/${entry.reward_item_uuid}`} className="text-sc-accent2 hover:text-sc-accent transition-colors">{entry.reward_text}</Link>
            </div>
          )}

          {/* Mission-specific: rep */}
          {entry.rep_summary && (
            <div className="text-[11px] font-mono">
              <span className="text-gray-500">Rep: </span>
              {entry.rep_summary.split(', ').map((r, i) => (
                <span key={i} className={`${r.includes('+') ? 'text-emerald-400' : 'text-red-400'} ${i > 0 ? 'ml-1' : ''}`}>
                  {r}{i < entry.rep_summary.split(', ').length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-gray-600">
            {entry.giver_display && <span>From: <span className="text-gray-400">{entry.giver_display}</span></span>}
            {entry.category_display && <span>Category: <span className="text-gray-400">{entry.category_display}</span></span>}
            {entry.sequence_num != null && <span>#{entry.sequence_num}</span>}
          </div>

          {entry.notes && <p className="text-[10px] font-mono text-amber-400/80 italic">{entry.notes}</p>}
        </div>
      )}
    </div>
  )
}

// ── Type / Giver cards ──────────────────────────────────────────────────────

function TypeCard({ type, count, onClick }) {
  return (
    <button onClick={onClick} className="panel p-4 text-left w-full hover:border-sc-accent/30 transition-colors group">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm group-hover:text-sc-accent transition-colors">{type.name}</h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sc-accent/10 text-sc-accent border border-sc-accent/20 shrink-0">{count} missions</span>
      </div>
      {type.description && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{cleanDesc(type.description)}</p>}
    </button>
  )
}

function GiverCard({ giver, count, onClick }) {
  const desc = cleanDesc(giver.description)
  return (
    <button onClick={onClick} className="panel p-4 text-left w-full hover:border-sc-accent/30 transition-colors group flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="font-display font-semibold text-white text-sm group-hover:text-sc-accent transition-colors">{giver.name}</h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sc-accent/10 text-sc-accent border border-sc-accent/20 shrink-0">{count} missions</span>
      </div>
      {giver.faction_name && (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sc-accent/10 text-sc-accent border border-sc-accent/20 mb-2">
          <Users className="w-2.5 h-2.5" />{giver.faction_name}
        </span>
      )}
      {desc && <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>}
    </button>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Contracts() {
  const { data: contracts, loading: cLoading, error: cError } = useContracts()
  const { data: missionData, loading: mLoading, error: mError } = useAPI('/gamedata/missions')
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') || ''
  const view = searchParams.get('view') || 'all'
  const sourceFilter = searchParams.get('source') || ''
  const categoryFilter = searchParams.get('cat') || ''
  const typeFilter = searchParams.get('type') || ''
  const giverFilter = searchParams.get('giver') || ''
  const repFilter = searchParams.get('rep') || ''

  const setParam = useCallback((key, val, replace = false) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      return next
    }, { replace })
  }, [setSearchParams])
  const setParams = useCallback((updates, replace = false) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, val] of Object.entries(updates)) {
        if (val) next.set(key, val)
        else next.delete(key)
      }
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
        title: c.title,
        description: c.description,
        source: 'contract',
        category: c.category,
        category_display: c.category,
        giver_display: { wikelo: 'Wikelo', gfs: "Gilly's Flight School", ruto: 'Ruto' }[c.giver_slug] || c.giver_slug,
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
        title: m.title,
        description: m.description,
        source: m.availability || 'dynamic',
        category: m.category,
        category_display: CATEGORY_LABELS[m.category] || m.category,
        giver_display: m.giver_name || null,
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
      })
    }

    return entries
  }, [contracts, missionData])

  // Filter
  const filtered = useMemo(() => {
    let items = allEntries
    if (sourceFilter) items = items.filter(e => e.source === sourceFilter)
    if (categoryFilter) items = items.filter(e => e.category === categoryFilter)
    if (typeFilter) items = items.filter(e => e.type_slug === typeFilter || e.type_slug === ('missiontype-' + typeFilter.replace('missiontype-', '')))
    if (giverFilter) items = items.filter(e => e.giver_display === giverFilter)
    if (repFilter) items = items.filter(e => e.rep_summary && e.rep_summary.includes(repFilter + ':'))
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
  }, [allEntries, sourceFilter, categoryFilter, typeFilter, giverFilter, repFilter, search])

  // Categories + source counts for filters
  const categories = useMemo(() => {
    const counts = {}
    for (const e of allEntries) counts[e.category] = (counts[e.category] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [allEntries])

  const sourceCounts = useMemo(() => {
    const counts = { contract: 0, mission_board: 0, service_beacon: 0, dynamic: 0 }
    for (const e of allEntries) counts[e.source] = (counts[e.source] || 0) + 1
    return counts
  }, [allEntries])

  // Types + givers for browse views
  const types = missionData?.types || []
  const givers = missionData?.givers || []

  const missionCountByType = useMemo(() => {
    const counts = {}
    for (const e of allEntries) if (e.type_slug) counts[e.type_slug] = (counts[e.type_slug] || 0) + 1
    return counts
  }, [allEntries])

  const entryCountByGiver = useMemo(() => {
    const counts = {}
    for (const e of allEntries) if (e.giver_display) counts[e.giver_display] = (counts[e.giver_display] || 0) + 1
    return counts
  }, [allEntries])

  const filteredTypes = useMemo(() => {
    return types.filter(t => t.name !== '<= UNINITIALIZED =>' && t.name !== '<= PLACEHOLDER =>' && (missionCountByType[t.slug] || 0) > 0)
  }, [types, missionCountByType])

  // Build unified giver list (mission givers + contract givers)
  const allGivers = useMemo(() => {
    const gMap = new Map()
    for (const g of givers) {
      if ((entryCountByGiver[g.name] || 0) > 0) {
        gMap.set(g.name, { name: g.name, description: g.description, faction_name: g.faction_name })
      }
    }
    // Add contract givers with descriptions
    const contractGiverInfo = {
      'Wikelo': { description: 'Come to Wikelo Emporium for fine made things. Always looking for useful things. Will trade or make in return.', faction_name: null },
      "Gilly's Flight School": { description: 'Instructor Lucas "Gilly" Baramsco has served in six squadrons and has over ten years of teaching experience. Offers combat gauntlets and navy patrol training courses.', faction_name: null },
      'Ruto': { description: 'One of the best known info brokers in Stanton. Only appearing as a hologram of former Imperator Kelos Costigan, Ruto manages a vast network of criminal activity and connections.', faction_name: null },
    }
    for (const [name, info] of Object.entries(contractGiverInfo)) {
      if ((entryCountByGiver[name] || 0) > 0 && !gMap.has(name)) {
        gMap.set(name, { name, ...info })
      }
    }
    return [...gMap.values()].sort((a, b) => (entryCountByGiver[b.name] || 0) - (entryCountByGiver[a.name] || 0))
  }, [givers, entryCountByGiver])

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

  const hasActiveFilter = sourceFilter || categoryFilter || typeFilter || giverFilter || repFilter

  const loading = cLoading || mLoading
  const error = cError || mError

  if (loading) return <LoadingState message="Loading missions & contracts..." />
  if (error) return <ErrorState message={error} />

  // Stats
  const totalReward = allEntries.reduce((s, e) => s + (e.reward_amount || 0), 0)
  const avgReward = allEntries.length > 0 ? Math.round(totalReward / allEntries.length) : 0
  const unlawfulCount = allEntries.filter(e => e.is_unlawful).length

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="MISSIONS & CONTRACTS"
        subtitle={`${allEntries.length} entries from in-game mission board, service beacons, and NPC contracts`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Crosshair} label="Missions" value={sourceCounts.mission_board + sourceCounts.dynamic + sourceCounts.service_beacon} />
        <StatCard icon={FileText} label="Contracts" value={sourceCounts.contract} />
        <StatCard icon={Coins} label="Avg Reward" value={`${avgReward.toLocaleString()} aUEC`} color="text-sc-warn" />
        <StatCard icon={AlertTriangle} label="Unlawful" value={unlawfulCount} color="text-red-400" />
      </div>

      {/* View pills */}
      <div className="flex flex-wrap gap-2">
        <Pill active={view === 'all'} onClick={() => setParam('view', '')}>
          All <span className="opacity-60 ml-1">{allEntries.length}</span>
        </Pill>
        <Pill active={view === 'types'} onClick={() => setParam('view', 'types')}>
          <span className="flex items-center gap-1.5"><Crosshair className="w-3 h-3" /> Types <span className="opacity-60">{filteredTypes.length}</span></span>
        </Pill>
        <Pill active={view === 'givers'} onClick={() => setParam('view', 'givers')}>
          <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Givers <span className="opacity-60">{allGivers.length}</span></span>
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
            {categories.map(([cat, count]) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat} ({count})</option>
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
              {types.find(t => t.slug === typeFilter)?.name || typeFilter}
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
          <button onClick={() => setParams({ source: '', cat: '', type: '', giver: '', rep: '' })} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear all</button>
        </div>
      )}

      {/* All entries view */}
      {view === 'all' && (
        <>
          <p className="text-xs font-mono text-gray-600">{filtered.length} results</p>
          {filtered.length === 0 ? (
            <div className="panel p-12 text-center">
              <Crosshair className="w-10 h-10 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-500 text-sm">No missions or contracts match your filters.</p>
            </div>
          ) : (
            <div className="panel overflow-hidden">
              {filtered.slice(0, 200).map(e => <EntryRow key={e.id} entry={e} repFocus={repFilter || null} />)}
              {filtered.length > 200 && (
                <div className="px-4 py-3 text-xs text-gray-600 font-mono text-center border-t border-sc-border/30">
                  Showing 200 of {filtered.length} — refine your search
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Types view */}
      {view === 'types' && (
        <>
          <p className="text-xs font-mono text-gray-600">{filteredTypes.length} types — click to filter</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTypes.map(t => (
              <TypeCard key={t.id} type={t} count={missionCountByType[t.slug] || 0} onClick={() => setParams({ view: '', type: t.slug, cat: '', giver: '', source: '' })} />
            ))}
          </div>
        </>
      )}

      {/* Givers view */}
      {view === 'givers' && (
        <>
          <p className="text-xs font-mono text-gray-600">{allGivers.length} givers — click to filter</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allGivers.map(g => (
              <GiverCard key={g.name} giver={g} count={entryCountByGiver[g.name] || 0} onClick={() => setParams({ view: '', giver: g.name, cat: '', type: '', source: '' })} />
            ))}
          </div>
        </>
      )}

      {/* Reputation view */}
      {view === 'reputation' && (
        <>
          <p className="text-xs font-mono text-gray-600">{repScopes.length} reputation tracks — click to see missions</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {repScopes.map(scope => {
              const logo = getFactionLogo(scope.name)
              const initials = scope.name.split(/[\s()]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase()
              return (
                <button
                  key={scope.name}
                  onClick={() => setParams({ view: '', rep: scope.name, cat: '', type: '', giver: '', source: '' })}
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
        </>
      )}
    </div>
  )
}
