import React, { useCallback } from 'react'
import { GripVertical, Eye, EyeOff } from 'lucide-react'
import useDragReorder from './useDragReorder'
import { CATEGORY_FIELDS, FIELD_LABELS, buildPreviewLabel } from './constants'

export default function CategoryFieldConfig({ dbKey, catFormat, onChange }) {
  const available = CATEGORY_FIELDS[dbKey] || []
  const { fields, format } = catFormat

  const handleReorder = useCallback((newFields) => {
    onChange({ ...catFormat, fields: newFields })
  }, [catFormat, onChange])

  const { containerRef, dragIdx, overIdx, startDrag } = useDragReorder(fields, handleReorder)

  const toggleField = (field) => {
    const next = fields.includes(field)
      ? fields.filter(f => f !== field)
      : [...fields, field]
    onChange({ ...catFormat, fields: next })
  }

  const setFormat = (fmt) => onChange({ ...catFormat, format: fmt })

  const preview = buildPreviewLabel(dbKey, fields, format)
  const inactive = available.filter(f => !fields.includes(f))

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Live preview */}
      <div className="bg-black/40 rounded px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Preview</p>
        <p className="text-sm font-mono text-sc-accent">{preview}</p>
      </div>

      {/* Position toggle */}
      <div className="flex gap-4">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Position</p>
          <div className="flex gap-1">
            {[['suffix', 'Name [...]'], ['prefix', '[...] Name']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                  format === key
                    ? 'bg-sc-accent/10 border-sc-accent/30 text-sc-accent'
                    : 'border-sc-border text-gray-400 hover:border-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active fields — drag to reorder */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Fields (drag to reorder)</p>
        <div ref={containerRef} className="space-y-1">
          {fields.map((field, idx) => (
            <div
              key={field}
              className={`flex items-center gap-2 bg-sc-accent/5 border rounded px-2.5 py-1.5 select-none transition-colors ${
                dragIdx === idx ? 'opacity-40 border-sc-accent/40' :
                overIdx === idx && dragIdx !== null ? 'border-sc-accent bg-sc-accent/10' :
                'border-sc-accent/20'
              }`}
            >
              <GripVertical
                className="w-3.5 h-3.5 text-gray-500 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => startDrag(e, idx)}
              />
              <span className="text-xs text-gray-200 flex-1">{FIELD_LABELS[field]}</span>
              <button
                onClick={() => toggleField(field)}
                className="p-0.5 rounded hover:bg-red-500/20 cursor-pointer"
                title="Remove field"
              >
                <EyeOff className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Inactive fields — click to add */}
        {inactive.map(field => (
          <button
            key={field}
            onClick={() => toggleField(field)}
            className="flex items-center gap-2 w-full bg-black/20 border border-dashed border-sc-border rounded px-2.5 py-1.5 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs flex-1 text-left">{FIELD_LABELS[field]}</span>
            <span className="text-[10px]">click to add</span>
          </button>
        ))}
      </div>
    </div>
  )
}
