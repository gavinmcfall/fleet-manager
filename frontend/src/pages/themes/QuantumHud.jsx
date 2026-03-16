// Quantum HUD — Cockpit Overlay
// Full-screen spatial layout with HUD aesthetic. Real collapsible sidebar
// with Lucide icons. Angular panels, bracket decorations, animated scan-in.

import React, { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import {
  BarChart3, Rocket, Shield, Search, MapPin, FileText, ShoppingCart,
  Hammer, Users, Package, Database, Settings, Upload, DollarSign,
  Activity, Crosshair, BookOpen, Star, Scale, Briefcase, TrendingUp,
  Palette, ChevronDown, ChevronRight, ChevronLeft, LogOut, User
} from 'lucide-react'

const CYAN = '#00d4ff'
const CYAN_DIM = '#006680'
const CYAN_FAINT = 'rgba(0, 212, 255, 0.05)'
const CYAN_GLOW = 'rgba(0, 212, 255, 0.3)'
const VIOLET = '#a78bfa'
const GREEN = '#00e890'
const PINK = '#ff6b9d'
const BG = '#020208'
const BG_SIDEBAR = '#04040c'
const BORDER = 'rgba(0, 212, 255, 0.08)'
const BORDER_STRONG = 'rgba(0, 212, 255, 0.15)'
const TEXT = '#7888a0'
const TEXT_BRIGHT = '#c8d8e8'

const HEADING_FONT = "'Orbitron', sans-serif"
const BODY_FONT = "'Exo 2', sans-serif"
const MONO_FONT = "'Share Tech Mono', monospace"
const GOOGLE_FONT = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Exo+2:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap'

const CHART_COLORS = [CYAN, VIOLET, GREEN, PINK, '#4e9eff', '#ffb347', '#36d399', '#818cf8']

const TOOLTIP_STYLE = {
  contentStyle: { background: 'rgba(4,4,12,0.95)', border: `1px solid ${CYAN_DIM}`, borderRadius: 0, boxShadow: `0 0 20px rgba(0, 212, 255, 0.15)` },
  labelStyle: { color: TEXT, fontFamily: MONO_FONT, fontSize: 12 },
  itemStyle: { color: TEXT_BRIGHT, fontFamily: MONO_FONT, fontSize: 12 },
}

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

// SVG corner bracket decoration
function Brackets({ color = CYAN_DIM, size = 16 }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={`0,${size} 0,0 ${size},0`} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <polyline points={`${100-size},0 100,0 100,${size}`} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <polyline points={`100,${100-size} 100,100 ${100-size},100`} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <polyline points={`${size},100 0,100 0,${100-size}`} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function HudPanel({ label, children, delay = 0, style = {} }) {
  return (
    <div style={{
      position: 'relative',
      background: CYAN_FAINT,
      padding: '16px 18px',
      animation: `hud-scan-in 0.5s ease-out ${delay}ms both`,
      ...style,
    }}>
      <Brackets color={CYAN_DIM} />
      {label && (
        <div style={{
          fontFamily: BODY_FONT,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.15em',
          color: CYAN_DIM,
          marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function StatBlock({ label, value, unit, color = TEXT_BRIGHT, delay = 0 }) {
  return (
    <div style={{
      textAlign: 'center',
      animation: `hud-scan-in 0.5s ease-out ${delay}ms both`,
    }}>
      <div style={{
        fontFamily: BODY_FONT,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.15em',
        color: CYAN_DIM,
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: HEADING_FONT,
        fontSize: 26,
        fontWeight: 700,
        color,
        lineHeight: 1,
        textShadow: `0 0 12px ${color}40`,
      }}>
        {value}
      </div>
      {unit && (
        <div style={{
          fontFamily: MONO_FONT,
          fontSize: 11,
          color: TEXT,
          marginTop: 4,
        }}>
          {unit}
        </div>
      )}
    </div>
  )
}

/* ── Collapsible sidebar ── */

function CollapsedSidebar({ onExpand }) {
  return (
    <div style={{
      width: 52,
      minHeight: '100%',
      background: BG_SIDEBAR,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      {/* Brand mark */}
      <div style={{
        padding: '14px 0',
        borderBottom: `1px solid ${BORDER}`,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <Rocket style={{ width: 18, height: 18, color: CYAN }} />
      </div>

      {/* Icons */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0' }}>
        {SIDEBAR_NAV.map((item, i) => {
          if (item.group) {
            const GroupIcon = item.icon
            const isActive = item.items.some(c => c.active)
            return (
              <div
                key={item.group}
                title={item.group}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? CYAN : TEXT,
                  cursor: 'default',
                  border: isActive ? `1px solid ${BORDER_STRONG}` : '1px solid transparent',
                  background: isActive ? CYAN_FAINT : 'transparent',
                }}
              >
                <GroupIcon style={{ width: 16, height: 16 }} />
              </div>
            )
          }
          const Icon = item.icon
          return (
            <div
              key={item.label}
              title={item.label}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: item.active ? CYAN : TEXT,
                cursor: 'default',
                border: item.active ? `1px solid ${BORDER_STRONG}` : '1px solid transparent',
                background: item.active ? CYAN_FAINT : 'transparent',
              }}
            >
              <Icon style={{ width: 16, height: 16 }} />
            </div>
          )
        })}
      </div>

      {/* Expand button */}
      <div style={{ padding: '12px 0', borderTop: `1px solid ${BORDER}`, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onExpand}
          style={{
            background: 'none',
            border: 'none',
            color: TEXT,
            cursor: 'pointer',
            padding: 6,
          }}
          title="Expand sidebar"
        >
          <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </div>
  )
}

function ExpandedSidebar({ onCollapse }) {
  const [expanded, setExpanded] = useState('Game Data')

  return (
    <div style={{
      width: 220,
      minHeight: '100%',
      background: BG_SIDEBAR,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Brand */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{
          fontFamily: HEADING_FONT,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.12em',
          color: CYAN,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Rocket style={{ width: 16, height: 16 }} />
          SC BRIDGE
        </div>
        <div style={{
          fontFamily: MONO_FONT,
          fontSize: 10,
          color: TEXT,
          marginTop: 4,
          letterSpacing: '0.1em',
        }}>
          STAR CITIZEN COMPANION
        </div>
        <div style={{
          fontFamily: MONO_FONT,
          fontSize: 10,
          color: CYAN_DIM,
          marginTop: 2,
        }}>
          4.0.2-LIVE
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
        {SIDEBAR_NAV.map((item) => {
          if (item.group) {
            const GroupIcon = item.icon
            const isOpen = expanded === item.group
            const isGroupActive = item.items.some(c => c.active)
            return (
              <div key={item.group} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : item.group)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: isGroupActive && !isOpen ? CYAN : TEXT,
                    fontFamily: BODY_FONT,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <GroupIcon style={{ width: 14, height: 14 }} />
                  <span style={{ flex: 1 }}>{item.group}</span>
                  {isOpen
                    ? <ChevronDown style={{ width: 12, height: 12 }} />
                    : <ChevronRight style={{ width: 12, height: 12 }} />
                  }
                </button>
                {isOpen && (
                  <div style={{
                    marginLeft: 14,
                    paddingLeft: 10,
                    borderLeft: `1px solid ${BORDER}`,
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
                            fontFamily: BODY_FONT,
                            fontSize: 12,
                            color: sub.active ? CYAN : TEXT,
                            cursor: 'default',
                            borderLeft: sub.active ? `2px solid ${CYAN}` : '2px solid transparent',
                            marginLeft: -11,
                            paddingLeft: 19,
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
          return (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                fontFamily: BODY_FONT,
                fontSize: 12,
                fontWeight: item.active ? 600 : 400,
                color: item.active ? CYAN : TEXT,
                cursor: 'default',
                background: item.active ? CYAN_FAINT : 'transparent',
                borderLeft: item.active ? `2px solid ${CYAN}` : '2px solid transparent',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {item.label}
            </div>
          )
        })}
      </div>

      {/* User */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px' }}>
          <User style={{ width: 14, height: 14, color: TEXT }} />
          <span style={{ fontFamily: BODY_FONT, fontSize: 12, color: TEXT }}>NZVengeance</span>
          <div style={{ flex: 1 }} />
          <LogOut style={{ width: 13, height: 13, color: TEXT }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: `1px solid ${BORDER}`,
        textAlign: 'center',
      }}>
        <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: CYAN_DIM, letterSpacing: '0.1em' }}>
          v2.0.0 &middot; NZVengeance
        </span>
      </div>

      {/* Collapse button */}
      <button
        onClick={onCollapse}
        style={{
          position: 'absolute',
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BG_SIDEBAR,
          border: `1px solid ${BORDER_STRONG}`,
          color: TEXT,
          cursor: 'pointer',
          zIndex: 10,
        }}
        title="Collapse sidebar"
      >
        <ChevronLeft style={{ width: 14, height: 14 }} />
      </button>
    </div>
  )
}

/* ── Main component ── */

export default function QuantumHud({ mock }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const ltiPct = Math.round((mock.ltiCount / mock.ships) * 100)
  const readyPct = Math.round((mock.flightReady / mock.ships) * 100)
  const sizeData = Object.entries(mock.sizeDistribution).map(([name, value]) => ({ name, value }))
  const radarData = Object.entries(mock.roleCategories).map(([name, count]) => ({ subject: name, count, fullMark: 5 }))

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      fontFamily: BODY_FONT,
      color: TEXT,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      paddingTop: 40,
    }}>
      <style>{`
        @import url('${GOOGLE_FONT}');
        .hud-dotgrid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.5;
          background-image: radial-gradient(circle, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .hud-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.6) 100%);
        }
        @keyframes hud-scan-in {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes hud-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes hud-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hud-reticle {
          position: absolute;
          width: 200px;
          height: 200px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          opacity: 0.06;
          animation: hud-rotate 60s linear infinite;
        }
      `}</style>

      <div className="hud-dotgrid" />
      <div className="hud-vignette" />

      {/* Sidebar */}
      <div style={{ position: 'relative', zIndex: 3, display: 'flex' }}>
        {sidebarCollapsed ? (
          <CollapsedSidebar onExpand={() => setSidebarCollapsed(false)} />
        ) : (
          <ExpandedSidebar onCollapse={() => setSidebarCollapsed(true)} />
        )}
      </div>

      {/* Main content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        flex: 1,
        padding: '20px 28px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}>

        {/* Top bar: breadcrumb + status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
          fontFamily: MONO_FONT,
          fontSize: 12,
        }}>
          <div style={{ color: TEXT }}>
            <span style={{ color: CYAN_DIM }}>SYS</span>
            <span style={{ color: 'rgba(0,212,255,0.2)', margin: '0 8px' }}>//</span>
            <span style={{ color: CYAN }}>FLEET OVERVIEW</span>
          </div>
          <div style={{ display: 'flex', gap: 20, color: TEXT }}>
            <span>4.0.2-LIVE</span>
            <span style={{ color: GREEN }}>ONLINE</span>
            <span>NZVengeance</span>
          </div>
        </div>

        {/* Central hero — fleet value */}
        <div style={{
          textAlign: 'center',
          padding: '32px 0 28px',
          position: 'relative',
        }}>
          <svg className="hud-reticle" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke={CYAN} strokeWidth="0.5" strokeDasharray="4 8" />
            <circle cx="100" cy="100" r="70" fill="none" stroke={CYAN} strokeWidth="0.3" />
            <line x1="100" y1="0" x2="100" y2="30" stroke={CYAN} strokeWidth="0.5" />
            <line x1="100" y1="170" x2="100" y2="200" stroke={CYAN} strokeWidth="0.5" />
            <line x1="0" y1="100" x2="30" y2="100" stroke={CYAN} strokeWidth="0.5" />
            <line x1="170" y1="100" x2="200" y2="100" stroke={CYAN} strokeWidth="0.5" />
          </svg>

          <div style={{
            fontFamily: BODY_FONT,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.25em',
            color: CYAN_DIM,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}>
            TOTAL FLEET VALUE
          </div>
          <div style={{
            fontFamily: HEADING_FONT,
            fontSize: 64,
            fontWeight: 900,
            color: CYAN,
            lineHeight: 1,
            textShadow: `0 0 40px ${CYAN_GLOW}, 0 0 80px rgba(0, 212, 255, 0.1)`,
            letterSpacing: '0.04em',
          }}>
            ${mock.totalValue.toLocaleString()}
          </div>
          <div style={{
            fontFamily: MONO_FONT,
            fontSize: 13,
            color: TEXT,
            marginTop: 10,
            letterSpacing: '0.1em',
          }}>
            {mock.ships} SHIPS PLEDGED &middot; {mock.cargo.toLocaleString()} SCU CARGO CAPACITY
          </div>
        </div>

        {/* Stat row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 40,
          padding: '20px 0 28px',
        }}>
          <StatBlock label="SHIPS" value={mock.ships} delay={100} />
          <StatBlock label="CARGO" value={mock.cargo.toLocaleString()} unit="SCU" delay={200} />
          <StatBlock label="MIN CREW" value={mock.minCrew} delay={300} />
          <StatBlock label="MAX CREW" value={mock.maxCrew} delay={400} />
          <StatBlock label="LTI" value={`${ltiPct}%`} color={VIOLET} delay={500} />
          <StatBlock label="READY" value={`${readyPct}%`} color={GREEN} delay={600} />
        </div>

        {/* Bottom: charts + status */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: 16,
          flex: 1,
        }}>
          {/* Size distribution donut */}
          <HudPanel label="SIZE DISTRIBUTION" delay={200}>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sizeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {sizeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
              {sizeData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: MONO_FONT }}>
                  <div style={{ width: 6, height: 6, background: CHART_COLORS[i], borderRadius: 1 }} />
                  <span style={{ color: TEXT }}>{d.name}</span>
                  <span style={{ color: TEXT_BRIGHT }}>{d.value}</span>
                </div>
              ))}
            </div>
          </HudPanel>

          {/* Radar chart for roles */}
          <HudPanel label="ROLE ANALYSIS" delay={400}>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="rgba(0, 212, 255, 0.1)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: TEXT, fontSize: 10, fontFamily: MONO_FONT }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 5]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="count"
                    stroke={CYAN}
                    fill={CYAN}
                    fillOpacity={0.12}
                    strokeWidth={1.5}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>

          {/* Fleet health + system status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HudPanel label="FLEET HEALTH" delay={600}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO_FONT, fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: VIOLET }}>LTI COVERAGE</span>
                  <span style={{ color: TEXT }}>{mock.ltiCount}/{mock.ships}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(167, 139, 250, 0.1)' }}>
                  <div style={{
                    height: '100%',
                    width: `${ltiPct}%`,
                    background: `linear-gradient(90deg, ${VIOLET}, ${VIOLET}cc)`,
                    boxShadow: `0 0 8px ${VIOLET}40`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO_FONT, fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: GREEN }}>FLIGHT READY</span>
                  <span style={{ color: TEXT }}>{mock.flightReady}/{mock.ships}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(0, 232, 144, 0.1)' }}>
                  <div style={{
                    height: '100%',
                    width: `${readyPct}%`,
                    background: `linear-gradient(90deg, ${GREEN}, ${GREEN}cc)`,
                    boxShadow: `0 0 8px ${GREEN}40`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            </HudPanel>

            <HudPanel label="SYSTEM STATUS" delay={800}>
              {[
                { label: 'HANGAR SYNC', status: 'NOMINAL', color: GREEN },
                { label: 'INSURANCE DB', status: 'NOMINAL', color: GREEN },
                { label: 'RSI API', status: 'CONNECTED', color: GREEN },
                { label: 'GAME DATA', status: '4.0.2', color: CYAN },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: MONO_FONT,
                  fontSize: 11,
                  padding: '5px 0',
                }}>
                  <span style={{ color: TEXT }}>{item.label}</span>
                  <span style={{ color: item.color }}>{item.status}</span>
                </div>
              ))}
            </HudPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
