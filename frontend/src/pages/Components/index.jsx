import { useMemo } from 'react'
import { useParams, useSearchParams, Navigate, NavLink } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useComponents } from '../../hooks/useAPI'
import { COMPONENT_TYPES, getTypeConfig, COLUMNS, DEFAULT_SORT, FILTER_DIMENSIONS } from './componentsConfig'
import useColumnOrder from './useColumnOrder'
import useCompareSelection from './useCompareSelection'
import FilterBar, { applyFilters } from './FilterBar'
import ComponentTable from './ComponentTable'
import CompareDrawer from './CompareDrawer'

export default function Components() {
  const { type: slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const config = getTypeConfig(slug)

  // Redirect invalid slugs
  if (!config) return <Navigate to="/components/weapons" replace />

  const { data, loading, error } = useComponents(config.apiType)
  const allComponents = data?.components || []

  // Hooks for persistence
  const { order: columnOrder, updateOrder, resetOrder } = useColumnOrder(config.apiType)
  const compare = useCompareSelection(config.apiType)

  // Search filter (local state via URL)
  const search = searchParams.get('q') || ''
  const setSearch = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set('q', val); else next.delete('q')
      next.delete('page')
      return next
    }, { replace: true })
  }

  // Get dimensions + columns for this type
  const dimensions = FILTER_DIMENSIONS[config.apiType] || []
  const columns = COLUMNS[config.apiType] || COLUMNS.weapon

  // Apply search + dimension filters
  const filtered = useMemo(() => {
    let result = allComponents

    // Text search
    if (search) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(c => {
        const name = (c.name || '').toLowerCase()
        const mfr = (c.manufacturer_name || '').toLowerCase()
        const sub = (c.sub_type || '').toLowerCase()
        return tokens.every(t => name.includes(t) || mfr.includes(t) || sub.includes(t))
      })
    }

    // Dimension filters
    result = applyFilters(result, dimensions, searchParams)

    return result
  }, [allComponents, search, dimensions, searchParams])

  // Default sort if none set
  const effectiveSortKey = searchParams.get('sort') || DEFAULT_SORT[config.apiType] || 'name'
  if (!searchParams.get('sort') && DEFAULT_SORT[config.apiType]) {
    // Don't mutate — the ComponentTable reads sort from URL, so this is just a hint
  }

  return (
    <div className={`space-y-5 ${compare.count > 0 ? 'pb-20' : ''}`}>
      {/* HUD Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {config.icon && <config.icon className="w-6 h-6 text-sc-accent" style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.3))' }} />}
          <div>
            <h1
              className="text-lg font-bold text-white"
              style={{ textShadow: '0 0 30px rgba(34, 211, 238, 0.2)' }}
            >
              {config.label}
            </h1>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              {loading ? '...' : `${filtered.length} of ${allComponents.length} components`}
            </p>
          </div>
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(COMPONENT_TYPES).map(([key, cfg]) => {
          const isActive = key === slug
          return (
            <NavLink
              key={key}
              to={`/components/${key}`}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 border ${
                isActive
                  ? 'bg-sc-accent/10 text-sc-accent border-sc-accent/25'
                  : 'bg-white/[0.02] text-gray-500 border-white/[0.05] hover:border-white/[0.1] hover:text-gray-400'
              }`}
            >
              {cfg.label}
            </NavLink>
          )
        })}
      </div>

      {/* Filters */}
      <FilterBar
        dimensions={dimensions}
        items={allComponents}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Loading / Error / Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-sc-accent animate-spin" />
          <span className="ml-3 text-xs font-mono text-gray-500">Loading components...</span>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-xs font-mono text-red-400">Failed to load components</p>
        </div>
      ) : (
        <ComponentTable
          components={filtered}
          columns={columns}
          columnOrder={columnOrder}
          onReorderColumns={updateOrder}
          onResetColumns={resetOrder}
          isSelected={compare.isSelected}
          onToggleCompare={compare.toggle}
          compareCount={compare.count}
          maxCompare={compare.MAX_COMPARE}
        />
      )}

      {/* Compare drawer */}
      <CompareDrawer
        selected={compare.selected}
        allComponents={allComponents}
        onRemove={compare.toggle}
        onClear={compare.clear}
        apiType={config.apiType}
        maxCompare={compare.MAX_COMPARE}
      />
    </div>
  )
}
