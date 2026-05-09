import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Package, LayoutGrid, List, ImageOff, Tag, Building2 } from 'lucide-react'
import { useHangar } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'
import {
  buildItemFilter, cleanPledgeName, formatPledgeValue,
  kindLabel, orderedKinds,
} from './Hangar.helpers'

/** Per-kind colour palette — stays subdued so the page reads as a list, not a circus. */
const KIND_STYLES = {
  Ship: 'bg-sc-accent/10 text-sc-accent border-sc-accent/30',
  Skin: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  Insurance: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
  'FPS Equipment': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Component: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  'Hangar decoration': 'bg-pink-400/10 text-pink-200 border-pink-400/30',
  Credits: 'bg-yellow-400/10 text-yellow-200 border-yellow-400/30',
  uncategorised: 'bg-white/5 text-gray-300 border-white/15',
}

function kindStyle(kind) {
  return KIND_STYLES[kind] || 'bg-white/5 text-gray-300 border-white/15'
}

function FilterChip({ active, onClick, accent, children }) {
  const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-display uppercase tracking-[0.05em] border transition-all cursor-pointer'
  const cls = active
    ? `${base} ${accent || 'bg-sc-accent/15 text-sc-accent border-sc-accent/40'}`
    : `${base} bg-white/[0.03] text-gray-400 border-white/10 hover:text-gray-200 hover:border-white/25`
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

function HangarItemCard({ item }) {
  const kind = item.kind ?? 'uncategorised'
  const pledgeShort = cleanPledgeName(item.pledge_name)
  const pledgeValue = formatPledgeValue(item.pledge_value_cents)
  return (
    <div className="group relative bg-white/[0.03] border border-white/[0.08] rounded-lg overflow-hidden hover:border-sc-accent/30 transition-all">
      <div className="aspect-[16/9] bg-gradient-to-br from-sc-darker to-black/40 flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <ImageOff className="w-6 h-6 text-gray-700" aria-hidden="true" />
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-display text-gray-200 leading-tight line-clamp-2 flex-1">
            {item.title}
            {item.custom_name && (
              <span className="ml-1 text-[10px] font-mono text-sc-accent/80">"{item.custom_name}"</span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-display uppercase tracking-wide border ${kindStyle(kind)}`}>
            {kindLabel(kind)}
          </span>
          {item.manufacturer_code && (
            <span className="text-[10px] font-mono text-gray-500">{item.manufacturer_code}</span>
          )}
        </div>
        {(pledgeShort || pledgeValue) && (
          <div className="text-[10px] text-gray-500 font-mono leading-tight pt-1 border-t border-white/[0.05] truncate">
            {pledgeShort && <span className="truncate">↳ {pledgeShort}</span>}
            {pledgeValue && <span className="ml-1.5 text-gray-600">· {pledgeValue}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function HangarItemRow({ item }) {
  const kind = item.kind ?? 'uncategorised'
  const pledgeShort = cleanPledgeName(item.pledge_name)
  const pledgeValue = formatPledgeValue(item.pledge_value_cents)
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/[0.05] rounded hover:border-sc-accent/20 transition-all">
      <div className="w-12 h-7 flex-shrink-0 bg-sc-darker rounded overflow-hidden flex items-center justify-center">
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <ImageOff className="w-3 h-3 text-gray-700" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-200 font-display truncate">
          {item.title}
          {item.custom_name && (
            <span className="ml-1.5 text-[10px] font-mono text-sc-accent/80">"{item.custom_name}"</span>
          )}
        </div>
        {pledgeShort && (
          <div className="text-[10px] text-gray-500 font-mono truncate">↳ {pledgeShort}</div>
        )}
      </div>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-display uppercase tracking-wide border ${kindStyle(kind)}`}>
        {kindLabel(kind)}
      </span>
      {item.manufacturer_code && (
        <span className="text-[10px] font-mono text-gray-500 w-12 text-right">{item.manufacturer_code}</span>
      )}
      {pledgeValue && (
        <span className="text-[10px] font-mono text-gray-500 w-16 text-right">{pledgeValue}</span>
      )}
    </div>
  )
}

export default function Hangar() {
  const { data, loading, error, refetch } = useHangar()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') ?? ''
  const kindFilter = searchParams.get('kind') ?? 'all'
  const mfrFilter = searchParams.get('mfr') ?? 'all'
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid'

  const updateParam = (key, value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all') prev.set(key, value)
      else prev.delete(key)
      return prev
    }, { replace: true })
  }

  const items = data?.items ?? []
  const counts = data?.counts ?? {}
  const total = data?.total ?? 0

  const kinds = useMemo(() => orderedKinds(counts), [counts])

  const manufacturers = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const code = item.manufacturer_code
      if (!code) continue
      const prev = map.get(code)
      if (prev) prev.count += 1
      else map.set(code, { code, name: item.manufacturer_name, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
  }, [items])

  const filtered = useMemo(
    () => items.filter(buildItemFilter({ search, kindFilter, mfrFilter })),
    [items, search, kindFilter, mfrFilter],
  )

  if (loading) return <LoadingState fullScreen message="Loading hangar..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const isEmpty = total === 0
  const isFilteredEmpty = !isEmpty && filtered.length === 0
  const hasActiveFilters = search || kindFilter !== 'all' || mfrFilter !== 'all'

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="HANGAR"
        subtitle={isEmpty ? 'Sync your RSI hangar to see your inventory.' : `Everything in your RSI hangar — ${total.toLocaleString('en-US')} item${total === 1 ? '' : 's'}`}
        actions={!isEmpty && (
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded p-0.5">
            <button
              type="button"
              onClick={() => updateParam('view', 'grid')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${view === 'grid' ? 'bg-sc-accent/20 text-sc-accent' : 'text-gray-500 hover:text-gray-300'}`}
              aria-label="Grid view"
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateParam('view', 'list')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${view === 'list' ? 'bg-sc-accent/20 text-sc-accent' : 'text-gray-500 hover:text-gray-300'}`}
              aria-label="List view"
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      />

      {isEmpty ? (
        <EmptyState
          icon={Package}
          title="Your hangar is empty"
          message="Run a sync from the Sync & Import page to pull your RSI pledges into SC Bridge."
        />
      ) : (
        <>
          <div className="space-y-3">
            <SearchInput
              value={search}
              onChange={(val) => updateParam('q', val)}
              placeholder="Search by title, custom name, manufacturer, pledge..."
              className="w-full max-w-lg"
            />

            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px] uppercase tracking-[0.05em]">
              <Tag className="w-3 h-3 text-gray-600" aria-hidden="true" />
              <FilterChip active={kindFilter === 'all'} onClick={() => updateParam('kind', 'all')}>
                All <span className="opacity-60">· {total}</span>
              </FilterChip>
              {kinds.map((k) => (
                <FilterChip
                  key={k}
                  active={kindFilter === k}
                  accent={kindStyle(k)}
                  onClick={() => updateParam('kind', k)}
                >
                  {kindLabel(k)} <span className="opacity-60">· {counts[k]}</span>
                </FilterChip>
              ))}
            </div>

            {manufacturers.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px] uppercase tracking-[0.05em]">
                <Building2 className="w-3 h-3 text-gray-600" aria-hidden="true" />
                <FilterChip active={mfrFilter === 'all'} onClick={() => updateParam('mfr', 'all')}>
                  All Mfrs
                </FilterChip>
                {manufacturers.slice(0, 14).map((m) => (
                  <FilterChip
                    key={m.code}
                    active={mfrFilter === m.code}
                    onClick={() => updateParam('mfr', m.code)}
                  >
                    {m.code} <span className="opacity-60">· {m.count}</span>
                  </FilterChip>
                ))}
              </div>
            )}

            <div className="text-[11px] font-mono text-gray-500">
              Showing {filtered.length.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => setSearchParams({}, { replace: true })}
                  className="ml-2 text-sc-accent hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {isFilteredEmpty ? (
            <EmptyState
              icon={Package}
              title="No matches"
              message="Try adjusting the search or filters above."
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((item) => (
                <HangarItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => (
                <HangarItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
