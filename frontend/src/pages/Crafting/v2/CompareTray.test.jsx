import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompareTray from './CompareTray'

const BP1 = { id: 1, type: 'weapons', name: 'P8-AR', base_stats: { item_name: 'Behring P8-AR' } }
const BP2 = { id: 2, type: 'weapons', name: 'TB-12', base_stats: { item_name: 'Kastak TB-12' } }

describe('CompareTray', () => {
  it('renders nothing when the items list is empty', () => {
    const { container } = render(<CompareTray items={[]} onRemove={() => {}} onClear={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a chip per item with the item name', () => {
    render(<CompareTray items={[BP1, BP2]} onRemove={() => {}} onClear={() => {}} />)
    expect(screen.getByText('Behring P8-AR')).toBeInTheDocument()
    expect(screen.getByText('Kastak TB-12')).toBeInTheDocument()
  })

  it('shows the count in "X of 3" format', () => {
    render(<CompareTray items={[BP1]} onRemove={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/1\s*\/\s*3/i)).toBeInTheDocument()
  })

  it('calls onRemove with the blueprint when a chip × is clicked', async () => {
    const onRemove = vi.fn()
    render(<CompareTray items={[BP1, BP2]} onRemove={onRemove} onClear={() => {}} />)
    const removes = screen.getAllByRole('button', { name: /remove/i })
    await userEvent.click(removes[0])
    expect(onRemove).toHaveBeenCalledWith(BP1)
  })

  it('calls onClear when Clear button is clicked', async () => {
    const onClear = vi.fn()
    render(<CompareTray items={[BP1, BP2]} onRemove={() => {}} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onClear).toHaveBeenCalled()
  })
})
