import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCrafting } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Hammer, Clock, ChevronDown, ChevronRight, Gem, FlaskConical } from 'lucide-react'

const TYPE_LABELS = {
  armour: 'Armour',
  weapons: 'Weapons',
  ammo: 'Ammo',
}

const SUBTYPE_LABELS = {
  combat: 'Combat',
  engineer: 'Engineer',
  hunter: 'Hunter',
  stealth: 'Stealth',
  miner: 'Miner',
  explorer: 'Explorer',
  cosmonaut: 'Cosmonaut',
  environment: 'Environment',
  salvager: 'Salvager',
  medic: 'Medic',
  radiation: 'Radiation',
  flightsuit: 'Flightsuit',
  racer: 'Racer',
  undersuit: 'Undersuit',
  pistol: 'Pistol',
  rifle: 'Rifle',
  smg: 'SMG',
  sniper: 'Sniper',
  shotgun: 'Shotgun',
  lmg: 'LMG',
  ballistic: 'Ballistic',
  laser: 'Laser',
  electron: 'Electron',
  plasma: 'Plasma',
}

function formatTime(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function ModifierBar({ mod }) {
  const range = mod.modifier_at_end - mod.modifier_at_start
  const isPositive = range > 0
  const pct = Math.abs(range * 100).toFixed(1)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-32 truncate">{mod.name}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(Math.abs(range) * 100, 100)}%` }}
        />
      </div>
      <span className={`w-14 text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{pct}%
      </span>
    </div>
  )
}

function BlueprintCard({ bp, expanded, onToggle }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Hammer className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="text-left">
            <p className="text-sm font-medium text-gray-200">{bp.name}</p>
            <p className="text-xs text-gray-500">
              {TYPE_LABELS[bp.type] || bp.type} &middot; {SUBTYPE_LABELS[bp.sub_type] || bp.sub_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(bp.craft_time_seconds)}
          </span>
          <span className="text-xs text-gray-500">{bp.slots?.length || 0} slots</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {expanded && bp.slots && (
        <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-3">
          {bp.slots.map((slot, i) => (
            <div key={i} className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">{slot.name}</span>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Gem className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-300">{slot.resource_name}</span>
                  <span>&times;{slot.quantity}</span>
                  {slot.min_quality > 0 && (
                    <span className="text-amber-400">min Q{slot.min_quality}</span>
                  )}
                </div>
              </div>
              {slot.modifiers && slot.modifiers.length > 0 && (
                <div className="space-y-1 mt-2">
                  {slot.modifiers.map((mod, j) => (
                    <ModifierBar key={j} mod={mod} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Crafting() {
  const { data, loading, error, refetch } = useCrafting()
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedId, setExpandedId] = useState(null)

  const search = searchParams.get('q') || ''
  const typeFilter = searchParams.get('type') || ''
  const subtypeFilter = searchParams.get('subtype') || ''
  const resourceFilter = searchParams.get('resource') || ''

  const setFilter = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    })
  }

  const blueprints = data?.blueprints || []
  const resources = data?.resources || []

  // Get unique types and subtypes
  const types = useMemo(() => [...new Set(blueprints.map(b => b.type))].sort(), [blueprints])
  const subtypes = useMemo(() => {
    const filtered = typeFilter ? blueprints.filter(b => b.type === typeFilter) : blueprints
    return [...new Set(filtered.map(b => b.sub_type))].sort()
  }, [blueprints, typeFilter])

  // Filter blueprints
  const filtered = useMemo(() => {
    let items = blueprints
    if (typeFilter) items = items.filter(b => b.type === typeFilter)
    if (subtypeFilter) items = items.filter(b => b.sub_type === subtypeFilter)
    if (resourceFilter) {
      items = items.filter(b =>
        b.slots?.some(s => s.resource_name === resourceFilter)
      )
    }
    if (search.trim()) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
      items = items.filter(b => {
        const haystack = `${b.name} ${b.type} ${b.sub_type}`.toLowerCase()
        return tokens.every(t => haystack.includes(t))
      })
    }
    return items
  }, [blueprints, typeFilter, subtypeFilter, resourceFilter, search])

  if (loading) return <LoadingState fullScreen message="Loading crafting blueprints..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        title="Crafting Blueprints"
        subtitle={`${filtered.length} of ${blueprints.length} blueprints`}
        icon={FlaskConical}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={v => setFilter('q', v)}
          placeholder="Search blueprints..."
          className="flex-1 min-w-[200px]"
        />

        <select
          value={typeFilter}
          onChange={e => { setFilter('type', e.target.value); setFilter('subtype', '') }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Types</option>
          {types.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>

        <select
          value={subtypeFilter}
          onChange={e => setFilter('subtype', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Subtypes</option>
          {subtypes.map(t => (
            <option key={t} value={t}>{SUBTYPE_LABELS[t] || t}</option>
          ))}
        </select>

        <select
          value={resourceFilter}
          onChange={e => setFilter('resource', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Resources</option>
          {resources.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Blueprint list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No blueprints match your filters.</p>
          </div>
        ) : (
          filtered.map(bp => (
            <BlueprintCard
              key={bp.id}
              bp={bp}
              expanded={expandedId === bp.id}
              onToggle={() => setExpandedId(expandedId === bp.id ? null : bp.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
