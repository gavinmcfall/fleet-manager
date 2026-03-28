import { useMemo } from 'react'

function getItemValues(item, field, multiValue) {
  const raw = item[field]
  if (raw == null) return []
  if (multiValue && typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean)
  return [String(raw)]
}

export default function FilterDimensionRow({ dimension, items, totalItems, includes, excludes, onToggle }) {
  const { key, field, label, values: labelMap, multiValue, numeric } = dimension

  // Filtered counts (items after OTHER dimensions' filters)
  const filteredCounts = useMemo(() => {
    const counts = {}
    if (!items) return counts
    for (const item of items) {
      const vals = getItemValues(item, field, multiValue)
      for (const v of vals) {
        if (labelMap && !labelMap[v]) continue
        counts[v] = (counts[v] || 0) + 1
      }
    }
    return counts
  }, [items, field, multiValue, labelMap])

  // Total counts (all items in category, ignoring all dimension filters)
  const totalCounts = useMemo(() => {
    const counts = {}
    if (!totalItems) return counts
    for (const item of totalItems) {
      const vals = getItemValues(item, field, multiValue)
      for (const v of vals) {
        if (labelMap && !labelMap[v]) continue
        counts[v] = (counts[v] || 0) + 1
      }
    }
    return counts
  }, [totalItems, field, multiValue, labelMap])

  // Derive ordered pill values — show pills if they have ANY total count
  const orderedValues = useMemo(() => {
    if (numeric) {
      return Object.keys(totalCounts)
        .sort((a, b) => Number(a) - Number(b))
        .map(v => ({ value: v, label: `S${v}`, filtered: filteredCounts[v] || 0, total: totalCounts[v] }))
    }
    if (labelMap) {
      return Object.entries(labelMap)
        .filter(([v]) => totalCounts[v] > 0)
        .map(([v, lbl]) => ({ value: v, label: lbl, filtered: filteredCounts[v] || 0, total: totalCounts[v] }))
    }
    return Object.entries(totalCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, total]) => ({ value: v, label: v, filtered: filteredCounts[v] || 0, total }))
  }, [filteredCounts, totalCounts, labelMap, numeric])

  if (orderedValues.length < 2) return null

  const incSet = includes?.[key] || new Set()
  const excSet = excludes?.[key] || new Set()
  const hasAnyFilter = incSet.size > 0 || excSet.size > 0 ||
    Object.keys(includes || {}).some(k => k !== key && includes[k]?.size > 0) ||
    Object.keys(excludes || {}).some(k => k !== key && excludes[k]?.size > 0)

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-display uppercase tracking-wider text-gray-600 w-14 shrink-0">{label}</span>
      {orderedValues.map(({ value, label: pillLabel, filtered, total }) => {
        const isIncluded = incSet.has(value)
        const isExcluded = excSet.has(value)
        const isDimmed = filtered === 0 && !isIncluded && !isExcluded

        let pillStyle
        if (isExcluded) {
          pillStyle = 'bg-red-500/10 text-red-400 border-red-500/25 line-through'
        } else if (isIncluded) {
          pillStyle = 'bg-sc-accent/10 text-sc-accent border-sc-accent/25'
        } else if (isDimmed) {
          pillStyle = 'bg-white/[0.01] text-gray-700 border-white/[0.03] cursor-default'
        } else {
          pillStyle = 'bg-white/[0.02] text-gray-500 border-white/[0.05] hover:border-white/[0.1] hover:text-gray-400'
        }

        const showBoth = hasAnyFilter && filtered !== total

        return (
          <button
            key={value}
            onClick={(e) => { if (!isDimmed) onToggle(key, value, e) }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 border whitespace-nowrap ${pillStyle}`}
          >
            {pillLabel}{' '}
            <span className="font-mono opacity-60">
              {showBoth ? `${filtered}/${total}` : total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
