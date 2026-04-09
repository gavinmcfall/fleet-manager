import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useSortState from './useSortState'

describe('useSortState', () => {
  it('starts at the provided initial column and direction', () => {
    const { result } = renderHook(() => useSortState('craft', 'desc'))
    expect(result.current.column).toBe('craft')
    expect(result.current.direction).toBe('desc')
  })

  it('clicking the active column toggles direction', () => {
    const { result } = renderHook(() => useSortState('craft', 'desc'))
    act(() => { result.current.toggle('craft') })
    expect(result.current.direction).toBe('asc')
    act(() => { result.current.toggle('craft') })
    expect(result.current.direction).toBe('desc')
  })

  it('clicking a different column switches and resets direction to desc', () => {
    const { result } = renderHook(() => useSortState('craft', 'asc'))
    act(() => { result.current.toggle('dps_max') })
    expect(result.current.column).toBe('dps_max')
    expect(result.current.direction).toBe('desc')
  })

  it('sorts a list of rows by the chosen numeric column', () => {
    const { result } = renderHook(() => useSortState('craft', 'asc'))
    const rows = [
      { id: 1, craft: 270 },
      { id: 2, craft: 120 },
      { id: 3, craft: 480 },
    ]
    const sorted = result.current.applySort(rows, row => row.craft)
    expect(sorted.map(r => r.id)).toEqual([2, 1, 3])
  })

  it('desc sort reverses the order', () => {
    const { result } = renderHook(() => useSortState('craft', 'desc'))
    const rows = [
      { id: 1, craft: 270 },
      { id: 2, craft: 120 },
      { id: 3, craft: 480 },
    ]
    const sorted = result.current.applySort(rows, row => row.craft)
    expect(sorted.map(r => r.id)).toEqual([3, 1, 2])
  })

  it('null values sort to the end regardless of direction', () => {
    const { result } = renderHook(() => useSortState('dps_base', 'asc'))
    const rows = [
      { id: 1, dps_base: 412 },
      { id: 2, dps_base: null },
      { id: 3, dps_base: 285 },
    ]
    const sorted = result.current.applySort(rows, row => row.dps_base)
    expect(sorted.map(r => r.id)).toEqual([3, 1, 2])
  })
})
