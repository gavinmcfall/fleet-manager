import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { useCrafting } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import StatsRow from './StatsRow'
import FilterBar from './FilterBar'
import BlueprintCard from './BlueprintCard'

const PAGE_SIZE = 60

export default function Crafting() {
  const { data, loading, error, refetch } = useCrafting()
  const [searchParams, setSearchParams] = useSearchParams()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const search = searchParams.get('q') || ''
  const typeFilter = searchParams.get('type') || ''
  const subtypeFilter = searchParams.get('subtype') || ''
  const resourceFilter = searchParams.get('resource') || ''

  const setFilter = (key, value) => {
    setVisibleCount(PAGE_SIZE)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  const setFilters = (updates) => {
    setVisibleCount(PAGE_SIZE)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  }

  const blueprints = data?.blueprints || []
  const resources = data?.resources || []

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
        const haystack = `${b.base_stats?.item_name || ''} ${b.name} ${b.type} ${b.sub_type}`.toLowerCase()
        return tokens.every(t => haystack.includes(t))
      })
    }
    // Sort: type order (armour, weapons, ammo) then by name
    const typeOrder = { armour: 0, weapons: 1, ammo: 2 }
    items.sort((a, b) => {
      const ta = typeOrder[a.type] ?? 99
      const tb = typeOrder[b.type] ?? 99
      if (ta !== tb) return ta - tb
      return (a.name || '').localeCompare(b.name || '')
    })
    return items
  }, [blueprints, typeFilter, subtypeFilter, resourceFilter, search])

  if (loading) return <LoadingState fullScreen message="Loading crafting blueprints..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="relative mb-8">
        {/* HUD corner brackets */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t border-l border-sc-accent/20" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t border-r border-sc-accent/20" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b border-l border-sc-accent/20" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b border-r border-sc-accent/20" />

        <div className="py-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-sc-accent/60 mb-2 font-mono">
            Star Citizen · 4.7 Crafting System
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white tracking-wide mb-2"
            style={{ textShadow: '0 0 30px rgba(34, 211, 238, 0.2)' }}
          >
            Crafting Blueprints
          </h1>
          <p className="text-sm text-gray-500">
            <span
              className="text-sc-accent font-mono font-bold"
              style={{ textShadow: '0 0 8px rgba(34, 211, 238, 0.4)' }}
            >
              {filtered.length}
            </span>
            {filtered.length !== blueprints.length && (
              <span className="text-gray-600"> of {blueprints.length}</span>
            )}
            {' '}blueprints
          </p>
        </div>
      </div>

      <StatsRow blueprints={blueprints} resources={resources} />

      <FilterBar
        search={search}
        onSearchChange={v => setFilter('q', v)}
        typeFilter={typeFilter}
        subtypeFilter={subtypeFilter}
        resourceFilter={resourceFilter}
        onFilterChange={setFilters}
        blueprints={blueprints}
        resources={resources}
      />

      {/* Blueprint grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">No blueprints match your filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.slice(0, visibleCount).map((bp, i) => (
              <BlueprintCard key={bp.id} bp={bp} index={i} />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="text-center pt-6">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="px-6 py-2 text-xs font-display tracking-wider uppercase border border-sc-border rounded hover:border-sc-accent/40 hover:text-sc-accent transition-colors"
              >
                Show more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
