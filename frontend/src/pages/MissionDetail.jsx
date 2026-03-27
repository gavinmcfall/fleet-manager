import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, MapPin, FlaskConical, Shield, Users, Building2, Info } from 'lucide-react'
import { useMissionDetail } from '../hooks/useAPI'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const FACTION_LOGOS = {
  "Bit Zeros": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bitzeros/thumb",
  "Bounty Hunters Guild": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-bountyhuntersguild/thumb",
  "Citizens for Prosperity": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cfp/thumb",
  "Dead Saints": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "Eckhart Security": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/f25e6101-0e33-4791-f610-dcae7e779c00/thumb",
  "Foxwell Enforcement": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-foxwellenforcement/thumb",
  "Headhunters": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-headhunters/thumb",
  "Hockrow Agency": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "InterSec Defense Solutions": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-intersec/thumb",
  "Northrock Service Group": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-northrock/thumb",
  "Shubin Interstellar": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/996a1753-fbaf-4f89-b8a8-7170deb19200/thumb",
  "Vaughn": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-vaughn/thumb",
  "Ruto": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-ruto/thumb",
  "Tar Pits": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-tarpits/thumb",
  "Clovus Darneely": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-clovusdarneely/thumb",
  "Wallace Klim": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-wallaceklim/thumb",
  "Tecia Pacheco": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-teciapacheco/thumb",
  "Ling Family Hauling": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-lingfamily/thumb",
  "Red Wind Linehaul": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-redwind/thumb",
  "Covalex": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-covalex/thumb",
  "Civilian Defense Force": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-cdf/thumb",
  "XenoThreat": "https://imagedelivery.net/JnUjHiDCDHvj44u4fjoYBg/faction-logo-xenothreat/thumb",
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

// Faction reputation ranks — shared across all factions
const RANKS = [
  { rank: 0, name: 'Neutral', min_rep: 0 },
  { rank: 1, name: 'Jr. Contractor', min_rep: 800 },
  { rank: 2, name: 'Contractor', min_rep: 2200 },
  { rank: 3, name: 'Sr. Contractor', min_rep: 5800 },
  { rank: 4, name: 'Veteran Contractor', min_rep: 15000 },
  { rank: 5, name: 'Head Contractor', min_rep: 38000 },
  { rank: 6, name: 'Elite Contractor', min_rep: 95250 },
]

const SYSTEM_COLORS = {
  Stanton: 'bg-sc-accent/10 text-sc-accent border-sc-accent/20',
  Nyx: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Pyro: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const DIFF_COLORS = {
  Intro: 'text-gray-400',
  VeryEasy: 'text-emerald-400',
  Easy: 'text-green-400',
  Medium: 'text-amber-400',
  Hard: 'text-orange-400',
  VeryHard: 'text-red-400',
  Super: 'text-purple-400',
}
const DIFF_BAR_COLORS = {
  Intro: 'bg-gray-500/50',
  VeryEasy: 'bg-emerald-500/60',
  Easy: 'bg-green-500/60',
  Medium: 'bg-amber-500/60',
  Hard: 'bg-orange-500/60',
  VeryHard: 'bg-red-500/60',
  Super: 'bg-purple-500/60',
}
const DIFF_BAR_GLOW = {
  Intro: '',
  VeryEasy: 'shadow-[inset_0_0_8px_rgba(16,185,129,0.3)]',
  Easy: 'shadow-[inset_0_0_8px_rgba(34,197,94,0.3)]',
  Medium: 'shadow-[inset_0_0_8px_rgba(245,158,11,0.3)]',
  Hard: 'shadow-[inset_0_0_8px_rgba(249,115,22,0.3)]',
  VeryHard: 'shadow-[inset_0_0_8px_rgba(239,68,68,0.3)]',
  Super: 'shadow-[inset_0_0_8px_rgba(168,85,247,0.3)]',
}
const DIFF_LABELS = { VeryEasy: 'Very Easy', VeryHard: 'Very Hard' }

const TYPE_COLORS = {
  armour: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  weapons: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  ammo: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
}
const TYPE_LABELS = { armour: 'Armour', weapons: 'Weapons', ammo: 'Ammo' }

function formatRep(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

function RepProgressionBar({ tiers }) {
  return (
    <div>
      {/* Rep thresholds above */}
      <div className="flex mb-1">
        {RANKS.map((r, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] font-mono text-gray-500">{formatRep(r.min_rep)}</span>
          </div>
        ))}
      </div>

      {/* Bar — taller, with glow on active segments */}
      <div className="flex h-5 rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06]">
        {RANKS.map((r, i) => {
          const tier = tiers.find(t => t.min_rank === i)
          const barColor = tier ? (DIFF_BAR_COLORS[tier.difficulty] || 'bg-gray-500/30') : 'bg-white/[0.02]'
          const glow = tier ? (DIFF_BAR_GLOW[tier.difficulty] || '') : ''
          return (
            <div
              key={i}
              className={`flex-1 ${barColor} ${glow} ${i > 0 ? 'border-l border-white/[0.08]' : ''} flex items-center justify-center transition-all`}
              title={tier ? `${DIFF_LABELS[tier.difficulty] || tier.difficulty} — ${r.name}` : r.name}
            >
              {tier && (
                <span className={`text-[8px] font-bold uppercase tracking-wider ${DIFF_COLORS[tier.difficulty] || 'text-gray-500'} drop-shadow-sm`}>
                  {(DIFF_LABELS[tier.difficulty] || tier.difficulty).slice(0, 6)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Rank names below */}
      <div className="flex mt-1">
        {RANKS.map((r, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[9px] text-gray-400 leading-tight">{r.name}</span>
          </div>
        ))}
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
        <Link to="/crafting" className="text-sm text-sc-accent hover:text-sc-accent/80 transition-colors">&larr; Back to Crafting</Link>
      </div>
    )
  }

  const { generator, systems, tiers, all_blueprints } = data
  const logo = FACTION_LOGOS[generator.display_name] || FACTION_LOGOS[generator.faction_name]
  const guildLabel = GUILD_LABELS[generator.guild] || generator.guild?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const bpByType = {}
  for (const bp of all_blueprints) {
    const t = bp.type || 'other'
    if (!bpByType[t]) bpByType[t] = []
    bpByType[t].push(bp)
  }
  const typeOrder = ['weapons', 'armour', 'ammo'].filter(t => bpByType[t])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link to="/crafting" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sc-accent transition-colors">
        <ArrowLeft className="w-4 h-4" /> Crafting
      </Link>

      {/* ── Header — logo prominent on left, info on right ── */}
      <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sc-accent/20 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sc-accent/20 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sc-accent/20 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sc-accent/20 rounded-br-2xl" />

        <div className="flex items-start gap-6">
          {/* Logo — large and prominent, matches card height */}
          {logo && (
            <img src={logo} alt={generator.display_name} className="w-36 h-36 rounded-xl border border-white/[0.08] object-cover shrink-0 shadow-lg shadow-black/30 bg-white/[0.02]" />
          )}

          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {guildLabel && (
                <span className="px-2 py-0.5 rounded text-[10px] text-gray-500 bg-white/[0.04] border border-white/[0.06] uppercase tracking-wider">{guildLabel}</span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20">{generator.mission_type}</span>
            </div>

            {/* Name */}
            <h1 className="text-2xl font-bold text-white tracking-wide mb-1" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
              {generator.display_name}
            </h1>

            {/* Focus */}
            {generator.focus && (
              <p className="text-sm text-gray-400 mb-3">{generator.focus}</p>
            )}

            {/* Description */}
            {generator.description && (
              <p className="text-sm text-gray-500 leading-relaxed mb-3">{generator.description}</p>
            )}

            {/* Faction meta */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
              {generator.headquarters && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-gray-600" />
                  HQ: {generator.headquarters}
                </span>
              )}
              {generator.leadership && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-gray-600" />
                  Led by {generator.leadership}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Systems + HQ ── */}
      {systems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-gray-600">Missions available in</span>
          {systems.map(sys => (
            <span key={sys} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${SYSTEM_COLORS[sys] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
              <MapPin className="w-3.5 h-3.5" /> {sys}
            </span>
          ))}
        </div>
      )}

      {/* ── Difficulty tiers ── */}
      {tiers && tiers.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Mission Difficulty
          </h2>

          {/* Rep progression bar */}
          <RepProgressionBar tiers={tiers} />

          {/* Tier table */}
          <div className="border border-white/[0.06] rounded-lg overflow-hidden mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Mission Difficulty</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Required Rank</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Rep Reward</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(tier => {
                  const rankInfo = RANKS[tier.min_rank] || { name: `Rank ${tier.min_rank}`, min_rep: 0 }
                  return (
                    <tr key={tier.difficulty} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className={`px-4 py-2.5 text-xs font-medium ${DIFF_COLORS[tier.difficulty] || 'text-gray-400'}`}>
                        {DIFF_LABELS[tier.difficulty] || tier.difficulty}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {rankInfo.name}
                        <span className="text-gray-600 ml-1.5 font-mono text-[10px]">
                          ({formatRep(rankInfo.min_rep)} rep)
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                        {tier.rep_reward ? (
                          <span className="text-emerald-400">+{tier.rep_reward}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Blueprint pool note */}
          {all_blueprints.length > 0 && (
            <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-sc-accent/5 border border-sc-accent/10">
              <Info className="w-3.5 h-3.5 text-sc-accent mt-0.5 shrink-0" />
              <p className="text-xs text-gray-400">
                <span className="text-sc-accent font-medium">Blueprint drops are the same at all difficulty levels.</span>{' '}
                Higher difficulty increases aUEC and reputation rewards, not the blueprint loot pool.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Blueprint rewards ── */}
      {all_blueprints.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5" /> Blueprint Rewards ({all_blueprints.length})
          </h2>
          <div className="space-y-4">
            {typeOrder.map(type => {
              const bps = bpByType[type]
              const tc = TYPE_COLORS[type] || {}
              return (
                <div key={type}>
                  <h3 className={`text-xs font-medium uppercase tracking-wider mb-2 ${tc.text || 'text-gray-400'}`}>
                    {TYPE_LABELS[type] || type} ({bps.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {bps.map(bp => {
                      const btc = TYPE_COLORS[bp.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
                      return (
                        <Link
                          key={bp.id}
                          to={`/crafting/${bp.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-sc-accent/20 hover:bg-white/[0.04] transition-all group"
                        >
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${btc.bg} ${btc.text} border ${btc.border}`}>
                            {TYPE_LABELS[bp.type] || bp.type}
                          </span>
                          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{bp.name}</span>
                        </Link>
                      )
                    })}
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
