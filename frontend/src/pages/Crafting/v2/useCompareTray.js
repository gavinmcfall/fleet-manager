import { useState, useCallback } from 'react'

const MAX_ITEMS = 3

/**
 * Compare tray state: up to 3 blueprints of the same type.
 *
 * Matches the UX contract of LootDB/CompareDrawer (max 3, same category)
 * but scoped to blueprint objects instead of loot items. Use `add` or
 * `toggle` from a row/card click; `isInTray` for the button active state.
 *
 *   const { items, count, add, remove, toggle, clear, isInTray } = useCompareTray()
 */
export default function useCompareTray() {
  const [items, setItems] = useState([])

  const isInTray = useCallback((blueprint) => {
    return items.some(i => i.id === blueprint.id)
  }, [items])

  const add = useCallback((blueprint) => {
    setItems(prev => {
      if (prev.length >= MAX_ITEMS) return prev
      if (prev.length > 0 && prev[0].type !== blueprint.type) return prev
      if (prev.some(i => i.id === blueprint.id)) return prev
      return [...prev, blueprint]
    })
  }, [])

  const remove = useCallback((blueprint) => {
    setItems(prev => prev.filter(i => i.id !== blueprint.id))
  }, [])

  const toggle = useCallback((blueprint) => {
    setItems(prev => {
      if (prev.some(i => i.id === blueprint.id)) {
        return prev.filter(i => i.id !== blueprint.id)
      }
      if (prev.length >= MAX_ITEMS) return prev
      if (prev.length > 0 && prev[0].type !== blueprint.type) return prev
      return [...prev, blueprint]
    })
  }, [])

  const clear = useCallback(() => {
    setItems([])
  }, [])

  return {
    items,
    count: items.length,
    max: MAX_ITEMS,
    add,
    remove,
    toggle,
    clear,
    isInTray,
  }
}
