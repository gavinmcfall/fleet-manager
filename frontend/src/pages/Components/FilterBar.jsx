import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchInput from '../../components/SearchInput'

function getItemValues(item, field) {
  const raw = item[field]
  if (raw == null) return []
  return [String(raw)]
}

function DimensionRow({ dimension, items, includes, excludes, onToggle }) {
  const { key, field, label, numeric } = dimension

  const valueCounts = useMemo(() => {
    const counts = {}
    if (!items) return counts
    for (const item of items) {
      for (const v of getItemValues(item, field)) {
        counts[v] = (counts[v] || 0) + 1
      }
    }
    return counts
  }, [items, field])

  const orderedValues = useMemo(() => {
    if (numeric) {
      return Object.keys(valueCounts)
        .sort((a, b) => Number(a) - Number(b))
        .map(v => ({ value: v, label: `S${v}`, count: valueCounts[v] }))
    }
    return Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, count]) => ({ value: v, label: v, count }))
  }, [valueCounts, numeric])

  if (orderedValues.length < 2) return null

  const incSet = includes?.[key] || new Set()
  const excSet = excludes?.[key] || new Set()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-display uppercase tracking-wider text-sc-accent2 w-20 shrink-0">{label}</span>
      {orderedValues.map(({ value, label: pillLabel, count }) => {
        const isIncluded = incSet.has(value)
        const isExcluded = excSet.has(value)
        let pillStyle
        if (isExcluded) {
          pillStyle = 'bg-red-500/15 text-red-400 border-red-500/30 line-through'
        } else if (isIncluded) {
          pillStyle = 'bg-sc-accent/15 text-sc-accent border-sc-accent/30'
        } else {
          pillStyle = 'bg-sc-panel text-gray-400 border-sc-border/60 hover:border-sc-accent2/40 hover:text-gray-200'
        }
        return (
          <button
            key={value}
            onClick={(e) => onToggle(key, value, e)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all duration-150 border whitespace-nowrap cursor-pointer ${pillStyle}`}
          >
            {pillLabel} <span className="font-mono opacity-60">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function FilterBar({ dimensions, items, search, onSearchChange }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const includes = useMemo(() => {
    const map = {}
    for (const dim of dimensions) {
      const raw = searchParams.get(`f_${dim.key}`)
      if (raw) map[dim.key] = new Set(raw.split(','))
    }
    return map
  }, [searchParams, dimensions])

  const excludes = useMemo(() => {
    const map = {}
    for (const dim of dimensions) {
      const raw = searchParams.get(`fx_${dim.key}`)
      if (raw) map[dim.key] = new Set(raw.split(','))
    }
    return map
  }, [searchParams, dimensions])

  const hasAny = useMemo(() => {
    return Object.values(includes).some(s => s.size > 0) ||
           Object.values(excludes).some(s => s.size > 0)
  }, [includes, excludes])

  const toggle = useCallback((dimKey, value, event) => {
    const isShift = event?.shiftKey
    const isCtrl = event?.ctrlKey || event?.metaKey

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const incKey = `f_${dimKey}`
      const excKey = `fx_${dimKey}`

      if (isCtrl) {
        const excSet = new Set((next.get(excKey) || '').split(',').filter(Boolean))
        if (excSet.has(value)) { excSet.delete(value) } else {
          excSet.add(value)
          const incSet = new Set((next.get(incKey) || '').split(',').filter(Boolean))
          incSet.delete(value)
          if (incSet.size) next.set(incKey, [...incSet].join(',')); else next.delete(incKey)
        }
        if (excSet.size) next.set(excKey, [...excSet].join(',')); else next.delete(excKey)
      } else if (isShift) {
        const incSet = new Set((next.get(incKey) || '').split(',').filter(Boolean))
        if (incSet.has(value)) { incSet.delete(value) } else {
          incSet.add(value)
          const excSet = new Set((next.get(excKey) || '').split(',').filter(Boolean))
          excSet.delete(value)
          if (excSet.size) next.set(excKey, [...excSet].join(',')); else next.delete(excKey)
        }
        if (incSet.size) next.set(incKey, [...incSet].join(',')); else next.delete(incKey)
      } else {
        const current = next.get(incKey)
        if (current === value) { next.delete(incKey) } else { next.set(incKey, value) }
        next.delete(excKey)
      }
      next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const clearAll = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const dim of dimensions) {
        next.delete(`f_${dim.key}`)
        next.delete(`fx_${dim.key}`)
      }
      next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams, dimensions])

  return (
    <div className="space-y-3">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search components..."
        className="max-w-md"
      />

      {dimensions.map(dim => (
        <DimensionRow
          key={dim.key}
          dimension={dim}
          items={items}
          includes={includes}
          excludes={excludes}
          onToggle={toggle}
        />
      ))}

      {hasAny && (
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  )
}

export function applyFilters(components, dimensions, searchParams) {
  let result = components
  for (const dim of dimensions) {
    const incRaw = searchParams.get(`f_${dim.key}`)
    const excRaw = searchParams.get(`fx_${dim.key}`)
    if (incRaw) {
      const incSet = new Set(incRaw.split(','))
      result = result.filter(c => {
        const vals = getItemValues(c, dim.field)
        return vals.some(v => incSet.has(v))
      })
    }
    if (excRaw) {
      const excSet = new Set(excRaw.split(','))
      result = result.filter(c => {
        const vals = getItemValues(c, dim.field)
        return !vals.some(v => excSet.has(v))
      })
    }
  }
  return result
}
