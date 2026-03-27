import React, { useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MapPin, FlaskConical, Shield, Users, Building2, ChevronRight } from 'lucide-react'
import { useMissionGivers } from '../hooks/useAPI'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const FACTION_LOGOS = {
  "Bit Zeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bitzeros/thumb",
  "Bounty Hunters Guild": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bountyhuntersguild/thumb",
  "Citizens for Prosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cfp/thumb",
  "Dead Saints": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "Eckhart Security": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-eckhart/thumb",
  "Foxwell Enforcement": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-foxwellenforcement/thumb",
  "Headhunters": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "Hockrow Agency": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "InterSec Defense Solutions": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "Northrock Service Group": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-northrock/thumb",
  "Shubin Interstellar": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-shubin/thumb",
  "Vaughn": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-vaughn/thumb",
  "Ruto": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-ruto/thumb",
  "Tar Pits": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-tarpits/thumb",
  "Clovus Darneely": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-clovusdarneely/thumb",
  "Wallace Klim": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wallaceklim/thumb",
  "Civilian Defense Force": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "Rough & Ready": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3325e026-6f73-40be-1e6d-af1daed26d00/thumb",
  "Tecia Pacheco": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-teciapacheco/thumb",
  "Ling Family Hauling": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-lingfamily/thumb",
  "Red Wind Linehaul": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-redwind/thumb",
  "Covalex": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-covalex/thumb",
  "XenoThreat": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-xenothreat/thumb",
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

export default function FactionDetail() {
  const { name } = useParams()
  const decodedName = decodeURIComponent(name)
  const [searchParams, setSearchParams] = useSearchParams()
  const typeFilter = searchParams.get('type') || ''
  const { data: missionGivers, loading, error } = useMissionGivers()

  // Get all generators for this faction
  const generators = useMemo(() => {
    if (!missionGivers) return []
    return missionGivers.filter(g => g.display_name === decodedName)
  }, [missionGivers, decodedName])

  // Aggregate faction info
  const faction = useMemo(() => {
    if (generators.length === 0) return null
    const first = generators[0]
    const allSystems = [...new Set(generators.flatMap(g => g.systems.filter(Boolean)))]
    const allTypes = [...new Set(generators.map(g => g.mission_type).filter(Boolean))]
    const totalBlueprints = generators.reduce((s, g) => s + (g.blueprint_count || 0), 0)
    return {
      name: first.display_name,
      faction_name: first.faction_name,
      guild: first.guild,
      focus: first.focus,
      description: first.description,
      systems: allSystems,
      mission_types: allTypes,
      blueprint_count: totalBlueprints,
    }
  }, [generators])

  // Filter by type
  const filtered = typeFilter ? generators.filter(g => g.mission_type === typeFilter) : generators

  if (loading) return <LoadingState fullScreen message="Loading faction..." />
  if (error) return <ErrorState message={error} />
  if (!faction) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-300 mb-2">Faction Not Found</h2>
        <Link to="/missions?view=factions" className="text-sm text-sc-accent hover:text-sc-accent/80 transition-colors">&larr; Back to Factions</Link>
      </div>
    )
  }

  const logo = FACTION_LOGOS[faction.name]
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
          {logo && <img src={logo} alt={faction.name} className="w-36 h-36 rounded-xl border border-white/[0.08] object-cover shrink-0 shadow-lg shadow-black/30 bg-white/[0.02]" />}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {guildLabel && <span className="px-2 py-0.5 rounded text-[10px] text-gray-500 bg-white/[0.04] border border-white/[0.06] uppercase tracking-wider">{guildLabel}</span>}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide mb-1" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
              {faction.name}
            </h1>
            {faction.focus && <p className="text-sm text-gray-400 mb-3">{faction.focus}</p>}
            {faction.description && <p className="text-sm text-gray-500 leading-relaxed">{faction.description}</p>}
          </div>
        </div>
      </div>

      {/* Systems */}
      {faction.systems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-gray-600">Active in</span>
          {faction.systems.map(sys => (
            <span key={sys} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${SYSTEM_COLORS[sys] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
              <MapPin className="w-3.5 h-3.5" /> {sys}
            </span>
          ))}
          {faction.blueprint_count > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <FlaskConical className="w-3.5 h-3.5" /> {faction.blueprint_count} blueprints
            </span>
          )}
        </div>
      )}

      {/* Type filter pills */}
      {faction.mission_types.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSearchParams({})}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              !typeFilter ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            All ({generators.length})
          </button>
          {faction.mission_types.map(t => (
            <button
              key={t}
              onClick={() => setSearchParams({ type: t })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                typeFilter === t ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Mission type cards */}
      <div className="space-y-3">
        {filtered.map(g => (
          <Link
            key={g.generator_key}
            to={`/missions/${g.generator_key}`}
            className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-sc-accent/25 hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 mb-1 inline-block">
                {g.mission_type}
              </span>
              <h3 className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                {g.display_name} — {g.mission_type}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {g.systems.filter(Boolean).map(sys => (
                  <span key={sys} className={`text-[9px] px-1.5 py-0.5 rounded ${SYSTEM_COLORS[sys]?.replace('border-', '').split(' ').slice(0, 2).join(' ') || 'bg-gray-500/10 text-gray-400'}`}>
                    {sys}
                  </span>
                ))}
                {g.blueprint_count > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                    {g.blueprint_count} blueprints
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-sc-accent transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
