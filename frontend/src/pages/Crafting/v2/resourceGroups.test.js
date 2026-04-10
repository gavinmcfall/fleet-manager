import { describe, it, expect } from 'vitest'
import { getResourceColor, getResourceGroup, RESOURCE_GROUPS } from './resourceGroups'

describe('resourceGroups', () => {
  it('maps all 22 known resources to a group', () => {
    const ALL_RESOURCES = [
      'Agricium', 'Aluminum', 'Aslarite', 'Beryl', 'Copper', 'Corundum',
      'Gold', 'Hephaestanite', 'Iron', 'Laranite', 'Lindinium', 'Ouratite',
      'Quartz', 'Riccite', 'Savrilium', 'Silicon', 'Stileron', 'Taranite',
      'Tin', 'Titanium', 'Torite', 'Tungsten',
    ]
    for (const name of ALL_RESOURCES) {
      expect(getResourceGroup(name), `${name} should have a group`).toBeTruthy()
      expect(getResourceColor(name), `${name} should have a color`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('returns the correct group for representative resources', () => {
    expect(getResourceGroup('Iron')).toBe('base')
    expect(getResourceGroup('Titanium')).toBe('industrial')
    expect(getResourceGroup('Gold')).toBe('precious')
    expect(getResourceGroup('Riccite')).toBe('rare')
    expect(getResourceGroup('Lindinium')).toBe('exotic')
  })

  it('returns the approved bucket colors', () => {
    expect(getResourceColor('Aluminum')).toBe('#6b7280')   // steel grey — base
    expect(getResourceColor('Tungsten')).toBe('#f5a623')    // bronze/amber — industrial
    expect(getResourceColor('Agricium')).toBe('#fbbf24')    // gold — precious
    expect(getResourceColor('Stileron')).toBe('#2ec4b6')    // teal — rare
    expect(getResourceColor('Aslarite')).toBe('#a78bfa')    // violet — exotic
  })

  it('is case-insensitive for lookups', () => {
    expect(getResourceColor('iron')).toBe(getResourceColor('Iron'))
    expect(getResourceColor('GOLD')).toBe(getResourceColor('Gold'))
    expect(getResourceGroup('beryl')).toBe(getResourceGroup('Beryl'))
  })

  it('returns a fallback color for unknown resources', () => {
    expect(getResourceColor('UnknownMineral')).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(getResourceGroup('UnknownMineral')).toBe('unknown')
  })

  it('exports RESOURCE_GROUPS with 5 named buckets', () => {
    expect(Object.keys(RESOURCE_GROUPS)).toHaveLength(5)
    expect(Object.keys(RESOURCE_GROUPS)).toEqual(
      expect.arrayContaining(['base', 'industrial', 'precious', 'rare', 'exotic'])
    )
  })
})
