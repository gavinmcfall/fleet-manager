import React, { useState, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MapPin, FlaskConical, Shield, Users, Building2, ChevronRight, Coins, FileText, Crosshair, Info } from 'lucide-react'
import { useFactionDetail } from '../hooks/useAPI'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

// Reuse from Missions.jsx — TODO: extract to shared module
const FACTION_LOGOS = {
  "bitzeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bitzeros/thumb",
  "headhunters": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "citizensforprosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cfp/thumb",
  "bountyhuntersguild": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bountyhuntersguild/thumb",
  "cdf": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "foxwellenforcement": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-foxwellenforcement/thumb",
  "intersecdefensesolutions": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "northrockservicegroup": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-northrock/thumb",
  "covalexshipping": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-covalex/thumb",
  "lingfamilyhauling": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-lingfamily/thumb",
  "redwindlinehaul": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-redwind/thumb",
  "vaughn": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-vaughn/thumb",
  "tarpits": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-tarpits/thumb",
  "ruto": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-ruto/thumb",
  "clovusdarneely": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-clovusdarneely/thumb",
  "wallaceklim": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wallaceklim/thumb",
  "eckhartsecurity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-eckhart/thumb",
  "twitchgang": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-teciapacheco/thumb",
  "shubininterstellar": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-shubin/thumb",
  "xenothreat": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-xenothreat/thumb",
  "wikelo": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wikelo/thumb",
  "rayariinc": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-rayari/thumb",
  "wildstarracing": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wildstar/thumb",
}

// Human-friendly descriptions for mission types from contract generators
const MISSION_TYPE_DESCRIPTIONS = {
  "Recovery": "Travel to a location and recover a lost item, then deliver it to the client.",
  "Recovery (Unlawful)": "Recover items from restricted or contested areas. May involve illegal activity.",
  "Recovery + Combat": "Recover an item from a hostile location. Expect armed resistance.",
  "Black Box Recovery": "Locate and retrieve a ship's black box flight recorder from a wreck site.",
  "Elimination": "Locate and eliminate a specific target at a known location.",
  "Ship Defense": "Protect a friendly ship from incoming hostile waves.",
  "Defend Assets": "Defend structures or cargo from attack until reinforcements arrive.",
  "Escort": "Escort a ship or convoy safely through dangerous space.",
  "Patrol": "Patrol a designated area and engage any hostile contacts.",
  "Ship Wave Attack": "Engage and destroy waves of incoming hostile ships.",
  "Ambush": "Set up and execute an ambush on hostile forces.",
  "Bounty": "Track down and neutralize a bounty target.",
  "Bounty (FPS)": "Hunt and eliminate a target on foot at a ground location.",
  "Data Recovery": "Retrieve encrypted data from a terminal or device at a target location.",
  "Investigation": "Investigate a location and report findings back to the client.",
  "Missing Person": "Search for a missing person and determine their fate.",
  "Cargo Recovery": "Locate and recover lost cargo, then deliver it to the client.",
  "Mining (FPS)": "Hand-mine resources at a designated location and deliver them.",
  "Mining (Ship)": "Mine asteroids or surface deposits using a mining ship.",
  "Mining (Ground)": "Mine surface deposits using a ground vehicle.",
  "Salvage (FPS)": "Salvage materials from a wreck on foot.",
  "Salvage (Ship)": "Salvage a derelict ship using salvage equipment.",
  "Hauling": "Transport cargo between two locations.",
  "Delivery": "Pick up a package and deliver it to the destination.",
  "Facility Raid": "Assault a hostile facility and complete objectives inside.",
  "Animal Hunt": "Track and eliminate dangerous wildlife.",
  "Hunt & Collect": "Hunt animals and collect specimens for the client.",
  "Assassination": "Eliminate a high-value target.",
  "Ship Hijack": "Board and take control of a target ship.",
  "Criminal Bounties": "Eliminate criminal targets in open space.",
  "Collection": "Collect specific items and deliver them to the client.",
  "Resource Gathering": "Gather resources from the environment and deliver them.",
}

const GUILD_LABELS = {
  thecouncil_guild: 'The Council', mercenary_guild: 'Mercenary Guild',
  unitedresourceworkers_guild: 'United Resource Workers', interstellartransport_guild: 'Interstellar Transport',
  academyofsciences_guild: 'Academy of Sciences', missionproviders: 'Mission Providers',
}

