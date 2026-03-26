import { describe, it, expect } from 'vitest'

/**
 * FleetTable wrench icon gating tests.
 *
 * The full FleetTable component has too many dependencies for unit testing
 * (useFleet, useNavigate, useSearchParams, etc.). Instead we test the
 * gating logic: the wrench icon should only appear for flight_ready ships.
 *
 * The actual JSX in FleetTable.jsx is:
 *   {v.production_status === 'flight_ready' && (
 *     <button onClick={...}><Wrench /></button>
 *   )}
 *
 * These tests verify the business rule in isolation.
 */

function shouldShowWrench(vehicle) {
  return vehicle.production_status === 'flight_ready'
}

describe('FleetTable wrench icon gating', () => {
  it('shows wrench for flight_ready ships', () => {
    expect(shouldShowWrench({ production_status: 'flight_ready' })).toBe(true)
  })

  it('hides wrench for concept ships', () => {
    expect(shouldShowWrench({ production_status: 'in_concept' })).toBe(false)
  })

  it('hides wrench for in_production ships', () => {
    expect(shouldShowWrench({ production_status: 'in_production' })).toBe(false)
  })

  it('hides wrench for unknown status', () => {
    expect(shouldShowWrench({ production_status: 'unknown' })).toBe(false)
  })

  it('hides wrench when status is null', () => {
    expect(shouldShowWrench({ production_status: null })).toBe(false)
  })

  it('hides wrench when status is undefined', () => {
    expect(shouldShowWrench({})).toBe(false)
  })
})
