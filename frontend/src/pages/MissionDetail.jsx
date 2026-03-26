import React, { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Shield, MapPin, ChevronDown, FlaskConical, Crosshair, Target } from 'lucide-react'
import { useMissionDetail } from '../hooks/useAPI'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import PageHeader from '../components/PageHeader'

// Reuse faction logos from Contracts page
const FACTION_LOGOS = {
  "Bitzeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7aefb7ea-382e-47f6-a764-c3a1ed6a4100/thumb",
  "Bit Zeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7aefb7ea-382e-47f6-a764-c3a1ed6a4100/thumb",
  "Bounty Hunters Guild": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/2c470ed3-c48f-4f7d-6602-edfa4c11ef00/thumb",
  "Citizensforprosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7b5eddef-f623-42e0-3fcb-e89cab339f00/thumb",
  "Cfp": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7b5eddef-f623-42e0-3fcb-e89cab339f00/thumb",
  "Citizens For Prosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7b5eddef-f623-42e0-3fcb-e89cab339f00/thumb",
  "Dead Saints": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/b87b8b32-4d6d-470c-28fd-65d8dc4deb00/thumb",
  "Eckhart": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f25e6101-0e33-4791-f610-dcae7e779c00/thumb",
  "Foxwell": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3f935ae0-34db-4cc3-a366-de4525096900/thumb",
  "Headhunters": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/92c123e0-7cfd-49a8-7773-8e50bc5a8a00/thumb",
  "Hockrow": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/5bd232e1-2143-435b-6d63-84ea08582700/thumb",
  "Intersec": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/5bd232e1-2143-435b-6d63-84ea08582700/thumb",
  "Northrock": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/0a4117c0-bc8b-4767-9f2d-28c62e3bb900/thumb",
  "Shubin": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/996a1753-fbaf-4f89-b8a8-7170deb19200/thumb",
  "Vaughn": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f3a02e36-4094-40b4-7072-2f178d791d00/thumb",
  "Rayari": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/996a1753-fbaf-4f89-b8a8-7170deb19200/thumb",
  "Highpoint": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/996a1753-fbaf-4f89-b8a8-7170deb19200/thumb",
}

function getFactionLogo(name) {
  if (!name) return null
  if (FACTION_LOGOS[name]) return FACTION_LOGOS[name]
  // Try first word
  const first = name.split(' ')[0]
  return FACTION_LOGOS[first] || null
}

const GUILD_LABELS = {
  thecouncil_guild: 'The Council',
  mercenary_guild: 'Mercenary Guild',
  unitedresourceworkers_guild: 'United Resource Workers',
  interstellartransport_guild: 'Interstellar Transport',
  academyofsciences_guild: 'Academy of Sciences',
  imperialsportsfederation_guild: 'Imperial Sports Federation',
  missionproviders: 'Mission Providers',
}

