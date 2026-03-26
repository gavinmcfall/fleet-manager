import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LockedPort from './LockedPort'


describe('LockedPort', () => {
  it('shows component_name when available', () => {
    render(<LockedPort item={{ child_name: null, component_name: 'FullStop', mount_name: null, port_name: 'hardpoint_shield', component_size: 2, size_max: 2 }} />)
    expect(screen.getByText('FullStop')).toBeInTheDocument()
  })

  it('shows child_name over component_name', () => {
    render(<LockedPort item={{ child_name: 'CF-447 Rhino', component_name: 'Manned Turret', mount_name: null, port_name: 'hardpoint_turret', component_size: 4, size_max: 4 }} />)
    expect(screen.getByText('CF-447 Rhino')).toBeInTheDocument()
  })

  it('shows mount_name as fallback', () => {
    render(<LockedPort item={{ child_name: null, component_name: null, mount_name: 'Mounted Gatling S1', port_name: 'weapon', component_size: 1, size_max: 1 }} />)
    expect(screen.getByText('Mounted Gatling S1')).toBeInTheDocument()
  })

  it('shows humanized port_name when all names are null', () => {
    render(<LockedPort item={{ child_name: null, component_name: null, mount_name: null, port_name: 'hardpoint_pdc_aimodule_top_left', component_size: null, size_max: 2 }} />)
    // humanizePortName strips "hardpoint_", replaces underscores, title-cases
    expect(screen.getByText('Pdc Aimodule Top Left')).toBeInTheDocument()
  })

  it('shows "Locked" when port_name is also null', () => {
    render(<LockedPort item={{ child_name: null, component_name: null, mount_name: null, port_name: null, component_size: null, size_max: 0 }} />)
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('shows lock icon', () => {
    render(<LockedPort item={{ child_name: null, component_name: 'Test', mount_name: null, port_name: 'test', component_size: 2, size_max: 2 }} />)
    expect(screen.getByText('locked')).toBeInTheDocument()
  })

  it('shows size badge', () => {
    render(<LockedPort item={{ child_name: null, component_name: 'Test', mount_name: null, port_name: 'test', component_size: 3, size_max: 3 }} />)
    expect(screen.getByText('S3')).toBeInTheDocument()
  })

  it('shows manufacturer when available', () => {
    render(<LockedPort item={{ child_name: null, component_name: 'Test', mount_name: null, port_name: 'test', component_size: 2, size_max: 2, manufacturer_name: 'Klaus & Werner' }} />)
    expect(screen.getByText('Klaus & Werner')).toBeInTheDocument()
  })
})
