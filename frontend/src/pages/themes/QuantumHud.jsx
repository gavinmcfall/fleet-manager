// Quantum HUD — Cockpit Overlay
// No traditional sidebar. Full-screen spatial layout with data positioned
// in zones like a fighter pilot's HUD. Fleet value dominates the center.
// Angular panels, targeting bracket decorations, animated scan-in effects.

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'

const CYAN = '#00d4ff'
const CYAN_DIM = '#006680'
const CYAN_FAINT = 'rgba(0, 212, 255, 0.05)'
const CYAN_GLOW = 'rgba(0, 212, 255, 0.3)'
const VIOLET = '#a78bfa'
const GREEN = '#00e890'
const PINK = '#ff6b9d'
const BG = '#020208'
const TEXT = '#8899aa'
const TEXT_BRIGHT = '#d0e0f0'

const HEADING_FONT = "'Orbitron', sans-serif"
const BODY_FONT = "'Exo 2', sans-serif"
const MONO_FONT = "'Share Tech Mono', monospace"
const GOOGLE_FONT = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Exo+2:wght@300;400;500;600&family=Share+Tech+Mono&display=swap'

const CHART_COLORS = [CYAN, VIOLET, GREEN, PINK, '#4e9eff', '#ffb347', '#36d399', '#818cf8']

const TOOLTIP_STYLE = {
  contentStyle: { background: 'rgba(2,2,8,0.95)', border: `1px solid ${CYAN_DIM}`, borderRadius: 0, boxShadow: `0 0 20px rgba(0, 212, 255, 0.15)` },
  labelStyle: { color: TEXT, fontFamily: MONO_FONT, fontSize: 11 },
  itemStyle: { color: TEXT_BRIGHT, fontFamily: MONO_FONT, fontSize: 11 },
}

// SVG corner bracket decoration
function Brackets({ width = '100%', height = '100%', color = CYAN_DIM, size = 16, style }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width, height, pointerEvents: 'none', ...style }} viewBox="0 0 100 100" preserveAspectRatio="none">
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
      padding: '14px 16px',
      animation: `hud-scan-in 0.5s ease-out ${delay}ms both`,
      ...style,
    }}>
      <Brackets color={CYAN_DIM} />
      {label && (
        <div style={{
          fontFamily: HEADING_FONT,
          fontSize: 9,
          letterSpacing: '0.2em',
          color: CYAN_DIM,
          marginBottom: 8,
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
        fontFamily: HEADING_FONT,
        fontSize: 9,
        letterSpacing: '0.2em',
        color: CYAN_DIM,
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: HEADING_FONT,
        fontSize: 28,
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
          fontSize: 10,
          color: TEXT,
          marginTop: 4,
        }}>
          {unit}
        </div>
      )}
    </div>
  )
}

