import React, { useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts'
import { BarChart3, Rocket, Shield, Search, MapPin, FileText, ShoppingCart, Hammer, Users, Package, Database, Settings, Upload, DollarSign, Activity, Crosshair, BookOpen, Star, Scale, Briefcase, TrendingUp, Palette } from 'lucide-react'

import * as industrial from './themes/industrialFrontier'
import * as quantum from './themes/quantumHud'
import * as clean from './themes/cleanProfessional'

const THEMES = {
  'industrial-frontier': industrial,
  'quantum-hud': quantum,
  'clean-professional': clean,
}

const ALL_THEMES = [industrial, quantum, clean]

// Realistic mock data from user's actual fleet
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

const sizeData = Object.entries(MOCK.sizeDistribution).map(([name, value]) => ({ name, value }))
const roleData = Object.entries(MOCK.roleCategories).map(([name, count]) => ({ name, count }))
const ltiPercent = Math.round((MOCK.ltiCount / MOCK.ships) * 100)
const readyPercent = Math.round((MOCK.flightReady / MOCK.ships) * 100)

const SIDEBAR_NAV = [
  { icon: BarChart3, label: 'Dashboard', active: true },
  {
    group: 'Game Data', icon: Crosshair, items: [
      { icon: Search, label: 'Item Finder' },
      { icon: MapPin, label: 'Locations' },
      { icon: FileText, label: 'Missions' },
      { icon: ShoppingCart, label: 'Shops' },
      { icon: TrendingUp, label: 'Trade' },
      { icon: Hammer, label: 'Mining Guide' },
      { icon: Users, label: 'NPC Loadouts' },
    ]
  },
  {
    group: 'My Fleet', icon: Rocket, items: [
      { icon: Rocket, label: 'Fleet' },
      { icon: Shield, label: 'Insurance' },
      { icon: Activity, label: 'Analysis' },
      { icon: Upload, label: 'Import' },
    ]
  },
  {
    group: 'Reference', icon: BookOpen, items: [
      { icon: Database, label: 'Ship DB' },
      { icon: Palette, label: 'Paints' },
      { icon: Briefcase, label: 'Careers & Roles' },
      { icon: Star, label: 'Reputation' },
      { icon: Scale, label: 'Law System' },
    ]
  },
  { icon: Settings, label: 'Settings' },
]

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
      gap: '4px',
      padding: '8px 16px',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <Link
        to="/"
        style={{
          padding: '6px 14px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          color: !activeSlug ? '#fff' : '#888',
          background: !activeSlug ? 'rgba(255,255,255,0.12)' : 'transparent',
          textDecoration: 'none',
          transition: 'all 0.15s',
        }}
      >
        Current Design
      </Link>
      {ALL_THEMES.map(t => {
        const isActive = t.meta.slug === activeSlug
        return (
          <Link
            key={t.meta.slug}
            to={`/?design=${t.meta.slug}`}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
              color: isActive ? '#fff' : '#888',
              background: isActive ? t.colors.accent + '30' : 'transparent',
              border: isActive ? `1px solid ${t.colors.accent}50` : '1px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.meta.name}
          </Link>
        )
      })}
    </div>
  )
}

