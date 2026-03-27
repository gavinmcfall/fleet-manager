import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FILTER_DIMENSIONS } from './filterDimensions'

/** Multi-dimensional filters with include/exclude semantics via URL params. */
export default function useMultiFilters(category) {
  const [searchParams, setSearchParams] = useSearchParams()

  const dimensions = FILTER_DIMENSIONS[category] || []

  const includes = useMemo(() => {
    const map = {}
    for (const dim of dimensions) {
      const raw = searchParams.get(`f_${dim.key}`)
      if (raw) map[dim.key] = new Set(raw.split(','))
    }
    return map
  }, [searchParams, dimensions])

  const excludes = useMemo(() => {
    const map = {}
    for (const dim of dimensions) {
      const raw = searchParams.get(`fx_${dim.key}`)
      if (raw) map[dim.key] = new Set(raw.split(','))
    }
    return map
  }, [searchParams, dimensions])

  const hasAny = useMemo(() => {
    return Object.values(includes).some(s => s.size > 0) ||
           Object.values(excludes).some(s => s.size > 0)
  }, [includes, excludes])

  const toggle = useCallback((dimKey, value, event) => {
    const isShift = event?.shiftKey
    const isCtrl = event?.ctrlKey || event?.metaKey

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const incKey = `f_${dimKey}`
      const excKey = `fx_${dimKey}`

      if (isCtrl) {
        // Ctrl+click: toggle exclude
        const excSet = new Set((next.get(excKey) || '').split(',').filter(Boolean))
        if (excSet.has(value)) {
          excSet.delete(value)
        } else {
          excSet.add(value)
          // Remove from includes if present
          const incSet = new Set((next.get(incKey) || '').split(',').filter(Boolean))
          incSet.delete(value)
          if (incSet.size) next.set(incKey, [...incSet].join(',')); else next.delete(incKey)
        }
        if (excSet.size) next.set(excKey, [...excSet].join(',')); else next.delete(excKey)
      } else if (isShift) {
        // Shift+click: additive include
        const incSet = new Set((next.get(incKey) || '').split(',').filter(Boolean))
        if (incSet.has(value)) {
          incSet.delete(value)
        } else {
          incSet.add(value)
          // Remove from excludes if present
          const excSet = new Set((next.get(excKey) || '').split(',').filter(Boolean))
          excSet.delete(value)
          if (excSet.size) next.set(excKey, [...excSet].join(',')); else next.delete(excKey)
        }
        if (incSet.size) next.set(incKey, [...incSet].join(',')); else next.delete(incKey)
      } else {
        // Plain click: solo filter (clear dimension, set only this value)
        const current = next.get(incKey)
        if (current === value) {
          // Already solo on this value — toggle off
          next.delete(incKey)
        } else {
          next.set(incKey, value)
        }
        next.delete(excKey)
      }

      next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const clearDimension = useCallback((dimKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete(`f_${dimKey}`)
      next.delete(`fx_${dimKey}`)
      next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const clearAll = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const dim of dimensions) {
        next.delete(`f_${dim.key}`)
        next.delete(`fx_${dim.key}`)
      }
      // Also clear the old sub param
      next.delete('sub')
      next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams, dimensions])

  return { dimensions, includes, excludes, toggle, clearDimension, clearAll, hasAny }
}
