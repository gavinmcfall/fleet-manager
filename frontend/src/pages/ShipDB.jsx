import React, { useState, useMemo } from 'react'
import { useShips } from '../hooks/useAPI'
import { Database, ArrowUpDown } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import FilterSelect from '../components/FilterSelect'
import SearchInput from '../components/SearchInput'

export default function ShipDB() {
  const { data: ships, loading, error } = useShips()
  const [filter, setFilter] = useState('')
  const [mfrFilter, setMfrFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const manufacturers = useMemo(() => {
    if (!ships) return []
    const m = new Set(ships.map((s) => s.manufacturer_name).filter(Boolean))
    return ['all', ...Array.from(m).sort()]
  }, [ships])

  const sizes = useMemo(() => {
    if (!ships) return []
    const s = new Set(ships.map((s) => s.size_label).filter(Boolean))
    return ['all', ...Array.from(s).sort()]
  }, [ships])

  const classifications = useMemo(() => {
    if (!ships) return []
    const c = new Set(ships.map((s) => s.classification).filter(Boolean))
    return ['all', ...Array.from(c).sort()]
  }, [ships])

  const statuses = useMemo(() => {
    if (!ships) return []
    const s = new Set(ships.map((s) => s.production_status).filter(Boolean))
    return ['all', ...Array.from(s).sort()]
  }, [ships])

  const filtered = useMemo(() => {
    if (!ships) return []
    let items = [...ships]

    // Text search
    if (filter) {
      const f = filter.toLowerCase()
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(f) ||
          s.manufacturer_name?.toLowerCase().includes(f) ||
          s.focus?.toLowerCase().includes(f)
      )
    }

    // Filters
    if (mfrFilter !== 'all') {
      items = items.filter((s) => s.manufacturer_name === mfrFilter)
    }

    if (sizeFilter !== 'all') {
      items = items.filter((s) => s.size_label === sizeFilter)
    }

    if (classFilter !== 'all') {
      items = items.filter((s) => s.classification === classFilter)
    }

    if (statusFilter !== 'all') {
      items = items.filter((s) => s.production_status === statusFilter)
    }

    // Sorting
    items.sort((a, b) => {
      let va, vb
      switch (sortBy) {
        case 'name': va = a.name; vb = b.name; break
        case 'price': va = a.pledge_price || 0; vb = b.pledge_price || 0; break
        case 'cargo': va = a.cargo || 0; vb = b.cargo || 0; break
        default: va = a.name; vb = b.name
      }

      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return items
  }, [ships, filter, mfrFilter, sizeFilter, classFilter, statusFilter, sortBy, sortDir])

  if (loading) return <LoadingState message="Loading ship database..." />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-4">
      <PageHeader
        title="SHIP DATABASE"
        subtitle={`${ships?.length || 0} ships synced from SC Wiki`}
        actions={<Database className="w-5 h-5 text-gray-600" />}
      />

      {/* Search */}
      <SearchInput
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search ships..."
        className="max-w-md"
      />

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <FilterSelect
          value={mfrFilter}
          onChange={(e) => setMfrFilter(e.target.value)}
          options={manufacturers}
          allLabel="All Manufacturers"
        />
        <FilterSelect
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          options={classifications}
          allLabel="All Classes"
        />
        <FilterSelect
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          options={sizes}
          allLabel="All Sizes"
        />
        <FilterSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={statuses}
          allLabel="All Statuses"
        />
        <FilterSelect
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          options={[
            { value: 'name', label: 'Sort: Name' },
            { value: 'price', label: 'Sort: Price' },
            { value: 'cargo', label: 'Sort: Cargo' },
          ]}
        />
      </div>

      {/* Sort Direction & Results */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="btn-secondary flex items-center gap-2 text-xs"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortDir === 'asc' ? 'Ascending' : 'Descending'}
        </button>
        <span className="text-xs font-mono text-gray-500">{filtered.length} results</span>
      </div>

      {/* Ship Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 60).map((ship) => (
          <div key={ship.slug} className="panel hover:border-sc-accent/20 transition-colors overflow-hidden">
            {ship.image_url && (
              <div className="w-full h-40 bg-sc-darker/50 overflow-hidden">
                <img
                  src={ship.image_url_medium || ship.image_url}
                  alt={ship.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => e.target.parentElement.style.display = 'none'}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-display font-semibold text-white text-sm">{ship.name}</h3>
                  <span className="text-xs text-gray-500">{ship.manufacturer_name}</span>
                </div>
                <span className="badge badge-size text-[10px]">{ship.size_label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono text-gray-400 mt-3">
                <div>
                  <span className="text-gray-600 block">Role</span>
                  {ship.focus || '-'}
                </div>
                <div>
                  <span className="text-gray-600 block">Cargo</span>
                  {ship.cargo > 0 ? `${ship.cargo} SCU` : '-'}
                </div>
                <div>
                  <span className="text-gray-600 block">Crew</span>
                  {ship.min_crew}-{ship.max_crew}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-sc-border/30">
                <span className="text-xs font-mono text-gray-500">
                  {ship.production_status === 'flight_ready' ? '✅ Flight Ready' : '🔧 ' + (ship.production_status || 'Unknown')}
                </span>
                {ship.pledge_price > 0 && (
                  <span className="text-xs font-mono text-sc-warn">${ship.pledge_price}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 60 && (
        <p className="text-center text-xs font-mono text-gray-600 py-4">
          Showing 60 of {filtered.length} — refine your search to see more
        </p>
      )}
    </div>
  )
}
