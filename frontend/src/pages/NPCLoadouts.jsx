import React, { useState } from 'react'
import { useNPCLoadouts, useNPCFactionLoadouts } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { Link } from 'react-router-dom'
import { Users, ChevronDown, ChevronRight, ArrowLeft, Shield, Shirt, Crosshair, Wrench, Bug, Swords } from 'lucide-react'

const CATEGORY_ICONS = {
  armor: Shield,
  clothing: Shirt,
  weapon: Crosshair,
  utility: Wrench,
  creature: Bug,
  vanduul: Swords,
  banu: Users,
  body: Users,
  unknown: Users,
}

const CATEGORY_COLORS = {
  armor: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  clothing: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  weapon: 'text-red-400 bg-red-400/10 border-red-400/30',
  utility: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  creature: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  vanduul: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  banu: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  body: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  unknown: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
}

const FACTION_COLORS = [
  'border-red-500/40 hover:border-red-500/60',
  'border-amber-500/40 hover:border-amber-500/60',
  'border-emerald-500/40 hover:border-emerald-500/60',
  'border-cyan-500/40 hover:border-cyan-500/60',
  'border-blue-500/40 hover:border-blue-500/60',
  'border-violet-500/40 hover:border-violet-500/60',
  'border-pink-500/40 hover:border-pink-500/60',
  'border-orange-500/40 hover:border-orange-500/60',
  'border-lime-500/40 hover:border-lime-500/60',
  'border-teal-500/40 hover:border-teal-500/60',
  'border-indigo-500/40 hover:border-indigo-500/60',
  'border-rose-500/40 hover:border-rose-500/60',
]

function FactionCard({ faction, index, onClick }) {
  const borderColor = FACTION_COLORS[index % FACTION_COLORS.length]
  return (
    <button
      onClick={onClick}
      className={`panel p-4 text-left transition-all duration-150 hover:bg-white/[0.04] border-l-2 ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display uppercase tracking-wider text-white">{faction.name}</h3>
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex gap-3 mt-2 text-xs text-gray-500 font-mono">
        <span>{faction.loadout_count} loadouts</span>
        <span>{faction.item_count} items</span>
      </div>
    </button>
  )
}

function LoadoutTree({ items }) {
  if (!items || items.length === 0) return null

  // Build tree from flat items using parent_port
  const topLevel = items.filter(i => !i.parent_port)
  const childrenOf = (portName) => items.filter(i => i.parent_port === portName)

  function renderItem(item, depth = 0) {
    const children = childrenOf(item.port_name)
    const displayName = item.resolved_name || item.item_name
    const hasLootLink = item.loot_uuid

    return (
      <div key={`${item.port_name}-${item.item_name}`} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 py-1">
          <span className="text-[10px] font-mono text-gray-600 uppercase shrink-0 w-24 truncate" title={item.port_name}>
            {item.port_name.replace('Armor_', '').replace('wep_stocked_', 'Weapon ')}
          </span>
          {hasLootLink ? (
            <Link
              to={`/loot/${item.loot_uuid}`}
              className="text-xs font-mono text-sc-accent hover:underline truncate"
              title={displayName}
            >
              {displayName}
            </Link>
          ) : (
            <span className="text-xs font-mono text-gray-300 truncate" title={displayName}>
              {displayName}
            </span>
          )}
          {item.tag && (
            <span className="text-[9px] font-mono text-gray-600 shrink-0">
              {item.tag.replace('Char_Armor_', '').replace('Char_', '').replace('WeaponPersonal', 'Weapon')}
            </span>
          )}
        </div>
        {children.map(child => renderItem(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      {topLevel.map(item => renderItem(item))}
    </div>
  )
}

function LoadoutCard({ loadout }) {
  const [expanded, setExpanded] = useState(false)
  const categoryColor = CATEGORY_COLORS[loadout.category] || CATEGORY_COLORS.unknown
  const CategoryIcon = CATEGORY_ICONS[loadout.category] || Users

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <CategoryIcon className="w-4 h-4 text-gray-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-mono text-gray-200 truncate block">
            {loadout.loadout_name.replace(/_/g, ' ')}
          </span>
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${categoryColor}`}>
          {loadout.category}
        </span>
        {loadout.sub_category && (
          <span className="text-[10px] font-mono text-gray-600 px-1.5 py-0.5 rounded bg-gray-800">
            {loadout.sub_category}
          </span>
        )}
        <span className="text-[10px] font-mono text-gray-600">
          {loadout.items?.length || 0} items
        </span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        )}
      </button>
      {expanded && loadout.items && (
        <div className="border-t border-sc-border/30 bg-sc-bg/50">
          <LoadoutTree items={loadout.items} />
        </div>
      )}
    </div>
  )
}

function FactionDetail({ factionCode, onBack }) {
  const { data, loading, error, refetch } = useNPCFactionLoadouts(factionCode)

  if (loading) return <LoadingState message="Loading loadouts..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { faction, loadouts } = data

  // Group loadouts by category
  const grouped = {}
  for (const loadout of loadouts) {
    const cat = loadout.category || 'unknown'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(loadout)
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Factions
        </button>
        <h2 className="font-display font-bold text-xl tracking-wider text-white">{faction.name}</h2>
        <span className="text-xs font-mono text-gray-500">{loadouts.length} loadouts</span>
      </div>

      <div className="glow-line" />

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catLoadouts]) => (
        <div key={category}>
          <h3 className="text-xs font-display uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
            {React.createElement(CATEGORY_ICONS[category] || Users, { className: 'w-3.5 h-3.5' })}
            {category} ({catLoadouts.length})
          </h3>
          <div className="space-y-1">
            {catLoadouts.map((loadout) => (
              <LoadoutCard key={loadout.id} loadout={loadout} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NPCLoadouts() {
  const { data: factions, loading, error, refetch } = useNPCLoadouts()
  const [selectedFaction, setSelectedFaction] = useState(null)

  if (loading) return <LoadingState message="Loading NPC factions..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  if (selectedFaction) {
    return <FactionDetail factionCode={selectedFaction} onBack={() => setSelectedFaction(null)} />
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="NPC Loadouts"
        subtitle="What gear do NPCs wear and carry, organized by faction"
      />

      <div className="glow-line" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {(factions || []).map((faction, i) => (
          <FactionCard
            key={faction.id}
            faction={faction}
            index={i}
            onClick={() => setSelectedFaction(faction.code)}
          />
        ))}
      </div>
    </div>
  )
}
