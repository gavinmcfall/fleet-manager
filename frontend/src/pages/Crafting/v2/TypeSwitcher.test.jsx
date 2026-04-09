import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TypeSwitcher from './TypeSwitcher'

describe('TypeSwitcher', () => {
  it('renders three type pills', () => {
    render(<TypeSwitcher activeType="weapons" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /weapons/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /armour/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ammo/i })).toBeInTheDocument()
  })

  it('marks the active pill via aria-pressed', () => {
    render(<TypeSwitcher activeType="armour" onChange={() => {}} />)
    const armour = screen.getByRole('button', { name: /armour/i })
    const weapons = screen.getByRole('button', { name: /weapons/i })
    expect(armour).toHaveAttribute('aria-pressed', 'true')
    expect(weapons).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked type', async () => {
    const onChange = vi.fn()
    render(<TypeSwitcher activeType="weapons" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /ammo/i }))
    expect(onChange).toHaveBeenCalledWith('ammo')
  })

  it('does not call onChange when clicking the already-active pill', async () => {
    const onChange = vi.fn()
    render(<TypeSwitcher activeType="weapons" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /weapons/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
