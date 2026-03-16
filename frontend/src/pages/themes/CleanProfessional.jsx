// Clean Professional — Editorial Magazine Layout
// LIGHT THEME. Serif display numbers, asymmetric grid, generous whitespace.
// Inspired by Bloomberg Terminal meets Monocle magazine. No sci-fi decoration.
// Let the data and typography carry the visual weight.

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'

const BG = '#fafaf8'
const BG_WARM = '#f5f2ed'
const BG_CARD = '#ffffff'
const BORDER = '#e8e4de'
const ACCENT = '#1a5c6b'
const ACCENT_LIGHT = '#d4e8ec'
const CORAL = '#c25840'
const TEXT = '#1c1c1e'
const TEXT_SEC = '#6b6560'
const TEXT_DIM = '#a8a098'

const DISPLAY_FONT = "'Fraunces', 'Georgia', serif"
const HEADING_FONT = "'Archivo', 'Helvetica Neue', sans-serif"
const BODY_FONT = "'Archivo', 'Helvetica Neue', sans-serif"
const MONO_FONT = "'DM Mono', 'Courier New', monospace"
const GOOGLE_FONT = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,700;9..144,900&family=Archivo:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap'

const CHART_COLORS = [ACCENT, CORAL, '#7b9e87', '#c2956b', '#6b8fb5', '#b5856b', '#8b7bb5', '#5b9b8b']

