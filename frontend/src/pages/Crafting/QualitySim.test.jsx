import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QualitySim from './QualitySim'

// saveUserBlueprint is only called by the Save Config button — not under test here.
vi.mock('../../hooks/useAPI', () => ({
  saveUserBlueprint: vi.fn(),
}))

const makeBp = (id, slotName) => ({
  id,
  base_stats: { item_name: `Item ${id}`, damage: 10, rounds_per_minute: 600, dps: 100 },
  slots: [
    {
      slot_index: 0,
      name: slotName,
      resource_name: 'Steel',
      modifiers: [
        { key: 'weapon_damage', name: 'Damage', start_quality: 0, end_quality: 1000, modifier_at_start: 1.0, modifier_at_end: 1.5 },
      ],
    },
  ],
})

describe('QualitySim', () => {
  it('renders one slider per unique slot', () => {
    const bp = makeBp(1, 'Barrel')
    render(<QualitySim blueprint={bp} />)
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(1)
  })

  it('resets quality state when blueprint changes (via key remount)', () => {
    const bp1 = makeBp(1, 'Barrel')
    const bp2 = makeBp(2, 'Stock')

    // Wrapper imitates QualitySimPage's key={bp.id} usage
    function Wrapper({ blueprint }) {
      return <QualitySim key={blueprint.id} blueprint={blueprint} />
    }

    const { rerender } = render(<Wrapper blueprint={bp1} />)
    // Move slider on bp1 to 1000
    const slider1 = screen.getByRole('slider')
    fireEvent.change(slider1, { target: { value: '1000' } })
    // Both the range input and the text input in QualitySlider show the same value.
    expect(screen.getAllByDisplayValue('1000')).toHaveLength(2)

    // Switch to bp2 — key change forces fresh state, slider resets to default 500
    rerender(<Wrapper blueprint={bp2} />)
    const slider2 = screen.getByRole('slider')
    expect(slider2.value).toBe('500')
  })

  it('renders mineral display name for item slots', () => {
    const bp = {
      id: 99,
      base_stats: { item_name: 'Sniper', damage: 100, rounds_per_minute: 60, dps: 100 },
      slots: [
        {
          slot_index: 0,
          name: 'Frame',
          resource_name: 'Iron',
          slot_type: 'resource',
          item_class: null,
          modifiers: [{ key: 'weapon_damage', name: 'Damage', start_quality: 0, end_quality: 1000, modifier_at_start: 1, modifier_at_end: 1.2 }],
        },
        {
          slot_index: 1,
          name: 'Precision Parts',
          resource_name: 'Hadanite',
          slot_type: 'item',
          item_class: 'harvestable_mineral_1h_hadanite',
          modifiers: [{ key: 'weapon_damage', name: 'Damage', start_quality: 0, end_quality: 1000, modifier_at_start: 0.9, modifier_at_end: 1.1 }],
        },
      ],
    }
    render(<QualitySim blueprint={bp} />)
    // Resource slot label visible
    expect(screen.getByText('Iron')).toBeTruthy()
    // Item slot's mineral name visible (rendered via QualitySlider)
    expect(screen.getByText('Hadanite')).toBeTruthy()
  })

  it('marks item slots with a MINERAL badge so users can distinguish them', () => {
    const bp = {
      id: 100,
      base_stats: { item_name: 'Sniper', damage: 100, rounds_per_minute: 60, dps: 100 },
      slots: [
        {
          slot_index: 0,
          name: 'Precision Parts',
          resource_name: 'Hadanite',
          slot_type: 'item',
          item_class: 'harvestable_mineral_1h_hadanite',
          modifiers: [{ key: 'weapon_damage', name: 'Damage', start_quality: 0, end_quality: 1000, modifier_at_start: 0.9, modifier_at_end: 1.1 }],
        },
      ],
    }
    render(<QualitySim blueprint={bp} />)
    // The MINERAL badge text appears for item slots
    expect(screen.getByText('MINERAL')).toBeTruthy()
  })

  it('does NOT show MINERAL badge on resource slots', () => {
    const bp = {
      id: 101,
      base_stats: { item_name: 'Rifle', damage: 100, rounds_per_minute: 60, dps: 100 },
      slots: [
        {
          slot_index: 0,
          name: 'Frame',
          resource_name: 'Iron',
          slot_type: 'resource',
          item_class: null,
          modifiers: [{ key: 'weapon_damage', name: 'Damage', start_quality: 0, end_quality: 1000, modifier_at_start: 1, modifier_at_end: 1.2 }],
        },
      ],
    }
    render(<QualitySim blueprint={bp} />)
    expect(screen.queryByText('MINERAL')).toBeNull()
  })
})
