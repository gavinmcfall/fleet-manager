import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

import QuantumHud from './themes/QuantumHud'

const MOCK = {
  totalValue: 7235,
  ships: 20,
  cargo: 5155,
  minCrew: 35,
  maxCrew: 35,
  ltiCount: 7,
  flightReady: 17,
  sizeDistribution: { Small: 5, Medium: 5, Large: 6, Capital: 2, Vehicle: 1, Unknown: 1 },
  roleCategories: { Combat: 5, Cargo: 5, Exploration: 2, Mining: 2, Salvage: 2, Industrial: 1, Touring: 1, Capital: 1, Unknown: 1 },
}

function PreviewBar() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '6px 16px',
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0, 212, 255, 0.12)',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 11,
    }}>
      <span style={{ color: '#00d4ff', fontWeight: 600, letterSpacing: '0.08em' }}>
        QUANTUM HUD PREVIEW
      </span>
      <span style={{ color: '#333' }}>|</span>
      <Link
        to="/"
        style={{
          color: '#666',
          textDecoration: 'none',
          transition: 'color 0.15s',
        }}
      >
        Back to current design
      </Link>
    </div>
  )
}

export default function DesignPreview() {
  useEffect(() => {
    const linkId = 'design-preview-inter'
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
      document.head.appendChild(link)
    }
    return () => {
      const el = document.getElementById(linkId)
      if (el) el.remove()
    }
  }, [])

  return (
    <>
      <PreviewBar />
      <QuantumHud mock={MOCK} />
    </>
  )
}
