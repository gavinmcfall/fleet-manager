import { describe, it, expect } from 'vitest'
import { formatCraftTime, formatTime, isItemSlot, mineralDisplayName } from './craftingUtils'

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

describe('isItemSlot', () => {
  it('returns true for slot_type="item"', () => {
    expect(isItemSlot({ slot_type: 'item' })).toBe(true)
  })
  it('returns false for slot_type="resource"', () => {
    expect(isItemSlot({ slot_type: 'resource' })).toBe(false)
  })
  it('returns false when slot_type is missing (legacy data)', () => {
    expect(isItemSlot({})).toBe(false)
    expect(isItemSlot({ slot_type: undefined })).toBe(false)
  })
  it('returns false for null slot', () => {
    expect(isItemSlot(null)).toBe(false)
    expect(isItemSlot(undefined)).toBe(false)
  })
})

describe('mineralDisplayName', () => {
  it('strips harvestable_mineral_1h_ prefix and title-cases the tail', () => {
    expect(mineralDisplayName('harvestable_mineral_1h_hadanite')).toBe('Hadanite')
    expect(mineralDisplayName('harvestable_mineral_1h_dolivine')).toBe('Dolivine')
  })
  it('strips harvestable_ore_1h_ prefix', () => {
    expect(mineralDisplayName('harvestable_ore_1h_saldyniumore')).toBe('Saldyniumore')
  })
  it('handles multi-word tail through prefix path', () => {
    // Matches the Python implementation's behaviour for multi-word tails
    expect(mineralDisplayName('harvestable_mineral_1h_foo_bar')).toBe('Foo Bar')
  })
  it('falls back to title-cased identifier when prefix is unknown', () => {
    expect(mineralDisplayName('some_other_thing')).toBe('Some Other Thing')
  })
  it('returns empty string for null/undefined/empty', () => {
    expect(mineralDisplayName(null)).toBe('')
    expect(mineralDisplayName(undefined)).toBe('')
    expect(mineralDisplayName('')).toBe('')
  })
})
