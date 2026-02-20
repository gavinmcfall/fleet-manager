import React, { useState, useMemo } from 'react'
import { useFleet } from '../hooks/useAPI'
import { ArrowUpDown } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import FilterSelect from '../components/FilterSelect'
import SearchInput from '../components/SearchInput'
import InsuranceBadge from '../components/InsuranceBadge'

export default function FleetTable() {
  const { data: fleet, loading, error } = useFleet()
  const [sortKey, setSortKey] = useState('vehicle_name')
  const [sortDir, setSortDir] = useState('asc')
  const [filter, setFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('all')

  const sizes = useMemo(() => {
    if (!fleet) return []
    const s = new Set(fleet.map((v) => v.size_label || 'Unknown'))
    return ['all', ...Array.from(s).sort()]
  }, [fleet])

  const sorted = useMemo(() => {
    if (!fleet) return []
    let items = [...fleet]

    // Text filter
    if (filter) {
      const f = filter.toLowerCase()
      items = items.filter(
        (v) =>
          v.vehicle_name?.toLowerCase().includes(f) ||
          v.custom_name?.toLowerCase().includes(f) ||
          v.manufacturer_name?.toLowerCase().includes(f) ||
          v.focus?.toLowerCase().includes(f)
      )
    }

    // Size filter
    if (sizeFilter !== 'all') {
      items = items.filter((v) => (v.size_label || 'Unknown') === sizeFilter)
    }

    // Sort
    items.sort((a, b) => {
      let va, vb
      switch (sortKey) {
        case 'vehicle_name': va = a.vehicle_name; vb = b.vehicle_name; break
        case 'manufacturer': va = a.manufacturer_name; vb = b.manufacturer_name; break
        case 'size': va = a.size_label || ''; vb = b.size_label || ''; break
        case 'cargo': va = a.cargo || 0; vb = b.cargo || 0; break
        case 'pledge': va = a.pledge_price || 0; vb = b.pledge_price || 0; break
        case 'crew': va = a.crew_min || 0; vb = b.crew_min || 0; break
        case 'focus': va = a.focus || ''; vb = b.focus || ''; break
        default: va = a.vehicle_name; vb = b.vehicle_name
      }
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return items
  }, [fleet, filter, sizeFilter, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (loading) return <LoadingState message="Loading fleet..." />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-4">
      <PageHeader
        title="MY FLEET"
        actions={<span className="text-xs font-mono text-gray-500">{sorted.length} vehicles</span>}
      />

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <SearchInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search ships..."
          className="flex-1 max-w-sm"
        />
        <FilterSelect
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          options={sizes}
          allLabel="All Sizes"
        />
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-sc-darker/50">
                {[
                  { key: 'vehicle_name', label: 'Ship' },
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
                    <div className="flex items-center gap-3">
                      {v.image_url && (
                        <img
                          src={v.image_url}
                          alt={v.vehicle_name}
                          loading="lazy"
                          className="w-16 h-16 object-cover rounded border border-sc-border/50"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      )}
                      <div>
                        <span className="font-medium text-white">{v.vehicle_name}</span>
                        {v.custom_name && (
                          <span className="block text-xs text-gray-500 italic">"{v.custom_name}"</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-gray-400">{v.manufacturer_name}</td>
                  <td className="table-cell">
                    <span className="badge badge-size">{v.size_label || '?'}</span>
                  </td>
                  <td className="table-cell text-gray-400">{v.focus || '-'}</td>
                  <td className="table-cell font-mono text-gray-400">
                    {v.cargo ? v.cargo.toLocaleString() : '-'}
                  </td>
                  <td className="table-cell font-mono text-gray-400">
                    {v.crew_min || 0}-{v.crew_max || 0}
                  </td>
                  <td className="table-cell font-mono text-gray-400">
                    {v.pledge_price ? `$${v.pledge_price}` : '-'}
                  </td>
                  <td className="table-cell">
                    <InsuranceBadge isLifetime={v.is_lifetime} label={v.insurance_label} />
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
