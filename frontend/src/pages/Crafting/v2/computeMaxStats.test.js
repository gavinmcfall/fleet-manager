import { describe, it, expect } from 'vitest'
import { computeMaxStats } from './computeMaxStats'

/**
 * Simulates a weapon blueprint with slot modifiers that boost damage by
 * 50% at Q1000 (modifier_at_end = 1.5) and firerate by 20% (1.2).
 */
const WEAPON_BP = {
  type: 'weapons',
  base_stats: {
    damage: 100,
    rounds_per_minute: 600,
    dps: 1000, // 100 * 600 / 60
    effective_range: 35,
  },
  slots: [
    {
      modifiers: [
        { key: 'weapon_damage', modifier_at_start: 1.0, modifier_at_end: 1.5 },
        { key: 'weapon_firerate', modifier_at_start: 1.0, modifier_at_end: 1.2 },
      ],
    },
  ],
}

const ARMOUR_BP = {
  type: 'armour',
  base_stats: {
    resist_physical: 0.3,
    resist_energy: 0.25,
    resist_stun: 0.1,
  },
  slots: [
    {
      modifiers: [
        { key: 'armor_damagemitigation', modifier_at_start: 1.0, modifier_at_end: 1.4 },
      ],
    },
  ],
}

describe('computeMaxStats', () => {
  describe('weapons', () => {
    it('computes rounds_per_minute_max as rpm × firerate multiplier', () => {
      const result = computeMaxStats(WEAPON_BP)
      // 600 RPM × 1.2 = 720
      expect(result.rounds_per_minute_max).toBe(720)
    })

    it('computes dps_max as (damage × dmgMult) × (rpm × rpmMult) / 60', () => {
      const result = computeMaxStats(WEAPON_BP)
      // (100 × 1.5) × (600 × 1.2) / 60 = 150 × 720 / 60 = 1800
      expect(result.dps_max).toBe(1800)
    })

    it('stacks modifiers multiplicatively across slots', () => {
      const bp = {
        type: 'weapons',
        base_stats: { damage: 100, rounds_per_minute: 600 },
        slots: [
          { modifiers: [{ key: 'weapon_damage', modifier_at_end: 1.2 }] },
          { modifiers: [{ key: 'weapon_damage', modifier_at_end: 1.1 }] },
        ],
      }
      // damage mult = 1.2 × 1.1 = 1.32
      // rpm mult = 1 (no firerate modifiers)
      // dps_max = (100 × 1.32) × (600 × 1) / 60 = 1320
      const result = computeMaxStats(bp)
      expect(result.dps_max).toBeCloseTo(1320, 5)
    })

    it('returns empty object when the blueprint has no modifiers at all', () => {
      const bp = {
        type: 'weapons',
        base_stats: { damage: 100, rounds_per_minute: 600 },
        slots: [],
      }
      // No modifiers → both multipliers default to 1
      // damage_max = 100 × 1 = 100
      // rpm_max = 600 × 1 = 600
      // dps_max = 100 × 600 / 60 = 1000 (same as base)
      const result = computeMaxStats(bp)
      expect(result.rounds_per_minute_max).toBe(600)
      expect(result.dps_max).toBe(1000)
    })

    it('does not compute max when base damage or rpm is missing', () => {
      const bp = {
        type: 'weapons',
        base_stats: { damage: 100 /* no rpm */ },
        slots: [{ modifiers: [{ key: 'weapon_damage', modifier_at_end: 1.5 }] }],
      }
      const result = computeMaxStats(bp)
      // Can't compute dps_max without both damage and rpm
      expect(result.dps_max).toBeUndefined()
      expect(result.rounds_per_minute_max).toBeUndefined()
    })
  })

  describe('armour', () => {
    it('applies the damagemitigation multiplier to every resist_* base', () => {
      const result = computeMaxStats(ARMOUR_BP)
      // 0.3 × 1.4 = 0.42
      expect(result.resist_physical_max).toBeCloseTo(0.42, 5)
      // 0.25 × 1.4 = 0.35
      expect(result.resist_energy_max).toBeCloseTo(0.35, 5)
      // 0.1 × 1.4 = 0.14
      expect(result.resist_stun_max).toBeCloseTo(0.14, 5)
    })

    it('leaves resist fields unset when there is no damagemitigation modifier', () => {
      const bp = {
        type: 'armour',
        base_stats: { resist_physical: 0.3 },
        slots: [],
      }
      // No modifier → mult = 1 → max = base × 1 = same. Still returned
      // so StatCell can render `0.3 → 0.3` and sameValue collapses it
      // to a single value.
      const result = computeMaxStats(bp)
      expect(result.resist_physical_max).toBe(0.3)
    })

    it('only sets max for resist fields that exist on base_stats', () => {
      const bp = {
        type: 'armour',
        base_stats: { resist_physical: 0.3 /* no energy or stun */ },
        slots: [{ modifiers: [{ key: 'armor_damagemitigation', modifier_at_end: 1.4 }] }],
      }
      const result = computeMaxStats(bp)
      expect(result.resist_physical_max).toBeCloseTo(0.42, 5)
      expect(result.resist_energy_max).toBeUndefined()
      expect(result.resist_stun_max).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('returns empty object for null blueprint', () => {
      expect(computeMaxStats(null)).toEqual({})
    })

    it('returns empty object for blueprint with no base_stats', () => {
      expect(computeMaxStats({ type: 'weapons', slots: [] })).toEqual({})
    })

    it('handles missing slots array', () => {
      const bp = { type: 'weapons', base_stats: { damage: 100, rounds_per_minute: 600 } }
      // No slots → no modifiers → multipliers default to 1 → computed
      // max === base, which is valid (just no crafting lift available)
      const result = computeMaxStats(bp)
      expect(result.rounds_per_minute_max).toBe(600)
    })

    it('ignores modifiers without a key', () => {
      const bp = {
        type: 'weapons',
        base_stats: { damage: 100, rounds_per_minute: 600 },
        slots: [{ modifiers: [{ modifier_at_end: 1.5 /* no key */ }] }],
      }
      const result = computeMaxStats(bp)
      // Unkeyed modifier ignored → multipliers stay at 1
      expect(result.dps_max).toBe(1000)
    })
  })
})
