import { useState, useCallback } from 'react'

/**
 * Sort state hook for the blueprint list view.
 *
 * @param {string} initialColumn - column key to sort by on first render
 * @param {'asc' | 'desc'} initialDirection
 *
 * Returns:
 *   - column:     current sort column key
 *   - direction:  'asc' or 'desc'
 *   - toggle(col): if col === current column, flip direction; else switch to col with direction 'desc'
 *   - applySort(rows, selector): returns a sorted copy of rows; selector extracts the value from each row
 *     (null values always sink to the bottom)
 */
export default function useSortState(initialColumn, initialDirection = 'desc') {
  const [column, setColumn] = useState(initialColumn)
  const [direction, setDirection] = useState(initialDirection)

  const toggle = useCallback((nextColumn) => {
    if (nextColumn === column) {
      setDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setColumn(nextColumn)
      setDirection('desc')
    }
  }, [column])

  const applySort = useCallback((rows, selector) => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = selector(a)
      const bv = selector(b)
      const aNull = av == null
      const bNull = bv == null
      // Nulls always sink regardless of direction
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      // Numeric or string comparison
      if (typeof av === 'string' || typeof bv === 'string') {
        return direction === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      }
      return direction === 'asc' ? av - bv : bv - av
    })
    return copy
  }, [direction])

  return { column, direction, toggle, applySort }
}
