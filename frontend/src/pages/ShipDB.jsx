import React, { useState, useMemo } from 'react'
import { useShips } from '../hooks/useAPI'
import { Search, Database } from 'lucide-react'

export default function ShipDB() {
  const { data: ships, loading, error } = useShips()
  const [filter, setFilter] = useState('')
  const [mfrFilter, setMfrFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')

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

  const filtered = useMemo(() => {
    if (!ships) return []
    let items = [...ships]

    if (filter) {
      const f = filter.toLowerCase()
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(f) ||
          s.manufacturer_name?.toLowerCase().includes(f) ||
          s.focus?.toLowerCase().includes(f)
      )
    }

    if (mfrFilter !== 'all') {
      items = items.filter((s) => s.manufacturer_name === mfrFilter)
    }

    if (sizeFilter !== 'all') {
      items = items.filter((s) => s.size_label === sizeFilter)
    }

    return items
  }, [ships, filter, mfrFilter, sizeFilter])

  if (loading) return <div className="text-gray-500 font-mono text-sm p-8">Loading ship database...</div>
  if (error) return <div className="text-sc-danger font-mono text-sm p-8">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl tracking-wider text-white">SHIP DATABASE</h2>
          <p className="text-xs font-mono text-gray-500 mt-1">
            {ships?.length || 0} ships synced from FleetYards
          </p>
        </div>
        <Database className="w-5 h-5 text-gray-600" />
      </div>

      <div className="glow-line" />

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="Search all ships..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-sc-panel border border-sc-border rounded pl-10 pr-4 py-2 text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sc-accent/50"
          />
        </div>
        <select
          value={mfrFilter}
          onChange={(e) => setMfrFilter(e.target.value)}
          className="bg-sc-panel border border-sc-border rounded px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none"
        >
          {manufacturers.map((m) => (
            <option key={m} value={m}>{m === 'all' ? 'All Manufacturers' : m}</option>
          ))}
        </select>
        <select
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          className="bg-sc-panel border border-sc-border rounded px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Sizes' : s}</option>
          ))}
        </select>
        <span className="text-xs font-mono text-gray-500">{filtered.length} results</span>
      </div>

      {/* Ship Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 60).map((ship) => (
          <div key={ship.slug} className="panel hover:border-sc-accent/20 transition-colors">
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
                  {ship.production_status === 'flight-ready' ? '✅ Flight Ready' : '🔧 ' + ship.production_status}
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
