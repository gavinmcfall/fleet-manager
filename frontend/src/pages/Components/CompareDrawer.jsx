import { useState } from 'react'
import { Scale, X, ChevronUp, ChevronDown } from 'lucide-react'
import CompareTable from './CompareTable'

export default function CompareDrawer({ selected, allComponents, onRemove, onClear, apiType, maxCompare }) {
  const [expanded, setExpanded] = useState(false)

  if (!selected || selected.length === 0) return null

  const matchedItems = selected.map(id => allComponents?.find(c => c.id === id)).filter(Boolean)

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 animate-slide-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-sc-panel/95 backdrop-blur-sm border-t border-sc-accent/30 px-4 py-3 flex items-center gap-3 cursor-pointer"
      >
        <Scale className="w-4 h-4 text-sc-accent" />
        <span className="text-sm font-display uppercase tracking-wide text-sc-accent">
          Compare ({selected.length}/{maxCompare})
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {matchedItems.map(item => (
            <span
              key={item.id}
              className="text-xs font-mono text-gray-200 bg-sc-darker px-2.5 py-1 rounded border border-sc-border flex items-center gap-1.5 max-w-48 shrink-0"
            >
              <span className="truncate">{item.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                className="text-gray-400 hover:text-white shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClear() }}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors shrink-0"
        >
          Clear
        </button>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronUp className="w-4 h-4 text-gray-400" />
        }
      </button>

      {expanded && (
        <div className="bg-sc-panel/98 backdrop-blur-sm border-t border-sc-border max-h-[60vh] overflow-y-auto p-5">
          {matchedItems.length < 2 ? (
            <p className="text-sm text-gray-400 text-center py-4">
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
