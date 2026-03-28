import { useMemo } from 'react'
import FilterDimensionRow from './FilterDimensionRow'

function getItemValues(item, field, multiValue) {
  const raw = item[field]
  if (raw == null) return []
  if (multiValue && typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean)
  return [String(raw)]
}

function applyDimensionFilter(items, dim, inc, exc) {
  if (!inc?.size && !exc?.size) return items
  return items.filter(item => {
    const vals = getItemValues(item, dim.field, dim.multiValue)
    if (exc?.size && vals.some(v => exc.has(v))) return false
    if (inc?.size && !vals.some(v => inc.has(v))) return false
    return true
  })
}

export default function MultiFilterStrip({ dimensions, items, includes, excludes, onToggle }) {
  if (!dimensions || dimensions.length === 0) return null

  // Cross-filtered items per dimension: apply ALL other dimensions' filters, but NOT this one.
  // This lets each row show counts that reflect what the other filters have narrowed to.
  const crossFilteredByDim = useMemo(() => {
    const map = {}
    for (const dim of dimensions) {
      let filtered = items
      for (const otherDim of dimensions) {
        if (otherDim.key === dim.key) continue
        filtered = applyDimensionFilter(filtered, otherDim, includes[otherDim.key], excludes[otherDim.key])
      }
      map[dim.key] = filtered
    }
    return map
  }, [dimensions, items, includes, excludes])

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500">
        Click = solo filter · Shift+click = combine · Ctrl+click = exclude
      </p>
      {dimensions.map(dim => (
        <FilterDimensionRow
          key={dim.key}
          dimension={dim}
          items={crossFilteredByDim[dim.key] || items}
          totalItems={items}
          includes={includes}
          excludes={excludes}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
