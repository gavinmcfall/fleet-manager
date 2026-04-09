import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import useUxVariant from './useUxVariant'

function wrap(initialEntries) {
  return ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  )
}

describe('useUxVariant', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns v1 when no query string and no stored preference', () => {
    const { result } = renderHook(() => useUxVariant(), {
      wrapper: wrap(['/crafting']),
    })
    expect(result.current).toBe('v1')
  })

  it('returns v2 and persists to localStorage when ?ux=v2', () => {
    const { result } = renderHook(() => useUxVariant(), {
      wrapper: wrap(['/crafting?ux=v2']),
    })
    expect(result.current).toBe('v2')
    expect(localStorage.getItem('uxVariant')).toBe('v2')
  })

  it('returns v2 on subsequent plain visit after sticky persistence', () => {
    localStorage.setItem('uxVariant', 'v2')
    const { result } = renderHook(() => useUxVariant(), {
      wrapper: wrap(['/crafting']),
    })
    expect(result.current).toBe('v2')
  })

  it('returns v1 and clears localStorage when ?ux=v1', () => {
    localStorage.setItem('uxVariant', 'v2')
    const { result } = renderHook(() => useUxVariant(), {
      wrapper: wrap(['/crafting?ux=v1']),
    })
    expect(result.current).toBe('v1')
    expect(localStorage.getItem('uxVariant')).toBeNull()
  })

  it('unknown ux value falls back to stored preference', () => {
    localStorage.setItem('uxVariant', 'v2')
    const { result } = renderHook(() => useUxVariant(), {
      wrapper: wrap(['/crafting?ux=bogus']),
    })
    expect(result.current).toBe('v2')
  })
})
