import { describe, it, expect } from 'vitest'
import { formatCraftTime, formatTime } from './craftingUtils'

describe('formatCraftTime (mm:ss for Crafting v2)', () => {
  it('formats 270 seconds as 4:30', () => {
    expect(formatCraftTime(270)).toBe('4:30')
  })

  it('formats exact minutes with zero-padded seconds', () => {
    expect(formatCraftTime(240)).toBe('4:00')
  })

  it('zero-pads single-digit seconds', () => {
    expect(formatCraftTime(65)).toBe('1:05')
  })

  it('handles sub-minute values as 0:SS', () => {
    expect(formatCraftTime(45)).toBe('0:45')
    expect(formatCraftTime(5)).toBe('0:05')
  })

  it('formats an em dash for null or undefined', () => {
    expect(formatCraftTime(null)).toBe('—')
    expect(formatCraftTime(undefined)).toBe('—')
  })

  it('formats 0 as 0:00 (not an em dash)', () => {
    // 0 is a valid craft time — a blueprint with no build time. Treating
    // it as "missing" would hide valid data.
    expect(formatCraftTime(0)).toBe('0:00')
  })

  it('handles large values without overflow', () => {
    expect(formatCraftTime(3725)).toBe('62:05') // 1 hour 2 minutes 5 seconds
  })
})

describe('formatTime (legacy, still used by v1)', () => {
  // Sanity check that the legacy formatter still outputs "Xm Ys" format.
  // v2 must never break this — v1 pages still depend on it.
  it('outputs "4m 30s" for 270 seconds', () => {
    expect(formatTime(270)).toBe('4m 30s')
  })
  it('outputs "4m" for exact minutes', () => {
    expect(formatTime(240)).toBe('4m')
  })
  it('outputs "Ns" for under a minute', () => {
    expect(formatTime(45)).toBe('45s')
  })
})
