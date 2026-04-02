import { useState } from 'react'
import { Scale, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useLootItem } from '../../hooks/useAPI'
import { effectiveCategory, CATEGORY_LABELS, rarityStyle } from '../../lib/lootDisplay'
import CompareTable from './CompareTable'

function CompareItemLoader({ uuid, onRemove }) {
  const { data: item, loading } = useLootItem(uuid)
  if (loading) return <span className="text-[10px] font-mono text-gray-500 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08] animate-pulse">Loading...</span>
  if (!item) return null
  return (
    <span className="text-[10px] font-mono text-gray-300 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08] flex items-center gap-1 max-w-40">
      <span className="truncate">{item.name}</span>
      <button onClick={() => onRemove(uuid)} className="text-gray-500 hover:text-white shrink-0">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  )
}

export default function CompareDrawer({ items, allItems, onRemove, onClear }) {
  const [expanded, setExpanded] = useState(false)

  if (!items || items.length === 0) return null

  // Validate all items are same effective category
  const matchedItems = items.map(uuid => allItems?.find(i => i.uuid === uuid)).filter(Boolean)
  const categories = [...new Set(matchedItems.map(i => effectiveCategory(i)))]
  const sameCategory = categories.length === 1

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 animate-slide-up">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-sc-darker/95 backdrop-blur-sm border-t border-sc-accent2/30 px-4 py-2.5 flex items-center gap-3"
      >
        <Scale className="w-4 h-4 text-sc-accent2" />
        <span className="text-xs font-display uppercase tracking-wide text-sc-accent2">
          Compare ({items.length}/3)
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {items.map(uuid => (
            <CompareItemLoader key={uuid} uuid={uuid} onRemove={onRemove} />
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClear() }}
          className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          Clear
        </button>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
      </button>

      {/* Expanded comparison table */}
      {expanded && (
        <div className="bg-sc-darker/98 backdrop-blur-sm border-t border-white/[0.06] max-h-[60vh] overflow-y-auto p-4">
          {!sameCategory ? (
            <p className="text-xs font-mono text-amber-400 text-center py-4">
              Can only compare items in the same category. Remove items to fix.
            </p>
          ) : (
            <CompareTable items={matchedItems} category={categories[0]} />
          )}
        </div>
      )}
    </div>
  )
}