function MockSidebar({ theme }) {
  const { colors, fonts, shape } = theme
  const [expanded, setExpanded] = React.useState('Game Data')

  return (
    <div style={{
      width: 220,
      minHeight: '100vh',
      background: colors.sidebar,
      borderRight: colors.sidebarBorder !== 'transparent' ? `1px solid ${colors.sidebarBorder}` : 'none',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      fontFamily: fonts.body,
    }}>
      {/* Brand */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: colors.sidebarBorder !== 'transparent' ? `1px solid ${colors.sidebarBorder}` : `1px solid rgba(255,255,255,0.04)`,
      }}>
        <div style={{
          fontFamily: fonts.heading,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: '0.1em',
          color: colors.accent,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Rocket style={{ width: 18, height: 18 }} />
          SC BRIDGE
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: fonts.mono,
          color: colors.textDim,
          marginTop: 4,
          letterSpacing: '0.15em',
        }}>
          STAR CITIZEN COMPANION
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: fonts.mono,
          color: colors.textDim,
          marginTop: 2,
        }}>
          4.0.2-LIVE
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
        {SIDEBAR_NAV.map((item, i) => {
          if (item.group) {
            const GroupIcon = item.icon
            const isOpen = expanded === item.group
            return (
              <div key={item.group} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : item.group)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: shape.borderRadius,
                    border: 'none',
                    background: 'transparent',
                    color: colors.textMuted,
                    fontSize: 10,
                    fontFamily: fonts.heading,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <GroupIcon style={{ width: 14, height: 14 }} />
                  <span style={{ flex: 1 }}>{item.group}</span>
                  <span style={{ fontSize: 8 }}>{isOpen ? '\u25BC' : '\u25B6'}</span>
                </button>
                {isOpen && (
                  <div style={{
                    marginLeft: 14,
                    paddingLeft: 10,
                    borderLeft: `1px solid ${colors.border !== 'transparent' ? colors.border : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    {item.items.map(sub => {
                      const SubIcon = sub.icon
                      return (
                        <div
                          key={sub.label}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: shape.borderRadius,
                            color: colors.textMuted,
                            fontSize: 11,
                            fontFamily: fonts.body,
                            cursor: 'default',
                          }}
                        >
                          <SubIcon style={{ width: 13, height: 13 }} />
                          {sub.label}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const Icon = item.icon
          const isActive = item.active
          return (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: shape.borderRadius,
                background: isActive ? colors.accentMuted : 'transparent',
                color: isActive ? colors.accent : colors.textMuted,
                fontSize: 11,
                fontFamily: fonts.heading,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'default',
                borderLeft: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {item.label}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 14px',
        borderTop: colors.sidebarBorder !== 'transparent' ? `1px solid ${colors.sidebarBorder}` : `1px solid rgba(255,255,255,0.04)`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 4px',
        }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: colors.accentMuted,
            border: `1px solid ${colors.border !== 'transparent' ? colors.border : 'rgba(255,255,255,0.06)'}`,
          }} />
          <span style={{ fontSize: 11, color: colors.textMuted }}>NZVengeance</span>
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: fonts.mono,
          color: colors.textDim,
          textAlign: 'center',
          marginTop: 6,
          letterSpacing: '0.1em',
        }}>
          v2.0.0
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, theme, delay = 0, span = 1, children }) {
  const { colors, fonts, shape } = theme
  const isHero = span === 2

  const panelStyle = {
    background: colors.panel,
    borderRadius: shape.borderRadius,
    clipPath: isHero ? shape.heroClipPath : shape.panelClipPath,
    border: colors.border !== 'transparent' ? `1px solid ${colors.border}` : 'none',
    padding: isHero ? '24px' : '18px',
    gridColumn: isHero ? 'span 2' : 'span 1',
    position: 'relative',
    overflow: 'hidden',
  }

  return (
    <div style={panelStyle} className={theme === quantum ? 'hud-bracket' : ''}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <Icon style={{ width: 14, height: 14, color: colors.accent }} />
        <span style={{
          fontSize: 10,
          fontFamily: fonts.mono,
          color: colors.textMuted,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      {children || (
        <div className="stat-value" style={{
          fontSize: isHero ? 44 : 32,
          fontFamily: fonts.heading,
          fontWeight: 700,
          color: isHero ? colors.accent : colors.heading,
          lineHeight: 1.1,
        }}>
          {value}
        </div>
      )}
    </div>
  )
}

function HealthBars({ theme }) {
  const { colors, fonts, shape } = theme

  const barBg = {
    height: 6,
    borderRadius: 3,
    background: colors.bgAlt,
    overflow: 'hidden',
  }

  return (
    <StatCard icon={Activity} label="Fleet Health" theme={theme} span={2}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            fontFamily: fonts.mono,
            marginBottom: 4,
          }}>
            <span style={{ color: colors.lti }}>LTI Coverage</span>
            <span style={{ color: colors.textMuted }}>{MOCK.ltiCount}/{MOCK.ships} ({ltiPercent}%)</span>
          </div>
          <div style={barBg}>
            <div style={{
              height: '100%',
              width: `${ltiPercent}%`,
              background: colors.lti,
              borderRadius: 3,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            fontFamily: fonts.mono,
            marginBottom: 4,
          }}>
            <span style={{ color: colors.success }}>Flight Ready</span>
            <span style={{ color: colors.textMuted }}>{MOCK.flightReady}/{MOCK.ships} ({readyPercent}%)</span>
          </div>
          <div style={barBg}>
            <div style={{
              height: '100%',
              width: `${readyPercent}%`,
              background: colors.success,
              borderRadius: 3,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>
    </StatCard>
  )
}

function SizeChart({ theme }) {
  const { colors, fonts, shape, chartColors: tc, tooltipStyle: ts } = theme

  return (
    <div style={{
      background: colors.panel,
      borderRadius: shape.borderRadius,
      clipPath: shape.panelClipPath,
      border: colors.border !== 'transparent' ? `1px solid ${colors.border}` : 'none',
      overflow: 'hidden',
    }}>
      <div className="panel-header-bar">SIZE DISTRIBUTION</div>
      <div style={{ padding: '16px', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sizeData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {sizeData.map((_, i) => (
                <Cell key={i} fill={tc[i % tc.length]} />
              ))}
            </Pie>
            <Tooltip {...ts} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RoleChart({ theme }) {
  const { colors, fonts, shape, chartColors: tc, tooltipStyle: ts } = theme

  return (
    <div style={{
      background: colors.panel,
      borderRadius: shape.borderRadius,
      clipPath: shape.panelClipPath,
      border: colors.border !== 'transparent' ? `1px solid ${colors.border}` : 'none',
      overflow: 'hidden',
    }}>
      <div className="panel-header-bar">ROLE CATEGORIES</div>
      <div style={{ padding: '16px', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={roleData} layout="vertical" margin={{ left: 10, right: 30 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={70}
              tick={{ fill: colors.textMuted, fontSize: 10, fontFamily: fonts.mono }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...ts} />
            <Bar dataKey="count" radius={[0, 2, 2, 0]} barSize={14}>
              {roleData.map((_, i) => (
                <Cell key={i} fill={tc[i % tc.length]} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: colors.textMuted, fontSize: 10, fontFamily: fonts.mono }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ThemePreview({ theme }) {
  const { colors, fonts, shape, scopedCSS } = theme
  const themeClass = theme === industrial
    ? 'theme-industrial'
    : theme === quantum
    ? 'theme-quantum'
    : 'theme-clean'

  return (
    <div
      className={themeClass}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: colors.bg,
        fontFamily: fonts.body,
        color: colors.text,
        paddingTop: 40, // space for theme switcher
      }}
    >
      <style>{scopedCSS}</style>

      {/* Texture overlays */}
      {theme === industrial && (
        <>
          <div className="noise-overlay" />
          <div className="scan-lines" />
        </>
      )}
      {theme === quantum && (
        <>
          <div className="dot-grid" />
          <div className="crt-vignette" />
        </>
      )}

      <MockSidebar theme={theme} />

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
      }}>
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '28px 28px',
        }}>
          {/* Page header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{
              fontFamily: fonts.heading,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '0.12em',
              color: colors.heading,
              textTransform: 'uppercase',
              margin: 0,
            }}>
              FLEET OVERVIEW
            </h1>
            <p style={{
              fontSize: 12,
              fontFamily: fonts.mono,
              color: colors.textMuted,
              marginTop: 4,
              letterSpacing: '0.05em',
            }}>
              213 ships in reference database
            </p>
          </div>

          {/* Bento grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}>
            <StatCard icon={DollarSign} label="Total Fleet Value" theme={theme} span={2}>
              <div className="stat-value" style={{
                fontSize: 44,
                fontFamily: fonts.heading,
                fontWeight: 700,
                color: colors.accent,
                lineHeight: 1.1,
              }}>
                ${MOCK.totalValue.toLocaleString()}
              </div>
              <div style={{
                fontSize: 12,
                fontFamily: fonts.mono,
                color: colors.textMuted,
                marginTop: 8,
              }}>
                {MOCK.ships} ships pledged
              </div>
            </StatCard>

            <StatCard icon={Rocket} label="Ships" value={MOCK.ships} theme={theme} />
            <StatCard icon={Package} label="Cargo (SCU)" value={MOCK.cargo.toLocaleString()} theme={theme} />
            <StatCard icon={Users} label="Min Crew" value={MOCK.minCrew} theme={theme} />
            <StatCard icon={Users} label="Max Crew" value={MOCK.maxCrew} theme={theme} />

            <HealthBars theme={theme} />
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}>
            <SizeChart theme={theme} />
            <RoleChart theme={theme} />
          </div>

          {/* Theme description */}
          <div style={{
            marginTop: 24,
            padding: '16px 20px',
            background: colors.accentMuted,
            borderRadius: shape.borderRadius,
            border: colors.border !== 'transparent' ? `1px solid ${colors.border}` : 'none',
          }}>
            <div style={{
              fontSize: 12,
              fontFamily: fonts.heading,
              fontWeight: 600,
              color: colors.accent,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              {theme.meta.name}
            </div>
            <div style={{
              fontSize: 13,
              color: colors.textMuted,
              lineHeight: 1.5,
            }}>
              {theme.meta.description}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function DesignPreview() {
  const [searchParams] = useSearchParams()
  const designSlug = searchParams.get('design')
  const theme = THEMES[designSlug]

  // Inject Google Fonts
  useEffect(() => {
    if (!theme) return

    const linkId = `design-preview-font-${designSlug}`
    if (document.getElementById(linkId)) return

    const link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    link.href = theme.fonts.googleUrl
    document.head.appendChild(link)

    return () => {
      const el = document.getElementById(linkId)
      if (el) el.remove()
    }
  }, [theme, designSlug])

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
            {ALL_THEMES.map((t, i) => (
              <span key={t.meta.slug}>
                {i > 0 && ', '}
                <Link to={`/?design=${t.meta.slug}`} style={{ color: '#3b9dad' }}>{t.meta.slug}</Link>
              </span>
            ))}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ThemeSwitcher activeSlug={designSlug} />
      <ThemePreview theme={theme} />
    </>
  )
}
