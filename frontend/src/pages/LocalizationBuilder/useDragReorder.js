import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Pointer-event based drag-and-reorder with auto-scroll and floating ghost.
 * Returns { containerRef, dragIdx, overIdx, startDrag } to spread on container + grip handles.
 */
export default function useDragReorder(items, onReorder) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const containerRef = useRef(null)
  const scrollRAF = useRef(null)
  const pointerY = useRef(0)
  const dragging = useRef(false)
  const ghostRef = useRef(null)
  const itemsRef = useRef(items)
  const onReorderRef = useRef(onReorder)
  itemsRef.current = items
  onReorderRef.current = onReorder

  const tick = useCallback(() => {
    if (!dragging.current) return
    const el = containerRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const y = pointerY.current
      const edge = 48
      const maxSpeed = 8
      if (y < rect.top + edge) {
        const ratio = 1 - Math.max(0, y - rect.top) / edge
        el.scrollTop -= Math.ceil(maxSpeed * ratio)
      } else if (y > rect.bottom - edge) {
        const ratio = 1 - Math.max(0, rect.bottom - y) / edge
        el.scrollTop += Math.ceil(maxSpeed * ratio)
      }
    }
    scrollRAF.current = requestAnimationFrame(tick)
  }, [])

  const removeGhost = () => {
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null }
  }

  const startDrag = useCallback((e, idx) => {
    e.preventDefault()
    dragging.current = true
    setDragIdx(idx)
    setOverIdx(idx)
    pointerY.current = e.clientY

    const el = containerRef.current
    if (el) {
      const sourceRow = el.children[idx]
      if (sourceRow) {
        const ghost = sourceRow.cloneNode(true)
        const rect = sourceRow.getBoundingClientRect()
        ghost.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:9999;opacity:0.9;box-shadow:0 4px 20px rgba(0,0,0,0.5);border-radius:6px;transition:none;`
        document.body.appendChild(ghost)
        ghostRef.current = ghost
      }
    }

    scrollRAF.current = requestAnimationFrame(tick)

    const startY = e.clientY
    const ghostStartTop = el?.children[idx]?.getBoundingClientRect().top ?? e.clientY

    const onMove = (ev) => {
      pointerY.current = ev.clientY
      if (ghostRef.current) {
        const dy = ev.clientY - startY
        ghostRef.current.style.top = `${ghostStartTop + dy}px`
      }
      const container = containerRef.current
      if (!container) return
      const children = Array.from(container.children)
      for (let i = 0; i < children.length; i++) {
        const r = children[i].getBoundingClientRect()
        const mid = r.top + r.height / 2
        if (ev.clientY < mid) {
          setOverIdx(i)
          return
        }
      }
      setOverIdx(children.length - 1)
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      dragging.current = false
      removeGhost()
      if (scrollRAF.current) { cancelAnimationFrame(scrollRAF.current); scrollRAF.current = null }

      setDragIdx(curr => {
        setOverIdx(over => {
          if (curr !== null && over !== null && curr !== over) {
            const next = [...itemsRef.current]
            const [moved] = next.splice(curr, 1)
            next.splice(over, 0, moved)
            onReorderRef.current(next)
          }
          return null
        })
        return null
      })
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [tick])

  useEffect(() => {
    return () => { removeGhost(); if (scrollRAF.current) cancelAnimationFrame(scrollRAF.current) }
  }, [])

  return { containerRef, dragIdx, overIdx, startDrag }
}
