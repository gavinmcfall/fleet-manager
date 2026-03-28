import { useMemo } from 'react'
import { useParams, useSearchParams, Navigate, NavLink } from 'react-router-dom'
import { useComponents } from '../../hooks/useAPI'
import { COMPONENT_TYPES, getTypeConfig, COLUMNS, DEFAULT_SORT, FILTER_DIMENSIONS } from './componentsConfig'
import useColumnOrder from './useColumnOrder'
import useCompareSelection from './useCompareSelection'
import PageHeader from '../../components/PageHeader'
import LoadingState from '../../components/LoadingState'
import FilterBar, { applyFilters } from './FilterBar'
import ComponentTable from './ComponentTable'
import CompareDrawer from './CompareDrawer'

export default function Components() {
  const { type: slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const config = getTypeConfig(slug)

  if (!config) return <Navigate to="/components/weapons" replace />

  const { data, loading, error } = useComponents(config.apiType)
  const allComponents = data?.components || []

  const { order: columnOrder, updateOrder, resetOrder } = useColumnOrder(config.apiType)
  const compare = useCompareSelection(config.apiType)

  const search = searchParams.get('q') || ''
  const setSearch = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set('q', val); else next.delete('q')
      next.delete('page')
      return next
    }, { replace: true })
  }

  const dimensions = FILTER_DIMENSIONS[config.apiType] || []
  const columns = COLUMNS[config.apiType] || COLUMNS.weapon

  const filtered = useMemo(() => {
    let result = allComponents
    if (search) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(c => {
        const name = (c.name || '').toLowerCase()
        const mfr = (c.manufacturer_name || '').toLowerCase()
        const sub = (c.sub_type || '').toLowerCase()
        return tokens.every(t => name.includes(t) || mfr.includes(t) || sub.includes(t))
      })
    }
    result = applyFilters(result, dimensions, searchParams)
    return result
  }, [allComponents, search, dimensions, searchParams])

  return (
    <div className={`space-y-5 ${compare.count > 0 ? 'pb-20' : ''}`}>
      <PageHeader
        title={config.label}
        subtitle={loading ? 'Loading...' : `${filtered.length} of ${allComponents.length} components`}
      />

      {/* Type tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(COMPONENT_TYPES).map(([key, cfg]) => {
          const isActive = key === slug
          return (
            <NavLink
              key={key}
              to={`/components/${key}`}
              className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 border ${
                isActive
                  ? 'bg-sc-accent/10 text-sc-accent border-sc-accent/25'
                  : 'text-gray-400 border-sc-border/50 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {cfg.label}
            </NavLink>
          )
        })}
      </div>

      {/* Filters — constrained to viewport, pills wrap */}
      <div className="overflow-hidden">
        <FilterBar
          dimensions={dimensions}
          items={allComponents}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      {/* Loading / Error / Table */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-sc-danger">Failed to load components</p>
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
