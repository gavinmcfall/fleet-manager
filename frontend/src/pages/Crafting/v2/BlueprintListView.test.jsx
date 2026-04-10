import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlueprintListView from './BlueprintListView'

const makeBp = (id, name, craft, dps) => ({
  id, name, type: 'weapons', sub_type: 'rifle',
  craft_time_seconds: craft, slots: [],
  base_stats: {
    item_name: name,
    dps, dps_max: dps + 100,
    rounds_per_minute: 600, rounds_per_minute_max: 700,
    range_m: 30, range_m_max: 40,
  },
})

const BPS = [
  makeBp(1, 'Alpha Rifle',   480, 200),
  makeBp(2, 'Bravo Rifle',   120, 500),
  makeBp(3, 'Charlie Rifle', 300, 350),
]

describe('BlueprintListView', () => {
  it('renders all three rows', () => {
    render(<BlueprintListView blueprints={BPS} activeType="weapons" />)
    expect(screen.getByText('Alpha Rifle')).toBeInTheDocument()
    expect(screen.getByText('Bravo Rifle')).toBeInTheDocument()
    expect(screen.getByText('Charlie Rifle')).toBeInTheDocument()
  })

  it('sorts by craft time descending by default', () => {
    render(<BlueprintListView blueprints={BPS} activeType="weapons" />)
    const rows = screen.getAllByRole('row')
    // [header-row-1, header-row-2, data1, data2, data3] — look for data rows by finding name text order
    const names = ['Alpha Rifle', 'Bravo Rifle', 'Charlie Rifle'].map(n =>
      screen.getByText(n).closest('[role="row"]')
    )
    // Desc: 480, 300, 120 → Alpha, Charlie, Bravo
    // Determine order by document position
    const order = rows.filter(r => r.getAttribute('data-selected') !== null)
    expect(order[0]).toBe(names[0])
    expect(order[1]).toBe(names[2])
    expect(order[2]).toBe(names[1])
  })

  it('clicking DPS Base header sorts by that column', async () => {
    render(<BlueprintListView blueprints={BPS} activeType="weapons" />)
    // Two "Base" headers visible (one per stat group pair's first column).
    // The first one in the DOM is DPS Base.
    const baseButtons = screen.getAllByRole('button', { name: /^base/i })
    await userEvent.click(baseButtons[0]) // sort by DPS Base desc
    const names = ['Alpha Rifle', 'Bravo Rifle', 'Charlie Rifle'].map(n =>
      screen.getByText(n).closest('[role="row"]')
    )
    const order = screen.getAllByRole('row').filter(r => r.getAttribute('data-selected') !== null)
    // Desc DPS Base: 500, 350, 200 → Bravo, Charlie, Alpha
    expect(order[0]).toBe(names[1])
    expect(order[1]).toBe(names[2])
    expect(order[2]).toBe(names[0])
  })
})
