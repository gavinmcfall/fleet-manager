import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlueprintListRow from './BlueprintListRow'

const BP = {
  id: 1,
  type: 'weapons',
  sub_type: 'rifle',
  name: 'Behring P8-AR',
  craft_time_seconds: 270,
  slots: [{ resource_name: 'Beryl' }, { resource_name: 'Tin' }],
  base_stats: {
    item_name: 'Behring P8-AR Battle Rifle',
    dps: 412, dps_max: 618,
    rounds_per_minute: 650, rounds_per_minute_max: 780,
    range_m: 35, range_m_max: 52,
  },
}

describe('BlueprintListRow', () => {
  it('renders all six stat numbers', () => {
    render(<BlueprintListRow blueprint={BP} />)
    ;['412', '618', '650', '780', '35', '52'].forEach(n =>
      expect(screen.getByText(n)).toBeInTheDocument()
    )
  })

  it('renders the blueprint name', () => {
    render(<BlueprintListRow blueprint={BP} />)
    expect(screen.getByText('Behring P8-AR Battle Rifle')).toBeInTheDocument()
  })

  it('renders the formatted craft time', () => {
    render(<BlueprintListRow blueprint={BP} />)
    expect(screen.getByText('4m 30s')).toBeInTheDocument()
  })

  it('invokes onCompare when compare action is clicked', async () => {
    const onCompare = vi.fn()
    render(<BlueprintListRow blueprint={BP} onCompare={onCompare} />)
    await userEvent.click(screen.getByRole('button', { name: /compare/i }))
    expect(onCompare).toHaveBeenCalledWith(BP)
  })

  it('shows selected data-attribute when isInCompare is true', () => {
    render(<BlueprintListRow blueprint={BP} isInCompare={true} />)
    const row = screen.getByRole('row')
    expect(row).toHaveAttribute('data-selected', 'true')
  })
})
