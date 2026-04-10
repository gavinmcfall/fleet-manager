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

  describe('computeMaxStats integration', () => {
    it('overlays computed max values, rounded per stat config', () => {
      const bp = {
        type: 'weapons',
        base_stats: {
          damage: 100,
          rounds_per_minute: 600,
          dps: 1000.567, // raw float to verify rounding
          effective_range: 35,
        },
        slots: [
          {
            modifiers: [
              { key: 'weapon_damage', modifier_at_end: 1.5 },
              { key: 'weapon_firerate', modifier_at_end: 1.2 },
            ],
          },
        ],
      }
      const stats = resolveStats(bp)
      const dps = stats.find(s => s.key === 'dps')
      const rpm = stats.find(s => s.key === 'rpm')
      const range = stats.find(s => s.key === 'range')

      // dps: decimals=1, base 1000.567 → 1000.6, max (100×1.5)×(600×1.2)/60 = 1800.0
      expect(dps.base).toBe(1000.6)
      expect(dps.max).toBe(1800)

      // rpm: decimals=0, base 600, max 600×1.2 = 720
      expect(rpm.base).toBe(600)
      expect(rpm.max).toBe(720)

      // range stays static
      expect(range.base).toBe(35)
      expect(range.max).toBeNull()
      expect(range.isStatic).toBe(true)
    })

    it('scales armour resistance values by 100 for % display', () => {
      const bp = {
        type: 'armour',
        base_stats: { resist_physical: 0.3, resist_energy: 0.254, resist_stun: 0.1 },
        slots: [{ modifiers: [{ key: 'armor_damagemitigation', modifier_at_end: 1.4 }] }],
      }
      const stats = resolveStats(bp)
      // resist_physical: 0.3 × 100 = 30, max: 0.3×1.4×100 = 42
      expect(stats[0]).toMatchObject({ key: 'phys', base: 30, max: 42 })
      // resist_energy: 0.254 × 100 = 25.4 → rounded to 25 (decimals=0)
      expect(stats[1]).toMatchObject({ key: 'energy', base: 25, max: 36 })
      // resist_stun: 0.1 × 100 = 10, max: 0.1×1.4×100 = 14
      expect(stats[2]).toMatchObject({ key: 'stun', base: 10, max: 14 })
    })

    it('leaves max null when a weapon has no damage/rpm modifiers AND no base damage', () => {
      const bp = {
        type: 'weapons',
        base_stats: { dps: 1000 },
        slots: [],
      }
      const stats = resolveStats(bp)
      // dps: decimals=1, base 1000 → 1000 (no trailing .0 in number)
      expect(stats[0]).toMatchObject({ key: 'dps', base: 1000, max: null })
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
