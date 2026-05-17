import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StorageBreakdown from './StorageBreakdown'

describe('StorageBreakdown', () => {
  it('renders nothing when no summary and no detail', () => {
    const { container } = render(<StorageBreakdown storage={[]} summary={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when summary fields are all zero', () => {
    const { container } = render(
      <StorageBreakdown
        storage={[]}
        summary={{ internal_cargo_scu: 0, external_cargo_scu: 0, fuel_cargo_scu: 0, locker_count: 0 }}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the interior tile when only internal_cargo_scu is set', () => {
    render(<StorageBreakdown storage={[]} summary={{ internal_cargo_scu: 48 }} />)
    expect(screen.getByText(/Interior Cargo/i)).toBeInTheDocument()
    expect(screen.getByText('48 SCU')).toBeInTheDocument()
    expect(screen.queryByText(/External Pods/i)).not.toBeInTheDocument()
  })

  it('renders external + interior tiles for Hull B shape', () => {
    render(
      <StorageBreakdown
        storage={[]}
        summary={{ internal_cargo_scu: 32, external_cargo_scu: 512 }}
      />,
    )
    expect(screen.getByText('32 SCU')).toBeInTheDocument()
    expect(screen.getByText('512 SCU')).toBeInTheDocument()
  })

  it('renders fuel cargo tile for refueler ships', () => {
    render(
      <StorageBreakdown
        storage={[]}
        summary={{ fuel_cargo_scu: 300.22 }}
      />,
    )
    expect(screen.getByText(/Refuel Cargo/i)).toBeInTheDocument()
    expect(screen.getByText('300.22 SCU')).toBeInTheDocument()
  })

  it('renders suit locker count when > 0', () => {
    render(<StorageBreakdown storage={[]} summary={{ locker_count: 4 }} />)
    expect(screen.getByText(/Suit Lockers/i)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders the detail list with count multiplier and total', () => {
    const storage = [
      {
        id: 1,
        storage_type: 'external_pod',
        container_class_name: 'MISC_Hull_B_CargoGrid',
        scu_capacity: 32,
        count: 16,
        location_label: 'external pods',
      },
    ]
    render(<StorageBreakdown storage={storage} summary={{ external_cargo_scu: 512 }} />)
    expect(screen.getByText(/Storage detail \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/× 16/)).toBeInTheDocument()
    expect(screen.getByText(/= 512 SCU/)).toBeInTheDocument()
  })

  it('orders detail rows: internal_grid → external_pod → fuel_cargo → personal_locker → suit_locker → weapon_rack', () => {
    const storage = [
      { id: 1, storage_type: 'weapon_rack', count: 2, container_class_name: 'wr' },
      { id: 2, storage_type: 'external_pod', scu_capacity: 32, count: 1, container_class_name: 'ext' },
      { id: 3, storage_type: 'internal_grid', scu_capacity: 16, count: 1, container_class_name: 'int' },
    ]
    render(<StorageBreakdown storage={storage} summary={{ internal_cargo_scu: 16, external_cargo_scu: 32 }} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toMatch(/Interior Grid/)
    expect(items[1].textContent).toMatch(/External Pod/)
    expect(items[2].textContent).toMatch(/Weapon Rack/)
  })

  it('formats microSCU for personal_locker', () => {
    const storage = [
      { id: 1, storage_type: 'personal_locker', microscu_capacity: 0.5, count: 1, container_class_name: 'locker' },
    ]
    render(<StorageBreakdown storage={storage} summary={{ personal_grid_microscu: 0.5 }} />)
    expect(screen.getByText(/Personal Grid/)).toBeInTheDocument()
    expect(screen.getAllByText(/0\.5 µSCU/).length).toBeGreaterThan(0)
  })

  it('renders summary without detail when storage is empty', () => {
    render(
      <StorageBreakdown
        storage={[]}
        summary={{ internal_cargo_scu: 100 }}
      />,
    )
    expect(screen.getByText('100 SCU')).toBeInTheDocument()
    expect(screen.queryByText(/Storage detail/)).not.toBeInTheDocument()
  })
})
