import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useCompareTray from './useCompareTray'

const BP1 = { id: 1, type: 'weapons', name: 'P8-AR' }
const BP2 = { id: 2, type: 'weapons', name: 'TB-12' }
const BP3 = { id: 3, type: 'weapons', name: 'Arrowhead' }
const BP4 = { id: 4, type: 'weapons', name: 'L86' }
const ARMOUR_BP = { id: 5, type: 'armour', name: 'Cuirass' }

describe('useCompareTray', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useCompareTray())
    expect(result.current.items).toEqual([])
    expect(result.current.count).toBe(0)
    expect(result.current.isInTray(BP1)).toBe(false)
  })

  it('adds a blueprint and exposes count + presence checks', () => {
    const { result } = renderHook(() => useCompareTray())
    act(() => { result.current.add(BP1) })
    expect(result.current.count).toBe(1)
    expect(result.current.isInTray(BP1)).toBe(true)
    expect(result.current.isInTray(BP2)).toBe(false)
  })

  it('rejects a 4th blueprint (max 3)', () => {
    const { result } = renderHook(() => useCompareTray())
    act(() => {
      result.current.add(BP1)
      result.current.add(BP2)
      result.current.add(BP3)
      result.current.add(BP4)
    })
    expect(result.current.count).toBe(3)
    expect(result.current.isInTray(BP4)).toBe(false)
  })

  it('rejects a blueprint of a different type than the first item', () => {
    const { result } = renderHook(() => useCompareTray())
    act(() => {
      result.current.add(BP1)
      result.current.add(ARMOUR_BP)
    })
    expect(result.current.count).toBe(1)
    expect(result.current.isInTray(ARMOUR_BP)).toBe(false)
  })

  it('toggles a blueprint: add → remove on second call', () => {
    const { result } = renderHook(() => useCompareTray())
    act(() => { result.current.toggle(BP1) })
    expect(result.current.isInTray(BP1)).toBe(true)
    act(() => { result.current.toggle(BP1) })
    expect(result.current.isInTray(BP1)).toBe(false)
  })

  it('clear() empties the tray', () => {
    const { result } = renderHook(() => useCompareTray())
    act(() => {
      result.current.add(BP1)
      result.current.add(BP2)
      result.current.clear()
    })
    expect(result.current.count).toBe(0)
  })

  it('after clear, accepts a new type', () => {
    const { result } = renderHook(() => useCompareTray())
    act(() => {
      result.current.add(BP1)
      result.current.clear()
      result.current.add(ARMOUR_BP)
    })
    expect(result.current.count).toBe(1)
    expect(result.current.isInTray(ARMOUR_BP)).toBe(true)
  })
})
