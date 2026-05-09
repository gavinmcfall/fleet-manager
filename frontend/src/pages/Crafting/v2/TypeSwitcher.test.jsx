import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TypeSwitcher from './TypeSwitcher'

describe('TypeSwitcher', () => {
  it('renders all five type pills', () => {
    render(<TypeSwitcher activeType="fps_weapon" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /fps weapons/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fps armour/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ammo$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ship weapons/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ship components/i })).toBeInTheDocument()
  })

  it('marks the active pill via aria-pressed', () => {
    render(<TypeSwitcher activeType="fps_armour" onChange={() => {}} />)
    const armour = screen.getByRole('button', { name: /fps armour/i })
    const weapons = screen.getByRole('button', { name: /fps weapons/i })
    expect(armour).toHaveAttribute('aria-pressed', 'true')
    expect(weapons).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked category key', async () => {
    const onChange = vi.fn()
    render(<TypeSwitcher activeType="fps_weapon" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /ship weapons/i }))
    expect(onChange).toHaveBeenCalledWith('ship_weapon')
  })

  it('does not call onChange when clicking the already-active pill', async () => {
    const onChange = vi.fn()
    render(<TypeSwitcher activeType="fps_weapon" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /fps weapons/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
