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
    expect(screen.getAllByDisplayValue('1000').length).toBeGreaterThan(0)

    // Switch to bp2 — key change forces fresh state, slider resets to default 500
    rerender(<Wrapper blueprint={bp2} />)
    const slider2 = screen.getByRole('slider')
    expect(slider2.value).toBe('500')
  })
})
