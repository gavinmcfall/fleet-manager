import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import CategoryFieldConfig from './CategoryFieldConfig'
import { LABEL_CATEGORIES, CATEGORY_FIELDS, buildPreviewLabel } from './constants'

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-sc-accent' : 'bg-gray-700'}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-[2px] ${checked ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  )
}

export default function ItemLabelsSection({ config, onUpdateConfig, getCatFormat, onUpdateCatFormat }) {
  const [expandedCat, setExpandedCat] = useState(null)

  // Auto-expand when a category gets toggled on
  const handleToggle = (cat) => {
    const wasEnabled = config[cat.key] || false
    onUpdateConfig({ [cat.key]: !wasEnabled })
    if (!wasEnabled) {
      // Toggling ON — auto-expand to show config
      setExpandedCat(cat.dbKey)
    } else {
      // Toggling OFF — collapse if this one was expanded
      if (expandedCat === cat.dbKey) setExpandedCat(null)
    }
  }

  return (
    <div className="panel">
      <div className="px-5 py-4 border-b border-sc-border">
        <h3 className="font-display font-semibold text-sm text-white">Item Labels</h3>
        <p className="text-xs text-gray-500 mt-0.5">Add metadata to item names in-game. Toggle a category on to configure which fields appear and their order.</p>
      </div>

      <div className="p-4 space-y-2">
        {LABEL_CATEGORIES.map(cat => {
          const enabled = config[cat.key] || false
          const catFormat = getCatFormat(cat.dbKey)
          const isExpanded = expandedCat === cat.dbKey && enabled

          return (
            <div key={cat.key}>
              {/* Category header with toggle */}
              <button
                onClick={() => {
                  if (enabled) setExpandedCat(isExpanded ? null : cat.dbKey)
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-2.5 border transition-colors cursor-pointer ${
                  enabled
                    ? isExpanded ? 'bg-sc-accent/5 border-sc-accent/30 rounded-t' : 'bg-sc-accent/5 border-sc-accent/30 rounded'
                    : 'bg-black/20 border-sc-border hover:border-gray-600 rounded'
                }`}
              >
                <div onClick={(e) => { e.stopPropagation() }}>
                  <Toggle checked={enabled} onChange={() => handleToggle(cat)} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-200">{cat.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.desc}</p>
                </div>
                {enabled && (
                  <>
                    <span className="text-xs font-mono text-sc-accent/80 shrink-0 hidden sm:inline">
                      {buildPreviewLabel(cat.dbKey, catFormat.fields, catFormat.format)}
                    </span>
                    <span className="w-5 shrink-0 flex items-center justify-center">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                    </span>
                  </>
                )}
              </button>

              {/* Expanded config — shows field order, visibility, prefix/suffix */}
              {isExpanded && (
                <div className="border border-t-0 border-sc-accent/20 rounded-b bg-black/10 pt-3">
                  <CategoryFieldConfig
                    dbKey={cat.dbKey}
                    catFormat={catFormat}
                    onChange={(fmt) => onUpdateCatFormat(cat.dbKey, fmt)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
