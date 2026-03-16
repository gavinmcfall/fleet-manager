import React, { useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

import IndustrialFrontier from './themes/IndustrialFrontier'
import QuantumHud from './themes/QuantumHud'
import CleanProfessional from './themes/CleanProfessional'

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

const THEMES = [
  { slug: 'industrial-frontier', name: 'Industrial Frontier', Component: IndustrialFrontier, accent: '#ffb000' },
  { slug: 'quantum-hud', name: 'Quantum HUD', Component: QuantumHud, accent: '#00d4ff' },
  { slug: 'clean-professional', name: 'Clean Professional', Component: CleanProfessional, accent: '#1a5c6b' },
]

const THEME_MAP = Object.fromEntries(THEMES.map(t => [t.slug, t]))

function ThemeSwitcher({ activeSlug }) {
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
      gap: '2px',
      padding: '6px 16px',
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <Link
        to="/"
        style={{
          padding: '5px 14px',
          borderRadius: '3px',
          fontSize: '11px',
          fontWeight: 500,
          fontFamily: "'Inter', system-ui, sans-serif",
          color: '#666',
          textDecoration: 'none',
          transition: 'all 0.15s',
          letterSpacing: '0.02em',
        }}
      >
        Current Design
      </Link>
      {THEMES.map(t => {
        const isActive = t.slug === activeSlug
        return (
          <Link
            key={t.slug}
            to={`/?design=${t.slug}`}
            style={{
              padding: '5px 14px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              fontFamily: "'Inter', system-ui, sans-serif",
              color: isActive ? '#fff' : '#666',
              background: isActive ? `${t.accent}25` : 'transparent',
              border: isActive ? `1px solid ${t.accent}40` : '1px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              letterSpacing: '0.02em',
            }}
          >
            {t.name}
          </Link>
        )
      })}
    </div>
  )
}

export default function DesignPreview() {
  const [searchParams] = useSearchParams()
  const designSlug = searchParams.get('design')
  const theme = THEME_MAP[designSlug]

  // Inject Google Fonts for Inter (switcher bar)
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

  if (!theme) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111',
        color: '#888',
        fontFamily: 'system-ui',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>Unknown theme: {designSlug}</p>
          <p style={{ fontSize: 13 }}>
            Try:{' '}
            {THEMES.map((t, i) => (
              <span key={t.slug}>
                {i > 0 && ', '}
                <Link to={`/?design=${t.slug}`} style={{ color: '#3b9dad' }}>{t.slug}</Link>
              </span>
            ))}
          </p>
        </div>
      </div>
    )
  }

  const { Component } = theme

  return (
    <>
      <ThemeSwitcher activeSlug={designSlug} />
      <Component mock={MOCK} />
    </>
  )
}
