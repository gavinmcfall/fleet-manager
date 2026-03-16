// Industrial Frontier — CRT Terminal Aesthetic
// Inspired by Alien (1979) ship computers: amber on black, monospaced everything,
// no cards, no sidebar. Data presented as terminal readouts with block-character bars.
// Navigation is a horizontal top bar like terminal window chrome.

import React from 'react'

const NAV_ITEMS = ['DASHBOARD', 'ITEM FINDER', 'FLEET', 'SHIP DB', 'INSURANCE', 'ANALYSIS', 'SETTINGS']

const AMBER = '#ffb000'
const AMBER_DIM = '#b37a00'
const AMBER_FAINT = 'rgba(255, 176, 0, 0.06)'
const GREEN = '#33ff33'
const GREEN_DIM = '#1a9e1a'
const RED = '#ff4136'
const BG = '#0a0a08'
const BG_PANEL = '#0f0e0c'
const BORDER = '#2a2518'
const TEXT = '#cc9b30'
const TEXT_DIM = '#665020'

const FONT = "'IBM Plex Mono', 'Courier New', monospace"
const GOOGLE_FONT = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap'

// Build block-character bar: filled blocks + empty blocks
function blockBar(value, max, width = 20) {
  const filled = Math.round((value / max) * width)
  const empty = width - filled
  return '\u2593'.repeat(filled) + '\u2591'.repeat(empty)
}

