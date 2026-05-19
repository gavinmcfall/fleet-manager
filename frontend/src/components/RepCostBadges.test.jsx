/**
 * PART K K11: vitest for <RepCostBadges> + parseLegacyRepSummary.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RepCostBadges, parseLegacyRepSummary } from './RepCostBadges'

describe('parseLegacyRepSummary', () => {
  it('returns empty array for null/empty', () => {
    expect(parseLegacyRepSummary(null, 'fail')).toEqual([])
    expect(parseLegacyRepSummary('', 'fail')).toEqual([])
  })

  it('parses single entry', () => {
    expect(parseLegacyRepSummary('security: -XXS', 'fail')).toEqual([
      { scope_slug: 'security', event: 'fail', size_code: 'XXS', direction: 'negative', rep_amount: null },
    ])
  })

  it('parses multi-scope with comma separator', () => {
    const rows = parseLegacyRepSummary('security: -M, affinity: -S', 'abandon')
    expect(rows).toHaveLength(2)
    expect(rows[0].scope_slug).toBe('security')
    expect(rows[1].scope_slug).toBe('affinity')
    expect(rows.every(r => r.event === 'abandon')).toBe(true)
  })

  it('parses positive direction', () => {
    expect(parseLegacyRepSummary('security: +L', 'fail')[0].direction).toBe('positive')
  })
})

describe('RepCostBadges', () => {
  it('returns null when no changes and no summaries', () => {
    const { container } = render(<RepCostBadges changes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders structured changes grouped by event', () => {
    const changes = [
      { scope_slug: 'security', event: 'fail', size_code: 'M', direction: 'negative', rep_amount: -50 },
      { scope_slug: 'affinity', event: 'fail', size_code: 'S', direction: 'negative', rep_amount: -25 },
      { scope_slug: 'security', event: 'abandon', size_code: 'S', direction: 'negative', rep_amount: -10 },
    ]
    render(<RepCostBadges changes={changes} />)
    expect(screen.getByText('fail:')).toBeInTheDocument()
    expect(screen.getByText('abandon:')).toBeInTheDocument()
    // Three scope chips total
    expect(screen.getByText(/security −M/)).toBeInTheDocument()
    expect(screen.getByText(/affinity −S/)).toBeInTheDocument()
    expect(screen.getByText(/security −S/)).toBeInTheDocument()
  })

  it('shows rep_amount in the tooltip when present', () => {
    const changes = [
      { scope_slug: 'security', event: 'fail', size_code: 'M', direction: 'negative', rep_amount: -50 },
    ]
    render(<RepCostBadges changes={changes} />)
    expect(screen.getByTitle(/-50 rep/)).toBeInTheDocument()
  })

  it('omits the rep number from tooltip when null', () => {
    const changes = [
      { scope_slug: 'security', event: 'fail', size_code: 'XXXL', direction: 'negative', rep_amount: null },
    ]
    render(<RepCostBadges changes={changes} />)
    const badge = screen.getByTitle(/security: −XXXL/)
    expect(badge.getAttribute('title')).not.toMatch(/rep/)
  })

  it('falls back to parsing legacy summary strings when changes is empty', () => {
    render(
      <RepCostBadges
        changes={[]}
        repFailSummary="security: -M"
        repAbandonSummary="security: -S, affinity: -XXS"
      />
    )
    expect(screen.getByText('fail:')).toBeInTheDocument()
    expect(screen.getByText('abandon:')).toBeInTheDocument()
    expect(screen.getByText(/security −M/)).toBeInTheDocument()
    expect(screen.getByText(/security −S/)).toBeInTheDocument()
    expect(screen.getByText(/affinity −XXS/)).toBeInTheDocument()
  })

  it('prefers structured changes over legacy strings when both present', () => {
    render(
      <RepCostBadges
        changes={[
          { scope_slug: 'security', event: 'fail', size_code: 'L', direction: 'negative', rep_amount: -100 },
        ]}
        repFailSummary="should: -BE_IGNORED"
      />
    )
    expect(screen.getByText(/security −L/)).toBeInTheDocument()
    expect(screen.queryByText(/should/)).toBeNull()
  })

  it('renders positive direction with green styling marker', () => {
    const changes = [
      { scope_slug: 'security', event: 'success', size_code: 'XS', direction: 'positive', rep_amount: 10 },
    ]
    render(<RepCostBadges changes={changes} />)
    const badge = screen.getByTitle(/security: \+XS/)
    expect(badge.className).toMatch(/emerald/)
  })
})