const TOOLTIP_STYLE = {
  contentStyle: { background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' },
  labelStyle: { color: TEXT_SEC, fontFamily: MONO_FONT, fontSize: 11 },
  itemStyle: { color: TEXT, fontFamily: MONO_FONT, fontSize: 11 },
}

const SIDEBAR_ITEMS = [
  { label: 'Overview', active: true },
  { label: 'Fleet' },
  { label: 'Insurance' },
  { label: 'Analysis' },
  { divider: true },
  { label: 'Item Finder' },
  { label: 'Locations' },
  { label: 'Missions' },
  { label: 'Shops' },
  { label: 'Trade' },
  { divider: true },
  { label: 'Ship Database' },
  { label: 'Paints' },
  { label: 'Careers' },
  { label: 'Settings' },
]

export default function CleanProfessional({ mock }) {
  const ltiPct = Math.round((mock.ltiCount / mock.ships) * 100)
  const readyPct = Math.round((mock.flightReady / mock.ships) * 100)
  const sizeData = Object.entries(mock.sizeDistribution).map(([name, value]) => ({ name, value }))
  const roleData = Object.entries(mock.roleCategories).map(([name, count]) => ({ name, count }))

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      fontFamily: BODY_FONT,
      color: TEXT,
      display: 'flex',
      paddingTop: 40,
    }}>
      <style>{`
        @import url('${GOOGLE_FONT}');
        .clean-fade-in {
          animation: clean-fade 0.6s ease-out both;
        }
        @keyframes clean-fade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Minimal text sidebar */}
      <nav style={{
        width: 200,
        minHeight: '100vh',
        padding: '28px 0',
        borderRight: `1px solid ${BORDER}`,
        background: BG,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo — just text, refined */}
        <div style={{ padding: '0 24px 24px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 20,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            SC Bridge
          </div>
          <div style={{
            fontFamily: MONO_FONT,
            fontSize: 10,
            color: TEXT_DIM,
            marginTop: 4,
          }}>
            v2.0.0 &middot; 4.0.2
          </div>
        </div>

        {/* Nav: plain text links, no icons */}
        <div style={{ flex: 1, padding: '16px 0' }}>
          {SIDEBAR_ITEMS.map((item, i) => {
            if (item.divider) {
              return <div key={i} style={{ height: 1, background: BORDER, margin: '8px 24px' }} />
            }
            return (
              <div
                key={item.label}
                style={{
                  padding: '7px 24px',
                  fontSize: 13,
                  fontWeight: item.active ? 600 : 400,
                  color: item.active ? ACCENT : TEXT_SEC,
                  borderRight: item.active ? `2px solid ${ACCENT}` : '2px solid transparent',
                  cursor: 'default',
                  transition: 'color 0.15s',
                }}
              >
                {item.label}
              </div>
            )
          })}
        </div>

        {/* User */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: ACCENT_LIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: ACCENT,
            }}>
              N
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>NZVengeance</div>
              <div style={{ fontSize: 10, color: TEXT_DIM }}>Super Admin</div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px' }}>

          {/* Editorial hero section — asymmetric */}
          <div className="clean-fade-in" style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: 48,
            marginBottom: 48,
            alignItems: 'end',
          }}>
            {/* Left: big number + context */}
            <div>
              <div style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                color: TEXT_DIM,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 8,
              }}>
                Total Fleet Value
              </div>
              <div style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 80,
                fontWeight: 300,
                color: TEXT,
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
              }}>
                ${mock.totalValue.toLocaleString()}
              </div>
              <div style={{
                fontFamily: BODY_FONT,
                fontSize: 15,
                color: TEXT_SEC,
                marginTop: 16,
                lineHeight: 1.6,
                maxWidth: 420,
              }}>
                Across <strong style={{ color: TEXT }}>{mock.ships} ships</strong> with{' '}
                <strong style={{ color: TEXT }}>{mock.cargo.toLocaleString()} SCU</strong> cargo capacity.{' '}
                Fleet requires {mock.minCrew}&ndash;{mock.maxCrew} crew members at full operation.
              </div>
            </div>

            {/* Right: compact metric strips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Ships', value: mock.ships },
                { label: 'Cargo SCU', value: mock.cargo.toLocaleString() },
                { label: 'Crew Range', value: `${mock.minCrew}\u2013${mock.maxCrew}` },
                { label: 'LTI Coverage', value: `${ltiPct}%`, accent: true },
                { label: 'Flight Ready', value: `${readyPct}%`, accent: true },
              ].map((m, i) => (
                <div key={m.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '12px 0',
                  borderBottom: i < 4 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <span style={{ fontSize: 12, color: TEXT_SEC }}>{m.label}</span>
                  <span style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 24,
                    fontWeight: 400,
                    color: m.accent ? ACCENT : TEXT,
                    letterSpacing: '-0.02em',
                  }}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fleet health — full width, minimal */}
          <div className="clean-fade-in" style={{
            marginBottom: 48,
            animationDelay: '0.15s',
          }}>
            <div style={{
              fontFamily: MONO_FONT,
              fontSize: 11,
              color: TEXT_DIM,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 16,
            }}>
              Fleet Health
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              {/* LTI bar */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: TEXT_SEC }}>LTI Coverage</span>
                  <span style={{ fontFamily: MONO_FONT, color: TEXT }}>{mock.ltiCount} of {mock.ships}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: BG_WARM, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${ltiPct}%`,
                    background: ACCENT,
                    borderRadius: 4,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
              {/* Flight ready bar */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: TEXT_SEC }}>Flight Ready</span>
                  <span style={{ fontFamily: MONO_FONT, color: TEXT }}>{mock.flightReady} of {mock.ships}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: BG_WARM, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${readyPct}%`,
                    background: CORAL,
                    borderRadius: 4,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Charts: asymmetric layout — donut smaller, bar wider */}
          <div className="clean-fade-in" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.8fr',
            gap: 40,
            animationDelay: '0.3s',
          }}>
            {/* Size distribution — donut */}
            <div>
              <div style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                color: TEXT_DIM,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 16,
              }}>
                Size Distribution
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sizeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke={BG}
                      strokeWidth={2}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 12, justifyContent: 'center' }}>
                {sizeData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i] }} />
                    <span style={{ color: TEXT_SEC }}>{d.name}</span>
                    <span style={{ color: TEXT, fontWeight: 500 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role categories — horizontal bar */}
            <div>
              <div style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                color: TEXT_DIM,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 16,
              }}>
                Role Categories
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roleData} layout="vertical" margin={{ left: 0, right: 24 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      tick={{ fill: TEXT_SEC, fontSize: 12, fontFamily: BODY_FONT }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} fill={ACCENT}>
                      {roleData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Reference DB note — subtle footer */}
          <div style={{
            marginTop: 48,
            paddingTop: 16,
            borderTop: `1px solid ${BORDER}`,
            fontFamily: MONO_FONT,
            fontSize: 11,
            color: TEXT_DIM,
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>213 ships in reference database</span>
            <span>Last sync: 2 hours ago</span>
          </div>
        </div>
      </main>
    </div>
  )
}
