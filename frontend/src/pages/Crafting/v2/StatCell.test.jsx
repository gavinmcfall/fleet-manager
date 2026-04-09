import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCell from './StatCell'

describe('StatCell', () => {
  it('renders label, base, max, and unit', () => {
    render(<StatCell label="DPS" base={412} max={618} unit="dmg/s" />)
    expect(screen.getByText('DPS')).toBeInTheDocument()
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('618')).toBeInTheDocument()
    expect(screen.getByText('dmg/s')).toBeInTheDocument()
    expect(screen.getByText('→')).toBeInTheDocument()
  })

  it('omits the unit span when unit is empty', () => {
    render(<StatCell label="DMG" base={45} max={67} unit="" />)
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('67')).toBeInTheDocument()
    expect(screen.queryByText('dmg/s')).not.toBeInTheDocument()
  })

  it('renders a dash placeholder when base or max is null', () => {
    render(<StatCell label="RPM" base={null} max={null} unit="rpm" />)
    expect(screen.getByText('RPM')).toBeInTheDocument()
    // Two dashes = base and max both missing
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(2)
  })

  it('shows only the base value when max equals base (no arrow)', () => {
    render(<StatCell label="RPM" base={650} max={650} unit="rpm" />)
    expect(screen.getByText('650')).toBeInTheDocument()
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })
})
