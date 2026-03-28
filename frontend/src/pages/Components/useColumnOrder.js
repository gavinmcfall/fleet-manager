import { useState, useCallback } from 'react'

const STORAGE_PREFIX = 'sc-bridge-col-order-'

/** Persist column ordering per component type in localStorage. */
export default function useColumnOrder(componentType) {
  const storageKey = `${STORAGE_PREFIX}${componentType}`

  const [order, setOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const updateOrder = useCallback((newOrder) => {
    setOrder(newOrder)
    try { localStorage.setItem(storageKey, JSON.stringify(newOrder)) } catch {}
  }, [storageKey])

  const resetOrder = useCallback(() => {
    setOrder(null)
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey])

  return { order, updateOrder, resetOrder }
}

/**
 * Reconcile a saved column order with the current column config.
 * - Columns in saved order that still exist in config: keep in saved position
 * - New columns in config not in saved order: append at end
 * - Columns in saved order no longer in config: drop
 */
export function reconcileColumns(savedOrder, configColumns) {
  if (!savedOrder) return configColumns.map(c => c.key)
  const configKeys = new Set(configColumns.map(c => c.key))
  const reconciled = savedOrder.filter(k => configKeys.has(k))
  for (const col of configColumns) {
    if (!reconciled.includes(col.key)) reconciled.push(col.key)
  }
  return reconciled
}
