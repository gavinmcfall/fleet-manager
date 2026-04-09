import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlueprintCard from './BlueprintCard'

const WEAPON_BP = {
  id: 1,
  type: 'weapons',
  sub_type: 'rifle',
  name: 'Behring P8-AR',
  craft_time_seconds: 270, // 4:30
  slots: [
    { resource_name: 'Beryl' },
    { resource_name: 'Tin' },
    { resource_name: 'Iron' },
  ],
  base_stats: {
    item_name: 'Behring P8-AR Battle Rifle',
    dps: 412,
    dps_max: 618,
    rounds_per_minute: 650,
    rounds_per_minute_max: 780,
    range_m: 35,
    range_m_max: 52,
  },
}

describe('BlueprintCard', () => {
  it('renders the blueprint name from base_stats.item_name', () => {
    render(<BlueprintCard blueprint={WEAPON_BP} />)
    expect(screen.getByText('Behring P8-AR Battle Rifle')).toBeInTheDocument()
  })

  it('falls back to blueprint.name when item_name is missing', () => {
    const bp = { ...WEAPON_BP, base_stats: { ...WEAPON_BP.base_stats, item_name: null } }
    render(<BlueprintCard blueprint={bp} />)
    expect(screen.getByText('Behring P8-AR')).toBeInTheDocument()
  })

  it('renders all three weapon stats with base → max ranges', () => {
    render(<BlueprintCard blueprint={WEAPON_BP} />)
    // base values
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('650')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    // max values
    expect(screen.getByText('618')).toBeInTheDocument()
    expect(screen.getByText('780')).toBeInTheDocument()
    expect(screen.getByText('52')).toBeInTheDocument()
  })

  it('renders the type and sub-type labels', () => {
    render(<BlueprintCard blueprint={WEAPON_BP} />)
    expect(screen.getByText(/Weapon/i)).toBeInTheDocument()
    expect(screen.getByText(/Rifle/i)).toBeInTheDocument()
  })

  it('invokes the fav, sim, and compare callbacks when buttons are clicked', async () => {
    const onFav = vi.fn()
    const onSim = vi.fn()
    const onCompare = vi.fn()
    render(
      <BlueprintCard
        blueprint={WEAPON_BP}
        onFavorite={onFav}
        onQualitySim={onSim}
        onCompare={onCompare}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /favorite/i }))
    await userEvent.click(screen.getByRole('button', { name: /sim/i }))
    await userEvent.click(screen.getByRole('button', { name: /compare/i }))
    expect(onFav).toHaveBeenCalledWith(WEAPON_BP)
    expect(onSim).toHaveBeenCalledWith(WEAPON_BP)
    expect(onCompare).toHaveBeenCalledWith(WEAPON_BP)
  })

  it('marks the card as selected when isInCompare is true', () => {
    render(<BlueprintCard blueprint={WEAPON_BP} isInCompare={true} />)
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('data-selected', 'true')
  })
})
