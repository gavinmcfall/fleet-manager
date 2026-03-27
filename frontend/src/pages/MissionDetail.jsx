import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, MapPin, FlaskConical, Shield, Users, Building2, Crosshair } from 'lucide-react'
import { useMissionDetail } from '../hooks/useAPI'
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
  "Tecia Pacheco": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f860ed6b-0e2c-44d1-c71d-de1f52d57400/thumb",
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

const SYSTEM_COLORS = {
  Stanton: 'bg-sc-accent/10 text-sc-accent border-sc-accent/20',
  Nyx: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Pyro: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const TYPE_COLORS = {
  armour: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  weapons: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  ammo: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
}

const TYPE_LABELS = { armour: 'Armour', weapons: 'Weapons', ammo: 'Ammo' }

function BlueprintCard({ bp }) {
  const tc = TYPE_COLORS[bp.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  return (
    <Link
      to={`/crafting/${bp.id}`}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-sc-accent/20 hover:bg-white/[0.04] transition-all group"
    >
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${tc.bg} ${tc.text} border ${tc.border}`}>
        {TYPE_LABELS[bp.type] || bp.type}
      </span>
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{bp.name}</span>
    </Link>
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

  const { generator, systems, rep_range, all_blueprints } = data
  const logo = FACTION_LOGOS[generator.display_name] || FACTION_LOGOS[generator.faction_name]
  const guildLabel = GUILD_LABELS[generator.guild] || generator.guild?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // Group blueprints by type
  const bpByType = {}
  for (const bp of all_blueprints) {
    const t = bp.type || 'other'
    if (!bpByType[t]) bpByType[t] = []
    bpByType[t].push(bp)
  }
  const typeOrder = ['weapons', 'armour', 'ammo']
  const sortedTypes = typeOrder.filter(t => bpByType[t])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <Link to="/crafting" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sc-accent transition-colors">
        <ArrowLeft className="w-4 h-4" /> Crafting
      </Link>

      {/* Header */}
      <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sc-accent/20 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sc-accent/20 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sc-accent/20 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sc-accent/20 rounded-br-2xl" />

        <div className="flex items-start gap-5">
          {logo && (
            <img src={logo} alt="" className="w-16 h-16 rounded-lg border border-white/[0.08] object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {guildLabel && (
                <span className="px-2 py-0.5 rounded text-[10px] text-gray-500 bg-white/[0.04] border border-white/[0.06] uppercase tracking-wider">
                  {guildLabel}
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20">
                {generator.mission_type}
              </span>
            </div>

            {/* Name */}
            <h1 className="text-2xl font-bold text-white tracking-wide mb-1" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
              {generator.display_name}
            </h1>

            {/* Focus line */}
            {generator.focus && (
              <p className="text-sm text-gray-400 mb-2">
                <span className="text-gray-600">Focus:</span> {generator.focus}
              </p>
            )}

            {/* Description */}
            {generator.description && (
              <p className="text-sm text-gray-500 leading-relaxed">
                {generator.description}
              </p>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-white/[0.06]">
          {generator.headquarters && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 className="w-3.5 h-3.5 text-gray-600" />
              {generator.headquarters}
            </span>
          )}
          {generator.leadership && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Users className="w-3.5 h-3.5 text-gray-600" />
              Led by {generator.leadership}
            </span>
          )}
          {systems.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-600" />
              {systems.join(', ')}
            </span>
          )}
          {rep_range && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Shield className="w-3.5 h-3.5 text-gray-600" />
              Rep {rep_range.min} – {rep_range.max}
            </span>
          )}
        </div>
      </div>

      {/* Systems available */}
      {systems.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Available In</h2>
          <div className="flex flex-wrap gap-2">
            {systems.map(sys => {
              const sc = SYSTEM_COLORS[sys] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
              return (
                <span key={sys} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${sc}`}>
                  <MapPin className="w-3.5 h-3.5" />
                  {sys}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Blueprint rewards */}
      {all_blueprints.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5" />
            Blueprint Rewards ({all_blueprints.length})
          </h2>
          <div className="space-y-4">
            {sortedTypes.map(type => {
              const bps = bpByType[type]
              const tc = TYPE_COLORS[type] || {}
              return (
                <div key={type}>
                  <h3 className={`text-xs font-medium uppercase tracking-wider mb-2 ${tc.text || 'text-gray-400'}`}>
                    {TYPE_LABELS[type] || type} ({bps.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {bps.map(bp => <BlueprintCard key={bp.id} bp={bp} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
