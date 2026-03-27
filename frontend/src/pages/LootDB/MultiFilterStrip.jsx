import FilterDimensionRow from './FilterDimensionRow'

export default function MultiFilterStrip({ dimensions, items, includes, excludes, onToggle }) {
  if (!dimensions || dimensions.length === 0) return null

  return (
    <div className="space-y-1.5">
      {/* Helper text */}
      <p className="text-xs text-gray-500">
        Click = solo filter · Shift+click = combine · Ctrl+click = exclude
      </p>
      {dimensions.map(dim => (
        <FilterDimensionRow
          key={dim.key}
          dimension={dim}
          items={items}
          includes={includes}
          excludes={excludes}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