export default function QuantumHud({ mock }) {
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
          opacity: 0.08;
          animation: hud-rotate 60s linear infinite;
        }
      `}</style>

      <div className="hud-dotgrid" />
      <div className="hud-vignette" />

      {/* Thin icon strip — left edge */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 40,
        bottom: 0,
        width: 48,
        background: 'rgba(0, 212, 255, 0.02)',
        borderRight: `1px solid rgba(0, 212, 255, 0.08)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        gap: 4,
        zIndex: 3,
      }}>
        {['\u25C8', '\u25CE', '\u2726', '\u25C6', '\u2738', '\u25B2', '\u2302'].map((sym, i) => (
          <div
            key={i}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: i === 0 ? CYAN : 'rgba(0, 212, 255, 0.2)',
              cursor: 'default',
              borderLeft: i === 0 ? `2px solid ${CYAN}` : '2px solid transparent',
            }}
          >
            {sym}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          fontSize: 8,
          color: CYAN_DIM,
          letterSpacing: '0.2em',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontFamily: MONO_FONT,
          padding: '8px 0 16px',
        }}>
          SC BRIDGE v2.0
        </div>
      </div>

      {/* Main HUD layout */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        marginLeft: 48,
        padding: '24px 32px',
        minHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Top bar: breadcrumb + status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          fontFamily: MONO_FONT,
          fontSize: 11,
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
          padding: '48px 0 40px',
          position: 'relative',
        }}>
          {/* Decorative reticle */}
          <svg className="hud-reticle" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke={CYAN} strokeWidth="0.5" strokeDasharray="4 8" />
            <circle cx="100" cy="100" r="70" fill="none" stroke={CYAN} strokeWidth="0.3" />
            <line x1="100" y1="0" x2="100" y2="30" stroke={CYAN} strokeWidth="0.5" />
            <line x1="100" y1="170" x2="100" y2="200" stroke={CYAN} strokeWidth="0.5" />
            <line x1="0" y1="100" x2="30" y2="100" stroke={CYAN} strokeWidth="0.5" />
            <line x1="170" y1="100" x2="200" y2="100" stroke={CYAN} strokeWidth="0.5" />
          </svg>

          <div style={{
            fontFamily: HEADING_FONT,
            fontSize: 10,
            letterSpacing: '0.3em',
            color: CYAN_DIM,
            marginBottom: 12,
          }}>
            TOTAL FLEET VALUE
          </div>
          <div style={{
            fontFamily: HEADING_FONT,
            fontSize: 72,
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
            letterSpacing: '0.15em',
          }}>
            {mock.ships} SHIPS PLEDGED &middot; {mock.cargo.toLocaleString()} SCU CARGO CAPACITY
          </div>
        </div>

        {/* Stat row — evenly spaced below hero */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 48,
          padding: '24px 0 36px',
        }}>
          <StatBlock label="SHIPS" value={mock.ships} delay={100} />
          <StatBlock label="CARGO" value={mock.cargo.toLocaleString()} unit="SCU" delay={200} />
          <StatBlock label="MIN CREW" value={mock.minCrew} delay={300} />
          <StatBlock label="MAX CREW" value={mock.maxCrew} delay={400} />
          <StatBlock label="LTI" value={`${ltiPct}%`} color={VIOLET} delay={500} />
          <StatBlock label="READY" value={`${readyPct}%`} color={GREEN} delay={600} />
        </div>

        {/* Bottom section: charts + status in angular panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: 16,
          flex: 1,
        }}>
          {/* Left: Size distribution donut */}
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
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
              {sizeData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: MONO_FONT }}>
                  <div style={{ width: 6, height: 6, background: CHART_COLORS[i], borderRadius: 1 }} />
                  <span style={{ color: TEXT }}>{d.name}</span>
                  <span style={{ color: TEXT_BRIGHT }}>{d.value}</span>
                </div>
              ))}
            </div>
          </HudPanel>

          {/* Center: Radar chart for roles */}
          <HudPanel label="ROLE ANALYSIS" delay={400}>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="rgba(0, 212, 255, 0.1)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: TEXT, fontSize: 9, fontFamily: MONO_FONT }}
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

          {/* Right: Fleet health + system status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HudPanel label="FLEET HEALTH" delay={600}>
              {/* LTI gauge */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO_FONT, fontSize: 10, marginBottom: 6 }}>
                  <span style={{ color: VIOLET }}>LTI COVERAGE</span>
                  <span style={{ color: TEXT }}>{mock.ltiCount}/{mock.ships}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(167, 139, 250, 0.1)', position: 'relative' }}>
                  <div style={{
                    height: '100%',
                    width: `${ltiPct}%`,
                    background: `linear-gradient(90deg, ${VIOLET}, ${VIOLET}cc)`,
                    boxShadow: `0 0 8px ${VIOLET}40`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
              {/* Flight ready gauge */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO_FONT, fontSize: 10, marginBottom: 6 }}>
                  <span style={{ color: GREEN }}>FLIGHT READY</span>
                  <span style={{ color: TEXT }}>{mock.flightReady}/{mock.ships}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(0, 232, 144, 0.1)', position: 'relative' }}>
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
                  fontSize: 10,
                  padding: '4px 0',
                }}>
                  <span style={{ color: TEXT }}>{item.label}</span>
                  <span style={{ color: item.color, animation: 'hud-pulse 3s ease-in-out infinite' }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </HudPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