function TerminalLine({ label, value, valueColor = AMBER, prefix = '>' }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '3px 0',
      fontFamily: FONT,
      fontSize: 13,
      lineHeight: 1.6,
    }}>
      <span style={{ color: TEXT_DIM, userSelect: 'none' }}>{prefix}</span>
      <span style={{ color: TEXT, minWidth: 180 }}>{label}</span>
      <span style={{ color: valueColor, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export default function IndustrialFrontier({ mock }) {
  const ltiPct = Math.round((mock.ltiCount / mock.ships) * 100)
  const readyPct = Math.round((mock.flightReady / mock.ships) * 100)
  const maxRole = Math.max(...Object.values(mock.roleCategories))
  const maxSize = Math.max(...Object.values(mock.sizeDistribution))

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      fontFamily: FONT,
      color: TEXT,
      position: 'relative',
      paddingTop: 40,
    }}>
      <style>{`
        @import url('${GOOGLE_FONT}');
        .ind-scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 176, 0, 0.015) 2px,
            rgba(255, 176, 0, 0.015) 4px
          );
        }
        .ind-glow {
          text-shadow: 0 0 8px rgba(255, 176, 0, 0.4), 0 0 20px rgba(255, 176, 0, 0.15);
        }
        .ind-cursor::after {
          content: '\\2588';
          animation: ind-blink 1s step-end infinite;
          color: ${AMBER};
          margin-left: 2px;
        }
        @keyframes ind-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .ind-flicker {
          animation: ind-flicker-anim 4s ease-in-out infinite;
        }
        @keyframes ind-flicker-anim {
          0%, 96%, 100% { opacity: 1; }
          97% { opacity: 0.85; }
          98% { opacity: 1; }
          99% { opacity: 0.9; }
        }
      `}</style>

      <div className="ind-scanlines" />

      {/* Terminal chrome — top nav bar */}
      <div style={{
        borderBottom: `1px solid ${BORDER}`,
        background: BG_PANEL,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'stretch',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Terminal title */}
        <div style={{
          padding: '10px 20px 10px 0',
          borderRight: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span className="ind-glow" style={{ color: AMBER, fontSize: 14, fontWeight: 700, letterSpacing: '0.15em' }}>
            SC BRIDGE
          </span>
          <span style={{ color: TEXT_DIM, fontSize: 10 }}>v2.0.0</span>
        </div>

        {/* Nav items as terminal tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {NAV_ITEMS.map((item, i) => (
            <div
              key={item}
              style={{
                padding: '10px 16px',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: i === 0 ? AMBER : TEXT_DIM,
                borderBottom: i === 0 ? `2px solid ${AMBER}` : '2px solid transparent',
                cursor: 'default',
                transition: 'color 0.15s',
              }}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Right: status indicators */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 10 }}>
          <span style={{ color: GREEN_DIM }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: GREEN, marginRight: 6, boxShadow: `0 0 6px ${GREEN}` }} />
            CONNECTED
          </span>
          <span style={{ color: TEXT_DIM }}>4.0.2-LIVE</span>
          <span style={{ color: TEXT_DIM }}>NZVengeance</span>
        </div>
      </div>

      {/* Main terminal content */}
      <div className="ind-flicker" style={{ position: 'relative', zIndex: 2, padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* System header */}
        <div style={{ marginBottom: 24, borderBottom: `1px solid ${BORDER}`, paddingBottom: 16 }}>
          <div style={{ color: TEXT_DIM, fontSize: 11, marginBottom: 4 }}>
            SYSTEM://FLEET/OVERVIEW
          </div>
          <div className="ind-glow ind-cursor" style={{
            color: AMBER,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.2em',
          }}>
            FLEET STATUS REPORT
          </div>
          <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 6 }}>
            GENERATED: 2026-03-16 13:42:00 UTC &middot; 213 VEHICLES IN DATABASE
          </div>
        </div>

        {/* Two-column terminal layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* Left column: Primary readouts */}
          <div>
            <div style={{
              color: AMBER_DIM,
              fontSize: 10,
              letterSpacing: '0.2em',
              marginBottom: 12,
              paddingBottom: 4,
              borderBottom: `1px dashed ${BORDER}`,
            }}>
              PRIMARY READOUT
            </div>

            <TerminalLine label="TOTAL PLEDGE VALUE" value={`$${mock.totalValue.toLocaleString()} USD`} />
            <TerminalLine label="SHIPS IN FLEET" value={mock.ships} />
            <TerminalLine label="CARGO CAPACITY" value={`${mock.cargo.toLocaleString()} SCU`} />
            <TerminalLine label="MIN CREW REQUIRED" value={mock.minCrew} />
            <TerminalLine label="MAX CREW CAPACITY" value={mock.maxCrew} />

            <div style={{ height: 24 }} />

            {/* Fleet health as block bars */}
            <div style={{
              color: AMBER_DIM,
              fontSize: 10,
              letterSpacing: '0.2em',
              marginBottom: 12,
              paddingBottom: 4,
              borderBottom: `1px dashed ${BORDER}`,
            }}>
              FLEET HEALTH
            </div>

            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: TEXT_DIM, userSelect: 'none' }}>{'>'}</span>
                <span style={{ color: TEXT, minWidth: 140 }}>LTI COVERAGE</span>
                <span style={{ color: GREEN, fontFamily: FONT, letterSpacing: '0.05em' }}>
                  {blockBar(mock.ltiCount, mock.ships)}
                </span>
                <span style={{ color: TEXT_DIM, fontSize: 11 }}>{ltiPct}%</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: TEXT_DIM, userSelect: 'none' }}>{'>'}</span>
                <span style={{ color: TEXT, minWidth: 140 }}>FLIGHT READY</span>
                <span style={{ color: GREEN, fontFamily: FONT, letterSpacing: '0.05em' }}>
                  {blockBar(mock.flightReady, mock.ships)}
                </span>
                <span style={{ color: TEXT_DIM, fontSize: 11 }}>{readyPct}%</span>
              </div>
            </div>
          </div>

          {/* Right column: Distribution tables */}
          <div>
            <div style={{
              color: AMBER_DIM,
              fontSize: 10,
              letterSpacing: '0.2em',
              marginBottom: 12,
              paddingBottom: 4,
              borderBottom: `1px dashed ${BORDER}`,
            }}>
              SIZE DISTRIBUTION
            </div>

            {Object.entries(mock.sizeDistribution).map(([name, count]) => (
              <div key={name} style={{
                display: 'flex',
                gap: 12,
                fontSize: 12,
                lineHeight: 2,
                alignItems: 'center',
              }}>
                <span style={{ color: TEXT_DIM, userSelect: 'none' }}>{'>'}</span>
                <span style={{ color: TEXT, minWidth: 90, textTransform: 'uppercase' }}>{name}</span>
                <span style={{ color: AMBER, fontFamily: FONT, letterSpacing: '0.05em', flex: 1 }}>
                  {blockBar(count, maxSize, 16)}
                </span>
                <span style={{ color: AMBER, fontWeight: 600, minWidth: 20, textAlign: 'right' }}>{count}</span>
              </div>
            ))}

            <div style={{ height: 24 }} />

            <div style={{
              color: AMBER_DIM,
              fontSize: 10,
              letterSpacing: '0.2em',
              marginBottom: 12,
              paddingBottom: 4,
              borderBottom: `1px dashed ${BORDER}`,
            }}>
              ROLE CATEGORIES
            </div>

            {Object.entries(mock.roleCategories).map(([name, count]) => (
              <div key={name} style={{
                display: 'flex',
                gap: 12,
                fontSize: 12,
                lineHeight: 2,
                alignItems: 'center',
              }}>
                <span style={{ color: TEXT_DIM, userSelect: 'none' }}>{'>'}</span>
                <span style={{ color: TEXT, minWidth: 90, textTransform: 'uppercase' }}>{name}</span>
                <span style={{ color: AMBER, fontFamily: FONT, letterSpacing: '0.05em', flex: 1 }}>
                  {blockBar(count, maxRole, 16)}
                </span>
                <span style={{ color: AMBER, fontWeight: 600, minWidth: 20, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom status bar */}
        <div style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: `1px solid ${BORDER}`,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: TEXT_DIM,
        }}>
          <span>SYS: NOMINAL</span>
          <span>MEM: 1.2GB / 4.0GB</span>
          <span>UPTIME: 847d 14h 22m</span>
          <span style={{ color: GREEN_DIM }}>ALL SYSTEMS OPERATIONAL</span>
        </div>
      </div>
    </div>
  )
}
