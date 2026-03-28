import { useState, useCallback, useEffect } from 'react'

const STORAGE_PREFIX = 'sc-bridge-compare-'
const MAX_COMPARE = 4

/** Per-type compare selection with localStorage persistence. */
export default function useCompareSelection(componentType) {
  const storageKey = `${STORAGE_PREFIX}${componentType}`

  const [selected, setSelected] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(selected)) } catch {}
  }, [storageKey, selected])

  // Reset when component type changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      setSelected(saved ? JSON.parse(saved) : [])
    } catch { setSelected([]) }
  }, [storageKey])

  const toggle = useCallback((componentId) => {
    setSelected(prev => {
      if (prev.includes(componentId)) return prev.filter(id => id !== componentId)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, componentId]
    })
  }, [])

  const clear = useCallback(() => setSelected([]), [])

  const isSelected = useCallback((componentId) => selected.includes(componentId), [selected])

  return {
    selected,
    toggle,
    clear,
    isSelected,
    count: selected.length,
    maxReached: selected.length >= MAX_COMPARE,
    MAX_COMPARE,
  }
}
