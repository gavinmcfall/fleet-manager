import React, { useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Package, Users, Crosshair, Shield, Coins, AlertTriangle, FileText, Star, MapPin, FlaskConical, Building2 } from 'lucide-react'
import { useContracts, useAPI, useMissionGivers } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import StatCard from '../components/StatCard'

// ── Faction logos from game data (CF Images) ────────────────────────────────

// Faction logos — extracted from game data p4k (DDS→PNG→CF Images)
const FACTION_LOGOS = {
  // Factions (from game reputation records)
  "Bit Zeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bitzeros/thumb",
  "BitZeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bitzeros/thumb",
  "Headhunters": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "Citizens for Prosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cfp/thumb",
  "CFP": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cfp/thumb",
  "Bounty Hunters Guild": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bountyhuntersguild/thumb",
  "Civilian Defense Force": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "CDF": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "Foxwell Enforcement": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-foxwellenforcement/thumb",
  "InterSec Defense Solutions": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "Northrock Service Group": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-northrock/thumb",
  "NorthRock": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-northrock/thumb",
  "Covalex": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-covalex/thumb",
  "Covalex Independent Contractors": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-covalex/thumb",
  "Ling Family Hauling": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-lingfamily/thumb",
  "Red Wind Linehaul": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-redwind/thumb",
  "Vaughn": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-vaughn/thumb",
  "Tar Pits": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-tarpits/thumb",
  "Tarpits": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-tarpits/thumb",
  "XenoThreat": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-xenothreat/thumb",
  "Aciedo Communications": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-aciedo/thumb",
  // NPCs (from game data)
  "Clovus Darneely": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-clovusdarneely/thumb",
  "Ruto": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-ruto/thumb",
  "Wallace Klim": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wallaceklim/thumb",
  "Tecia Pacheco": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-teciapacheco/thumb",
  // Corporations (from RSI store captures)
  "ArcCorp": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/27c262c6-92ee-4a28-da94-4f89a346ea00/thumb",
  "Crusader Industries": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/996a1753-fbaf-4f89-b8a8-7170deb19200/thumb",
  "Crusader Security": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3f935ae0-34db-4cc3-a366-de4525096900/thumb",
  "Hurston Dynamics": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/27339355-f4d7-410f-ae7f-8c9a50e1e800/thumb",
  "Constantine Hurston": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/548b0c5e-0cda-45e5-5106-11f21e82c400/thumb",
  "microTech": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/5174f2e7-4cd2-416c-da33-60c4f6703800/thumb",
  "Nine Tails": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/d1b3c772-6ad1-4f28-9442-4f8eae83fd00/thumb",
  "Recco Battaglia": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/32e468f1-f6eb-4e3f-89ab-34dfbb29fe00/thumb",
  "Rough & Ready": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3325e026-6f73-40be-1e6d-af1daed26d00/thumb",
  "Eckhart Security": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-eckhart/thumb",
  "Miles Eckhart": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-eckhart/thumb",
  "Shubin Interstellar": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-shubin/thumb",
  // Stubs — DDS was placeholder (<1KB), using closest match
  "Dead Saints": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "BlacJac": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "Hockrow Agency": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "FTL Courier": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-covalex/thumb",
  "Adagio Holdings": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3325e026-6f73-40be-1e6d-af1daed26d00/thumb",
  "Klescher Rehabilitation Facilities": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "Wikelo": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-ruto/thumb",
  "Wikelo Emporium": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-ruto/thumb",
  // Factions with SC Wiki sourced logos (no real DDS in p4k)
  "Rayari Incorporated": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-rayari/thumb",
  "Wildstar Racing": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wildstar/thumb",
  "Highpoint Wilderness Specialists": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-rayari/thumb",
  // Career rep icons
  "Courier": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/192e600f-3f01-4c30-f237-846fad451e00/thumb",
  "Bounty": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bountyhuntersguild/thumb",
  "Bounty Hunting": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bountyhuntersguild/thumb",
  "Hired Muscle": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "Assassination": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-vaughn/thumb",
  "Security": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "Mercenary": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
}

// Build a case-insensitive lookup once
const _logoLookup = Object.fromEntries(
  Object.entries(FACTION_LOGOS).map(([k, v]) => [k.toLowerCase(), v])
)

/** Get faction logo URL — case-insensitive, strips parenthetical scopes */
function getFactionLogo(scopeName) {
  if (!scopeName) return null
  const lower = scopeName.toLowerCase()
  if (_logoLookup[lower]) return _logoLookup[lower]
  // Strip parenthetical: "Hurston Dynamics (Security)" → "Hurston Dynamics"
  const base = lower.replace(/\s*\(.*\)$/, '')
  if (_logoLookup[base]) return _logoLookup[base]
  // Try first word: "Citizens For Prosperity" → "citizens"
  const first = base.split(' ')[0]
  return _logoLookup[first] || null
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

// ── Faction cards (contract generators) ────────────────────────────────────

const GUILD_LABELS = {
  thecouncil_guild: 'The Council', mercenary_guild: 'Mercenary Guild',
  unitedresourceworkers_guild: 'United Resource Workers', interstellartransport_guild: 'Interstellar Transport',
  academyofsciences_guild: 'Academy of Sciences', imperialsportsfederation_guild: 'Imperial Sports Federation',
  missionproviders: 'Mission Providers',
}

const SYSTEM_PILL_COLORS = {
  Stanton: 'bg-sc-accent/10 text-sc-accent', Nyx: 'bg-purple-500/10 text-purple-400', Pyro: 'bg-orange-500/10 text-orange-400',
}

function FactionCard({ faction }) {
  const logo = FACTION_LOGOS[faction.name] || FACTION_LOGOS[faction.faction_name]
  const guild = GUILD_LABELS[faction.guild] || ''
  // Link to the first generator for now — faction page will show all
  const linkTo = faction.generators.length === 1
    ? `/missions/${faction.generators[0].generator_key}`
    : `/missions/faction/${encodeURIComponent(faction.name)}`
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

  const loading = cLoading || mLoading || gLoading
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
          All Missions <span className="opacity-60 ml-1">{allEntries.length}</span>
        </Pill>
        <Pill active={view === 'factions'} onClick={() => setParam('view', 'factions')}>
          <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Factions <span className="opacity-60">{new Set((missionGivers || []).map(g => g.display_name)).size}</span></span>
        </Pill>
        <Pill active={view === 'types'} onClick={() => setParam('view', 'types')}>
          <span className="flex items-center gap-1.5"><Crosshair className="w-3 h-3" /> Types <span className="opacity-60">{filteredTypes.length}</span></span>
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
                        to={`/missions/${scope.generator_key}`}
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