const DIFFICULTY_COLORS = {
  Intro: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  VeryEasy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Easy: 'bg-green-500/15 text-green-400 border-green-500/20',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Hard: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  VeryHard: 'bg-red-500/15 text-red-400 border-red-500/20',
  Super: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

const SYSTEM_COLORS = {
  Stanton: 'text-sc-accent',
  Nyx: 'text-purple-400',
  Pyro: 'text-orange-400',
}

const TYPE_COLORS = {
  armour: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  weapons: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  ammo: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
}

function BlueprintChip({ bp }) {
  const tc = TYPE_COLORS[bp.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  return (
    <Link
      to={`/crafting/${bp.id}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-sc-accent/20 hover:bg-white/[0.04] transition-all text-xs group"
    >
      <span className={`px-1 py-0.5 rounded text-[9px] font-semibold uppercase ${tc.bg} ${tc.text} border ${tc.border}`}>
        {bp.type}
      </span>
      <span className="text-gray-300 group-hover:text-white transition-colors">{bp.name}</span>
    </Link>
  )
}

function CareerSection({ career }) {
  const system = career.system || 'Unknown'
  const systemColor = SYSTEM_COLORS[system] || 'text-gray-400'

  // Deduplicate difficulty tiers — show one row per difficulty with combined blueprint pools
  const byDifficulty = useMemo(() => {
    const map = new Map()
    for (const c of career.contracts) {
      const diff = c.difficulty || 'Standard'
      if (!map.has(diff)) {
        map.set(diff, { difficulty: diff, pools: [], standing: { min: c.min_standing, max: c.max_standing } })
      }
      const entry = map.get(diff)
      for (const p of c.blueprint_pools || []) {
        if (!entry.pools.some(ep => ep.pool_key === p.pool_key)) {
          entry.pools.push(p)
        }
      }
    }
    return [...map.values()]
  }, [career.contracts])

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-gray-500" />
        <span className={`text-sm font-medium ${systemColor}`}>{system}</span>
        <span className="text-[10px] text-gray-600">{career.contracts.length} tier{career.contracts.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {byDifficulty.map((tier, i) => {
          const dc = DIFFICULTY_COLORS[tier.difficulty] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
          return (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${dc} min-w-[70px] text-center`}>
                {tier.difficulty}
              </span>
              <div className="flex-1">
                {tier.pools.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tier.pools.map((pool, pi) => (
                      <span key={pi} className="text-[10px] text-gray-500 bg-white/[0.03] border border-white/[0.05] rounded px-1.5 py-0.5">
                        {pool.pool_name || pool.pool_key}
                        {pool.chance < 1 && <span className="text-gray-600 ml-1">({Math.round(pool.chance * 100)}%)</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-600 italic">No blueprint rewards</span>
                )}
              </div>
              {tier.standing.min && (
                <span className="text-[10px] text-gray-600">
                  Rep: {tier.standing.min}{tier.standing.max ? `–${tier.standing.max}` : '+'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MissionDetail() {
  const { key } = useParams()
  const { data, loading, error, refetch } = useMissionDetail(key)

  if (loading) return <LoadingState fullScreen message="Loading mission..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-300 mb-2">Mission Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">This contract generator doesn't exist.</p>
        <Link to="/crafting" className="text-sm text-sc-accent hover:text-sc-accent/80 transition-colors">
          &larr; Back to Crafting
        </Link>
      </div>
    )
  }

  const { generator, careers, all_blueprints } = data
  const logo = getFactionLogo(generator.display_name) || getFactionLogo(generator.faction_name)
  const guildLabel = GUILD_LABELS[generator.guild] || generator.guild?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <Link
        to="/crafting"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sc-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Crafting
      </Link>

      {/* Header */}
      <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sc-accent/20 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sc-accent/20 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sc-accent/20 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sc-accent/20 rounded-br-2xl" />

        <div className="flex items-start gap-4">
          {logo && (
            <img src={logo} alt="" className="w-14 h-14 rounded-lg border border-white/[0.06] object-cover" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {guildLabel && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 bg-white/[0.04] border border-white/[0.06] uppercase tracking-wider">
                  {guildLabel}
                </span>
              )}
              {generator.mission_type && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20">
                  {generator.mission_type}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
              {generator.display_name || generator.key}
            </h1>
            {generator.faction_name && generator.faction_name !== generator.display_name && (
              <p className="text-sm text-gray-500 mt-1">Faction: {generator.faction_name}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{careers.length} system{careers.length !== 1 ? 's' : ''}</span>
              <span>{all_blueprints.length} blueprint reward{all_blueprints.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Career tiers by system */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          Difficulty Tiers by System
        </h2>
        <div className="space-y-3">
          {careers.map((career, i) => (
            <CareerSection key={i} career={career} />
          ))}
        </div>
      </div>

      {/* All blueprint rewards */}
      {all_blueprints.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5" />
            Blueprint Rewards ({all_blueprints.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {all_blueprints.map(bp => (
              <BlueprintChip key={bp.id} bp={bp} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