const SYSTEM_COLORS = {
  Stanton: 'bg-sc-accent/10 text-sc-accent border-sc-accent/20',
  Nyx: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Pyro: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const DIFF_COLORS = {
  Intro: 'text-gray-400', VeryEasy: 'text-emerald-400', Easy: 'text-green-400',
  Medium: 'text-amber-400', Hard: 'text-orange-400', VeryHard: 'text-red-400', Super: 'text-purple-400',
}
const DIFF_LABELS = { VeryEasy: 'Very Easy', VeryHard: 'Very Hard' }

const RANKS = [
  { rank: 0, name: 'Neutral', min_rep: 0 },
  { rank: 1, name: 'Jr. Contractor', min_rep: 800 },
  { rank: 2, name: 'Contractor', min_rep: 2200 },
  { rank: 3, name: 'Sr. Contractor', min_rep: 5800 },
  { rank: 4, name: 'Veteran Contractor', min_rep: 15000 },
  { rank: 5, name: 'Head Contractor', min_rep: 38000 },
  { rank: 6, name: 'Elite Contractor', min_rep: 95250 },
]

function cleanDesc(text) {
  if (!text) return ''
  return text.replace(/<[^>]+>/g, '').replace(/^-+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Mission Detail Panel (slides in from right) ──────────────────────
function MissionDetailPanel({ mission, type, onBack }) {
  const isGenerator = type === 'generator'
  const isPuMission = type === 'pu_mission'
  const isContract = type === 'contract'

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sc-accent transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to missions
      </button>

      {isGenerator && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 mb-2 inline-block">
              {mission.mission_type}
            </span>
            <h2 className="text-lg font-bold text-white mb-2">{mission.mission_type}</h2>

            {/* Mission description */}
            {MISSION_TYPE_DESCRIPTIONS[mission.mission_type] && (
              <p className="text-sm text-gray-400 leading-relaxed mb-3">{MISSION_TYPE_DESCRIPTIONS[mission.mission_type]}</p>
            )}

            {/* Systems */}
            {mission.systems?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {mission.systems.map(sys => (
                  <span key={sys} className={`text-[10px] px-2 py-0.5 rounded ${SYSTEM_COLORS[sys]?.split(' ').slice(0, 2).join(' ') || 'bg-gray-500/10 text-gray-400'}`}>
                    {sys}
                  </span>
                ))}
              </div>
            )}

            {/* Difficulty tiers */}
            {mission.tiers?.length > 0 && (
              <div className="border border-white/[0.06] rounded-lg overflow-hidden mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-3 py-2">Difficulty</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-3 py-2">Min Rank</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-3 py-2">Rep Reward</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-3 py-2">aUEC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mission.tiers.map(t => (
                      <tr key={t.difficulty} className="border-b border-white/[0.04] last:border-0">
                        <td className={`px-3 py-1.5 text-xs font-medium ${DIFF_COLORS[t.difficulty] || 'text-gray-400'}`}>
                          {DIFF_LABELS[t.difficulty] || t.difficulty}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-gray-400">{RANKS[t.min_rank]?.name || `Rank ${t.min_rank}`}</td>
                        <td className="px-3 py-1.5 text-xs text-emerald-400 font-mono">{t.rep_reward ? `+${t.rep_reward}` : '—'}</td>
                        <td className="px-3 py-1.5 text-[10px] text-gray-600 italic">Dynamic</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Blueprint pools */}
          {mission.blueprint_pools?.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5" /> Blueprint Rewards
              </h3>
              {mission.blueprint_pools.map((pool, pi) => (
                <div key={pi} className="mb-3 last:mb-0">
                  {pool.chance < 1 && (
                    <span className="text-[10px] text-gray-600 mb-1 block">{Math.round(pool.chance * 100)}% drop chance</span>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {pool.blueprints.map(bp => (
                      <Link key={bp.id} to={`/crafting/${bp.id}`}
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.02] border border-white/[0.06] hover:border-sc-accent/20 text-xs text-gray-300 hover:text-white transition-all">
                        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold uppercase ${
                          bp.type === 'weapons' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                          bp.type === 'armour' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' :
                          'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>{bp.type}</span>
                        {bp.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-sc-accent/5 border border-sc-accent/10">
                <Info className="w-3.5 h-3.5 text-sc-accent mt-0.5 shrink-0" />
                <p className="text-[10px] text-gray-400">Blueprint drops are the same at all difficulty levels.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {isPuMission && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-bold text-white">{mission.title}</h2>
          <div className="flex flex-wrap gap-2">
            {mission.category && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-gray-500">{mission.category}</span>
            )}
            {mission.difficulty && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-gray-500">{mission.difficulty}</span>
            )}
            {!mission.is_lawful && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Unlawful</span>
            )}
          </div>
          {mission.reward_amount > 0 && (
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-mono text-amber-400">{mission.reward_amount.toLocaleString()}</span>
              <span className="text-xs text-gray-500">{mission.reward_currency || 'aUEC'}</span>
            </div>
          )}
          {mission.description && (
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{cleanDesc(mission.description)}</p>
          )}
        </div>
      )}

      {isContract && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-bold text-white">{mission.title}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-block">{mission.category}</span>
          {mission.reward_amount > 0 && (
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-mono text-amber-400">{mission.reward_amount.toLocaleString()}</span>
              <span className="text-xs text-gray-500">aUEC</span>
            </div>
          )}
          {mission.reward_text && (
            <div className="text-xs text-gray-400">Reward: <span className="text-sc-accent2">{mission.reward_text}</span></div>
          )}
          {mission.description && (
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{cleanDesc(mission.description)}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Faction Detail ─────────────────────────────────────────────
export default function FactionDetail() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const typeFilter = searchParams.get('type') || ''
  const { data, loading, error, refetch } = useFactionDetail(slug)

  // Selected mission from URL query string — deep-linkable
  const missionParam = searchParams.get('mission') || ''
  const setSelectedMission = (mission) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (mission) next.set('mission', mission.id)
      else next.delete('mission')
      return next
    })
  }

  // Build unified mission list
  const allMissions = useMemo(() => {
    if (!data) return []
    const missions = []

    // Generators → one entry per mission type
    for (const gen of (data.generators || [])) {
      const hasBP = gen.blueprint_pools?.some(p => p.blueprints?.length > 0)
      missions.push({
        id: `gen-${gen.key}`,
        type: 'generator',
        title: gen.mission_type || 'Mission',
        category: gen.mission_type,
        source: hasBP ? 'blueprint' : 'dynamic',
        data: gen,
        hasBP,
        reward: null,
      })
    }

    // pu_missions — skip completely empty stubs
    for (const m of (data.pu_missions || [])) {
      if (!m.description && !(m.reward_amount > 0)) continue
      missions.push({
        id: `pu-${m.id}`,
        type: 'pu_mission',
        title: m.title,
        category: m.category,
        source: 'mission_board',
        data: m,
        hasBP: false,
        reward: m.reward_amount,
      })
    }

    // contracts
    for (const c of (data.contracts || [])) {
      missions.push({
        id: `contract-${c.id}`,
        type: 'contract',
        title: c.title,
        category: c.category,
        source: 'contract',
        data: c,
        hasBP: false,
        reward: c.reward_amount,
      })
    }

    return missions
  }, [data])

  // Category filter pills
  const categories = useMemo(() => {
    const counts = {}
    for (const m of allMissions) {
      const cat = m.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [allMissions])

  const filtered = typeFilter
    ? allMissions.filter(m => m.category === typeFilter)
    : allMissions

  // Resolve selected mission from URL param
  const selectedMission = missionParam
    ? allMissions.find(m => m.id === missionParam) || null
    : null
  const isDetailView = !!missionParam

  if (loading) return <LoadingState fullScreen message="Loading faction..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-300 mb-2">Faction Not Found</h2>
        <Link to="/missions?view=factions" className="text-sm text-sc-accent hover:text-sc-accent/80 transition-colors">&larr; Back to Factions</Link>
      </div>
    )
  }

  const { faction, systems, stats } = data
  const logo = FACTION_LOGOS[slug] || FACTION_LOGOS[faction.faction_slug]
  const guildLabel = GUILD_LABELS[faction.guild] || ''

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link to="/missions?view=factions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sc-accent transition-colors">
        <ArrowLeft className="w-4 h-4" /> Factions
      </Link>

      {/* Header */}
      <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sc-accent/20 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sc-accent/20 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sc-accent/20 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sc-accent/20 rounded-br-2xl" />

        <div className="flex items-start gap-6">
          {logo && <img src={logo} alt={faction.display_name} className="w-36 h-36 rounded-xl border border-white/[0.08] object-cover shrink-0 shadow-lg shadow-black/30 bg-white/[0.02]" />}
          <div className="flex-1 min-w-0">
            {guildLabel && <span className="px-2 py-0.5 rounded text-[10px] text-gray-500 bg-white/[0.04] border border-white/[0.06] uppercase tracking-wider">{guildLabel}</span>}
            <h1 className="text-2xl font-bold text-white tracking-wide mt-1 mb-1" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
              {faction.display_name}
            </h1>
            {faction.focus && <p className="text-sm text-gray-400 mb-2">{faction.focus}</p>}
            {faction.description && <p className="text-sm text-gray-500 leading-relaxed mb-2">{faction.description}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
              {faction.headquarters && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-gray-600" /> HQ: {faction.headquarters}</span>}
              {faction.leadership && <span className="flex items-center gap-1.5"><Users className="w-3 h-3 text-gray-600" /> Led by {faction.leadership}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap items-center gap-3">
        {systems.length > 0 && systems.map(sys => (
          <span key={sys} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${SYSTEM_COLORS[sys] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
            <MapPin className="w-3.5 h-3.5" /> {sys}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium bg-white/[0.04] text-gray-400 border-white/[0.06]">
          <FileText className="w-3.5 h-3.5" /> {stats.mission_count} missions
        </span>
        {stats.blueprint_count > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <FlaskConical className="w-3.5 h-3.5" /> {stats.blueprint_count} blueprints
          </span>
        )}
      </div>

      {/* Slide container */}
      <div className="relative overflow-hidden min-h-[200px]">
        {/* Mission list */}
        <div
          className={`transition-all duration-500 ease-in-out ${isDetailView ? 'pointer-events-none' : ''}`}
          style={{ transform: isDetailView ? 'translateX(-100%)' : 'translateX(0)', opacity: isDetailView ? 0 : 1 }}
        >
          {/* Category filter */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button onClick={() => setSearchParams({})}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${!typeFilter ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12]'}`}>
                All ({allMissions.length})
              </button>
              {categories.map(([cat, count]) => (
                <button key={cat} onClick={() => setSearchParams({ type: cat })}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${typeFilter === cat ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12]'}`}>
                  {cat} ({count})
                </button>
              ))}
            </div>
          )}

          {/* Mission rows */}
          <div className="space-y-1.5">
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMission(m)}
                className="w-full flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:border-sc-accent/20 hover:bg-white/[0.04] transition-all group text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      m.source === 'blueprint' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      m.source === 'contract' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      'bg-white/[0.04] text-gray-500 border-white/[0.06]'
                    }`}>{m.source === 'blueprint' ? 'Blueprint Mission' : m.source === 'contract' ? 'Contract' : 'Mission Board'}</span>
                    {m.category && <span className="text-[9px] text-gray-600">{m.category}</span>}
                  </div>
                  <h3 className="text-sm text-gray-200 group-hover:text-white transition-colors truncate">{m.title}</h3>
                </div>
                {m.hasBP && <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                {m.reward > 0 && (
                  <span className="text-xs font-mono text-amber-400 shrink-0">{m.reward.toLocaleString()} aUEC</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-sc-accent transition-colors shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No missions found for this filter.</div>
            )}
          </div>
        </div>

        {/* Mission detail (slides in from right) */}
        <div
          className={`absolute top-0 left-0 right-0 transition-all duration-500 ease-in-out ${!isDetailView ? 'pointer-events-none' : ''}`}
          style={{ transform: isDetailView ? 'translateX(0)' : 'translateX(100%)', opacity: isDetailView ? 1 : 0 }}
        >
          {selectedMission && (
            <MissionDetailPanel
              mission={selectedMission.data}
              type={selectedMission.type}
              onBack={() => setSelectedMission(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
