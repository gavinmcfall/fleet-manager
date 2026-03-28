import { useState } from 'react'
import { Scale, X, ChevronUp, ChevronDown } from 'lucide-react'
import CompareTable from './CompareTable'

export default function CompareDrawer({ selected, allComponents, onRemove, onClear, apiType, maxCompare }) {
  const [expanded, setExpanded] = useState(false)

  if (!selected || selected.length === 0) return null

  const matchedItems = selected.map(id => allComponents?.find(c => c.id === id)).filter(Boolean)

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 animate-slide-up">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-sc-darker/95 backdrop-blur-sm border-t border-sc-accent/30 px-4 py-2.5 flex items-center gap-3 cursor-pointer"
      >
        <Scale className="w-4 h-4 text-sc-accent" />
        <span className="text-xs font-display uppercase tracking-wide text-sc-accent">
          Compare ({selected.length}/{maxCompare})
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {matchedItems.map(item => (
            <span
              key={item.id}
              className="text-[10px] font-mono text-gray-300 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08] flex items-center gap-1 max-w-40 shrink-0"
            >
              <span className="truncate">{item.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                className="text-gray-500 hover:text-white shrink-0"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClear() }}
          className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          Clear
        </button>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-500" />
          : <ChevronUp className="w-4 h-4 text-gray-500" />
        }
      </button>

      {/* Expanded comparison table */}
      {expanded && (
        <div className="bg-sc-darker/98 backdrop-blur-sm border-t border-white/[0.06] max-h-[60vh] overflow-y-auto p-4">
          {matchedItems.length < 2 ? (
            <p className="text-xs font-mono text-gray-500 text-center py-4">
              Select at least 2 components to compare
            </p>
          ) : (
            <CompareTable items={matchedItems} apiType={apiType} />
          )}
        </div>
      )}
    </div>
  )
}
