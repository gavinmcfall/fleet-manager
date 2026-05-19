/**
 * PART K K12: vitest for <RewardSummary>.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RewardSummary } from './RewardSummary'

describe('RewardSummary', () => {
  it('returns null for missing mission', () => {
    const { container } = render(<RewardSummary mission={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when reward is missing/zero and not dynamic', () => {
    const { container } = render(<RewardSummary mission={{ reward_amount: 0, is_dynamic_reward: 0 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders flat UEC amount', () => {
    render(<RewardSummary mission={{ reward_amount: 4000, reward_currency: 'UEC', is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/4,000 UEC/)).toBeInTheDocument()
  })

  it('renders range when reward_max > reward_amount', () => {
    render(<RewardSummary mission={{ reward_amount: 2000, reward_max: 7500, reward_currency: 'MER', is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/2,000–7,500 MER/)).toBeInTheDocument()
  })

  it('renders flat amount when reward_max === reward_amount', () => {
    render(<RewardSummary mission={{ reward_amount: 50000, reward_max: 50000, reward_currency: 'UEC', is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/50,000 UEC/)).toBeInTheDocument()
    expect(screen.queryByText(/–/)).toBeNull()
  })

  it('renders Dynamic when is_dynamic_reward=1 regardless of amount', () => {
    render(<RewardSummary mission={{ reward_amount: 0, is_dynamic_reward: 1 }} />)
    expect(screen.getByText('Dynamic')).toBeInTheDocument()
  })

  it('defaults to UEC when reward_currency is missing', () => {
    render(<RewardSummary mission={{ reward_amount: 100, is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/100 UEC/)).toBeInTheDocument()
  })

  it('renders MER currency for Klescher prison missions', () => {
    render(<RewardSummary mission={{ reward_amount: 2000, reward_max: 5000, reward_currency: 'MER', is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/2,000–5,000 MER/)).toBeInTheDocument()
  })

  it('thousands separator works at large amounts', () => {
    render(<RewardSummary mission={{ reward_amount: 1234567, reward_currency: 'UEC', is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/1,234,567 UEC/)).toBeInTheDocument()
  })

  it('always prefixes with the Reward: label', () => {
    render(<RewardSummary mission={{ reward_amount: 100, is_dynamic_reward: 0 }} />)
    expect(screen.getByText(/Reward:/)).toBeInTheDocument()
  })
})
