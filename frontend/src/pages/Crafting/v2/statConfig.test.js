import { describe, it, expect } from 'vitest'
import { STAT_CONFIG, readStat, resolveStats } from './statConfig'

describe('statConfig', () => {
  describe('STAT_CONFIG.weapons.range', () => {
    it('reads from effective_range (the real API field)', () => {
      const bp = { type: 'weapons', base_stats: { effective_range: 42 } }
      const stats = resolveStats(bp)
      const range = stats.find(s => s.key === 'range')
      expect(range.base).toBe(42)
    })

    it('marks range as isStatic (no quality modifier exists)', () => {
      const bp = { type: 'weapons', base_stats: { effective_range: 42 } }
      const stats = resolveStats(bp)
      const range = stats.find(s => s.key === 'range')
      expect(range.isStatic).toBe(true)
    })

    it('returns null max for range (no maxPath)', () => {
      const bp = { type: 'weapons', base_stats: { effective_range: 42 } }
      const stats = resolveStats(bp)
      const range = stats.find(s => s.key === 'range')
      expect(range.max).toBeNull()
    })
  })

  describe('resolveStats — no silent fallback', () => {
    it('returns null max when maxPath is missing (does NOT fall back to base)', () => {
      // Previous buggy behavior: max ?? base made max === base, triggering
      // StatCell.sameValue collapse and hiding the missing-max bug.
      const bp = { type: 'weapons', base_stats: { dps: 412 /* no dps_max */ } }
      const stats = resolveStats(bp)
      const dps = stats.find(s => s.key === 'dps')
      expect(dps.base).toBe(412)
      expect(dps.max).toBeNull()
    })

    it('returns both base and max when both are present', () => {
      const bp = {
        type: 'weapons',
        base_stats: {
          dps: 412,
          dps_max: 618,
          rounds_per_minute: 650,
          rounds_per_minute_max: 780,
          effective_range: 35,
        },
      }
      const stats = resolveStats(bp)
      expect(stats[0]).toMatchObject({ key: 'dps', base: 412, max: 618 })
      expect(stats[1]).toMatchObject({ key: 'rpm', base: 650, max: 780 })
      expect(stats[2]).toMatchObject({ key: 'range', base: 35, max: null, isStatic: true })
    })
  })

  describe('readStat', () => {
    it('returns null for missing blueprint', () => {
      expect(readStat(null, 'dps')).toBeNull()
    })
    it('returns null for missing base_stats', () => {
      expect(readStat({}, 'dps')).toBeNull()
    })
    it('returns the value for a present field', () => {
      expect(readStat({ base_stats: { dps: 412 } }, 'dps')).toBe(412)
    })
    it('returns null for a missing field', () => {
      expect(readStat({ base_stats: { dps: 412 } }, 'dps_max')).toBeNull()
    })
  })
})
