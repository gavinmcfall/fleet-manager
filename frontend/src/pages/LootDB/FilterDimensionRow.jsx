import { useMemo } from 'react'

function getItemValues(item, field, multiValue) {
  const raw = item[field]
  if (raw == null) return []
  if (multiValue && typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean)
  return [String(raw)]
}

export default function FilterDimensionRow({ dimension, items, includes, excludes, onToggle }) {
  const { key, field, label, values: labelMap, multiValue, numeric } = dimension

  // Count items per value in this dimension
  const valueCounts = useMemo(() => {
    const counts = {}
    if (!items) return counts
    for (const item of items) {
      const vals = getItemValues(item, field, multiValue)
      for (const v of vals) {
        if (labelMap && !labelMap[v]) continue // skip unlabeled values
        counts[v] = (counts[v] || 0) + 1
      }
    }
    return counts
  }, [items, field, multiValue, labelMap])

  // Derive ordered pill values
  const orderedValues = useMemo(() => {
    if (numeric) {
      // Auto-derive from data, sort numerically
      return Object.keys(valueCounts)
        .sort((a, b) => Number(a) - Number(b))
        .map(v => ({ value: v, label: `S${v}`, count: valueCounts[v] }))
    }
    if (labelMap) {
      return Object.entries(labelMap)
        .filter(([v]) => valueCounts[v] > 0)
        .map(([v, lbl]) => ({ value: v, label: lbl, count: valueCounts[v] }))
    }
    return Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, count]) => ({ value: v, label: v, count }))
  }, [valueCounts, labelMap, numeric])

  if (orderedValues.length < 2) return null

  const incSet = includes?.[key] || new Set()
  const excSet = excludes?.[key] || new Set()

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-display uppercase tracking-wider text-gray-600 w-14 shrink-0">{label}</span>
      {orderedValues.map(({ value, label: pillLabel, count }) => {
        const isIncluded = incSet.has(value)
        const isExcluded = excSet.has(value)

        let pillStyle
        if (isExcluded) {
          pillStyle = 'bg-red-500/10 text-red-400 border-red-500/25 line-through'
        } else if (isIncluded) {
          pillStyle = 'bg-sc-accent/10 text-sc-accent border-sc-accent/25'
        } else {
          pillStyle = 'bg-white/[0.02] text-gray-500 border-white/[0.05] hover:border-white/[0.1] hover:text-gray-400'
        }

        return (
          <button
            key={value}
            onClick={(e) => onToggle(key, value, e)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 border whitespace-nowrap ${pillStyle}`}
          >
            {pillLabel} <span className="font-mono opacity-60">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
