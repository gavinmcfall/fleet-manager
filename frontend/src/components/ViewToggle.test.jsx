import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewToggle from './ViewToggle'

describe('ViewToggle', () => {
  it('renders two buttons', () => {
    render(<ViewToggle value="grid" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument()
  })

  it('marks the active button with aria-pressed', () => {
    render(<ViewToggle value="list" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /list view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /grid view/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked value', async () => {
    const onChange = vi.fn()
    render(<ViewToggle value="grid" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /list view/i }))
    expect(onChange).toHaveBeenCalledWith('list')
  })
})
