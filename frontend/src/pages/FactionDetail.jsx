import React, { useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MapPin, FlaskConical, Shield, Users, Building2, ChevronRight } from 'lucide-react'
import { useMissionGivers } from '../hooks/useAPI'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const FACTION_LOGOS = {
  "Bit Zeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7aefb7ea-382e-47f6-a764-c3a1ed6a4100/thumb",
  "Bounty Hunters Guild": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/2c470ed3-c48f-4f7d-6602-edfa4c11ef00/thumb",
  "Citizens for Prosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7b5eddef-f623-42e0-3fcb-e89cab339f00/thumb",
  "Dead Saints": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/b87b8b32-4d6d-470c-28fd-65d8dc4deb00/thumb",
  "Eckhart Security": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f25e6101-0e33-4791-f610-dcae7e779c00/thumb",
  "Foxwell Enforcement": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3f935ae0-34db-4cc3-a366-de4525096900/thumb",
  "Headhunters": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/92c123e0-7cfd-49a8-7773-8e50bc5a8a00/thumb",
  "Hockrow Agency": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/5bd232e1-2143-435b-6d63-84ea08582700/thumb",
  "InterSec Defense Solutions": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/5bd232e1-2143-435b-6d63-84ea08582700/thumb",
  "Northrock Service Group": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/0a4117c0-bc8b-4767-9f2d-28c62e3bb900/thumb",
  "Shubin Interstellar": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/996a1753-fbaf-4f89-b8a8-7170deb19200/thumb",
  "Vaughn": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f3a02e36-4094-40b4-7072-2f178d791d00/thumb",
  "Ruto": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/cc3d3f9d-b164-465e-f783-8d2d847c1d00/thumb",
  "Tar Pits": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/925577fc-724c-4b5e-d32a-528603b56700/thumb",
  "Clovus Darneely": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/7c33c780-9165-4555-2a8e-9c6bb10e9800/thumb",
  "Wallace Klim": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/66b49547-c443-4970-77ee-2900bfc9a600/thumb",
  "Civilian Defense Force": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/b24f29b8-0884-4f05-18b5-e0f58701b400/thumb",
  "Rough & Ready": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/3325e026-6f73-40be-1e6d-af1daed26d00/thumb",
  "Tecia Pacheco": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f860ed6b-0e2c-44d1-c71d-de1f52d57400/thumb",
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
