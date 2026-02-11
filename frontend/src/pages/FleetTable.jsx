import React, { useState, useMemo } from 'react'
import { useVehicles } from '../hooks/useAPI'
import { ArrowUpDown, Search, Star } from 'lucide-react'

export default function FleetTable() {
  const { data: vehicles, loading, error } = useVehicles()
  const [sortKey, setSortKey] = useState('ship_name')
  const [sortDir, setSortDir] = useState('asc')
  const [filter, setFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('all')

  const sizes = useMemo(() => {
    if (!vehicles) return []
    const s = new Set(vehicles.map((v) => v.ship?.size_label || 'Unknown'))
    return ['all', ...Array.from(s).sort()]
  }, [vehicles])

  const sorted = useMemo(() => {
    if (!vehicles) return []
    let items = [...vehicles]

    // Text filter
    if (filter) {
      const f = filter.toLowerCase()
      items = items.filter(
        (v) =>
          v.ship_name.toLowerCase().includes(f) ||
          v.custom_name?.toLowerCase().includes(f) ||
          v.manufacturer_name?.toLowerCase().includes(f) ||
          v.ship?.focus?.toLowerCase().includes(f)
      )
    }

    // Size filter
    if (sizeFilter !== 'all') {
      items = items.filter((v) => (v.ship?.size_label || 'Unknown') === sizeFilter)
    }

    // Sort
    items.sort((a, b) => {
      let va, vb
      switch (sortKey) {
        case 'ship_name': va = a.ship_name; vb = b.ship_name; break
        case 'manufacturer': va = a.manufacturer_name; vb = b.manufacturer_name; break
        case 'size': va = a.ship?.size_label || ''; vb = b.ship?.size_label || ''; break
        case 'cargo': va = a.ship?.cargo || 0; vb = b.ship?.cargo || 0; break
        case 'pledge': va = a.ship?.pledge_price || 0; vb = b.ship?.pledge_price || 0; break
        case 'crew': va = a.ship?.min_crew || 0; vb = b.ship?.min_crew || 0; break
        case 'focus': va = a.ship?.focus || ''; vb = b.ship?.focus || ''; break
        default: va = a.ship_name; vb = b.ship_name
      }
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return items
  }, [vehicles, filter, sizeFilter, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (loading) return <div className="text-gray-500 font-mono text-sm p-8">Loading fleet...</div>
  if (error) return <div className="text-sc-danger font-mono text-sm p-8">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">MY FLEET</h2>
        <span className="text-xs font-mono text-gray-500">{sorted.length} vehicles</span>
      </div>

      <div className="glow-line" />

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="Search ships..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-sc-panel border border-sc-border rounded pl-10 pr-4 py-2 text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sc-accent/50"
          />
        </div>
        <select
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          className="bg-sc-panel border border-sc-border rounded px-3 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-sc-accent/50"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Sizes' : s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-sc-darker/50">
                {[
                  { key: 'ship_name', label: 'Ship' },
                  { key: 'manufacturer', label: 'Manufacturer' },
                  { key: 'size', label: 'Size' },
                  { key: 'focus', label: 'Role' },
                  { key: 'cargo', label: 'Cargo' },
                  { key: 'crew', label: 'Crew' },
                  { key: 'pledge', label: 'Pledge $' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="table-header cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort(key)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <ArrowUpDown className={`w-3 h-3 ${sortKey === key ? 'text-sc-accent' : 'text-gray-700'}`} />
                    </span>
                  </th>
                ))}
                <th className="table-header">Insurance</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {v.flagship && <Star className="w-3 h-3 text-sc-warn fill-sc-warn" />}
                      <div>
                        <span className="font-medium text-white">{v.ship_name}</span>
                        {v.custom_name && (
                          <span className="block text-xs text-gray-500 italic">"{v.custom_name}"</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-gray-400">{v.manufacturer_name}</td>
                  <td className="table-cell">
                    <span className="badge badge-size">{v.ship?.size_label || '?'}</span>
                  </td>
                  <td className="table-cell text-gray-400">{v.ship?.focus || '-'}</td>
                  <td className="table-cell font-mono text-gray-400">
                    {v.ship?.cargo ? v.ship.cargo.toLocaleString() : '-'}
                  </td>
                  <td className="table-cell font-mono text-gray-400">
                    {v.ship?.min_crew || 0}-{v.ship?.max_crew || 0}
                  </td>
                  <td className="table-cell font-mono text-gray-400">
                    {v.ship?.pledge_price ? `$${v.ship.pledge_price}` : '-'}
                  </td>
                  <td className="table-cell">
                    {v.hangar_import ? (
                      v.hangar_import.lti ? (
                        <span className="badge badge-lti">LTI</span>
                      ) : (
                        <span className="badge badge-nonlti">Standard</span>
                      )
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
