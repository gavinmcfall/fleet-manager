import { useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronUp, ChevronDown, GripVertical, RotateCcw } from 'lucide-react'
import { DmgShape, getDamageType } from '../Loadout/loadoutHelpers'
import { reconcileColumns } from './useColumnOrder'

export default function ComponentTable({
  components, columns, columnOrder, onReorderColumns, onResetColumns,
  isSelected, onToggleCompare, compareCount, maxCompare,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const sortKey = searchParams.get('sort') || null
  const sortDir = searchParams.get('dir') || 'desc'
  const dragColRef = useRef(null)

  // Reconcile saved column order with current config
  const orderedKeys = useMemo(
    () => reconcileColumns(columnOrder, columns),
    [columnOrder, columns],
  )
  const colMap = useMemo(() => {
    const m = {}
    for (const col of columns) m[col.key] = col
    return m
  }, [columns])
  const orderedCols = orderedKeys.map(k => colMap[k]).filter(Boolean)

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return components
    const col = colMap[sortKey]
    return [...components].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      const na = Number(va), nb = Number(vb)
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na
      return 0
    })
  }, [components, sortKey, sortDir, colMap])

  const toggleSort = (key) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (sortKey === key) {
        next.set('dir', sortDir === 'asc' ? 'desc' : 'asc')
      } else {
        next.set('sort', key)
        next.set('dir', 'desc')
      }
      return next
    }, { replace: true })
  }

  // Drag-and-drop column reorder handlers
  const handleDragStart = (e, idx) => {
    dragColRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
  const handleDragOver = (e) => { e.preventDefault() }
  const handleDrop = (e, dropIdx) => {
    e.preventDefault()
    const dragIdx = dragColRef.current
    if (dragIdx === null || dragIdx === dropIdx) return
    const newOrder = [...orderedKeys]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(dropIdx, 0, moved)
    onReorderColumns(newOrder)
    dragColRef.current = null
  }

  const renderCell = (comp, col) => {
    const val = comp[col.key]
    if (val == null || val === '') {
      return <span className="text-gray-600">&mdash;</span>
    }
    // Special: damage_type column with shape
    if (col.key === 'damage_type') {
      const dt = getDamageType(comp)
      if (dt) return <span className="flex items-center gap-1"><DmgShape type={dt} size={10} /><span className="text-[10px]">{val}</span></span>
      return <span className="text-[10px]">{val}</span>
    }
    if (col.format) return col.format(val)
    return String(val)
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/[0.08]">
              {/* Compare checkbox header */}
              <th className="w-10 px-2 py-2.5">
                <span className="text-[9px] font-mono text-gray-600">{compareCount}/{maxCompare}</span>
              </th>
              {orderedCols.map((col, idx) => {
                const isSorted = sortKey === col.key
                const isNameCol = col.key === 'name'
                return (
                  <th
                    key={col.key}
                    draggable={!isNameCol}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => toggleSort(col.key)}
                    className={`px-2 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors hover:text-gray-300 ${col.align === 'left' ? 'text-left' : 'text-right'} ${col.width || ''} ${isNameCol ? 'sticky left-0 z-10 bg-white/[0.03]' : ''}`}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {!isNameCol && (
                        <GripVertical className="w-2.5 h-2.5 text-gray-700 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                      )}
                      {col.label}
                      {isSorted && (
                        sortDir === 'asc'
                          ? <ChevronUp className="w-3 h-3 text-sc-accent" />
                          : <ChevronDown className="w-3 h-3 text-sc-accent" />
                      )}
                    </span>
                  </th>
                )
              })}
              {/* Reset column order */}
              {columnOrder && (
                <th className="w-8 px-1 py-2.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onResetColumns() }}
                    title="Reset column order"
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((comp) => {
              const selected = isSelected(comp.id)
              return (
                <tr
                  key={comp.id}
                  className={`border-b border-white/[0.03] transition-colors ${
                    selected
                      ? 'bg-sc-accent/[0.06] border-l-2 border-l-sc-accent/60'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Compare checkbox */}
                  <td className="w-10 px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleCompare(comp.id)}
                      className="w-3.5 h-3.5 rounded border-white/[0.15] bg-white/[0.03] text-sc-accent focus:ring-sc-accent/30 cursor-pointer accent-sc-accent"
                    />
                  </td>
                  {orderedCols.map((col) => {
                    const isNameCol = col.key === 'name'
                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 text-xs ${
                          isNameCol
                            ? 'sticky left-0 z-10 bg-inherit text-gray-200 font-medium'
                            : col.align === 'left'
                              ? 'text-left text-gray-400'
                              : 'text-right font-mono tabular-nums text-gray-300'
                        } ${col.width || ''}`}
                      >
                        {renderCell(comp, col)}
                      </td>
                    )
                  })}
                  {columnOrder && <td className="w-8" />}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="py-12 text-center text-gray-600 text-xs font-mono">No components match your filters</div>
      )}
    </div>
  )
}
