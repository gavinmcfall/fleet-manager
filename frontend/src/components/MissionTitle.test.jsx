/**
 * PART K K14: vitest for <MissionTitle> + <TemplateVar>.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MissionTitle, TemplateVar } from './MissionTitle'

describe('TemplateVar', () => {
  it('renders the variable name', () => {
    render(<TemplateVar name="Creature" />)
    expect(screen.getByText('Creature')).toBeInTheDocument()
  })

  it('shows a generic tooltip when no pool is provided', () => {
    render(<TemplateVar name="Creature" />)
    expect(screen.getByTitle(/Template variable/)).toBeInTheDocument()
  })

  it('lists pool values in the tooltip when provided', () => {
    render(<TemplateVar name="Creature" pool={['kopion', 'marok']} />)
    expect(screen.getByTitle(/kopion, marok/)).toBeInTheDocument()
  })
})

describe('MissionTitle', () => {
  it('returns null for empty/null titles', () => {
    const { container: c1 } = render(<MissionTitle title={null} />)
    expect(c1.firstChild).toBeNull()
    const { container: c2 } = render(<MissionTitle title="" />)
    expect(c2.firstChild).toBeNull()
  })

  it('passes plain titles through unchanged', () => {
    render(<MissionTitle title="Plain mission title" />)
    expect(screen.getByText('Plain mission title')).toBeInTheDocument()
  })

  it('renders <var name="X"/> as a TemplateVar chip (post-extract form)', () => {
    render(<MissionTitle title='Wildlife Control: <var name="Creature"/>' />)
    // The chip body is the variable name; surrounding plain text stays
    expect(screen.getByText('Creature')).toBeInTheDocument()
    expect(screen.getByText(/Wildlife Control:/)).toBeInTheDocument()
  })

  it('renders legacy {X} as a TemplateVar chip (pre-extract form, staging fallback)', () => {
    render(<MissionTitle title="Wildlife Control: {Creature}" />)
    expect(screen.getByText('Creature')).toBeInTheDocument()
  })

  it('renders multiple variables in order', () => {
    render(<MissionTitle title='<var name="Title"/> for <var name="Target"/>' />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Target')).toBeInTheDocument()
    expect(screen.getByText(/for/)).toBeInTheDocument()
  })

  it('mixes new and legacy forms in the same title', () => {
    render(<MissionTitle title='<var name="A"/> and {B}' />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('threads pool values through to the chip tooltip', () => {
    render(<MissionTitle
      title='Hunt the <var name="Creature"/>'
      pools={{ Creature: ['kopion', 'marok', 'gimbel'] }}
    />)
    expect(screen.getByTitle(/kopion, marok, gimbel/)).toBeInTheDocument()
  })

  it('survives multiple consecutive vars without literal text between', () => {
    render(<MissionTitle title='<var name="A"/><var name="B"/>' />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('handles non-string titles defensively', () => {
    render(<MissionTitle title={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('handles the regex test() lastIndex mutation correctly when called twice', () => {
    // Regression: TAG_RE is a global regex. test() mutates lastIndex; without
    // a reset the second call against the same input misses on subsequent renders.
    const title = 'Hunt the {Creature}'
    const { rerender } = render(<MissionTitle title={title} />)
    expect(screen.getByText('Creature')).toBeInTheDocument()
    rerender(<MissionTitle title={title} />)
    expect(screen.getByText('Creature')).toBeInTheDocument()
  })
})
