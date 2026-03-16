// Quantum HUD — True black + RSI teal
// HUD-style brackets, angled clip-paths, dot grid, CRT vignette.

export const meta = {
  name: 'Quantum HUD',
  slug: 'quantum-hud',
  description: 'True black base, RSI teal accent. HUD brackets, angled corners, CRT vignette.',
}

export const fonts = {
  heading: "'Orbitron', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
  googleUrl: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600&display=swap',
}

export const colors = {
  bg: '#050508',
  bgAlt: '#0a0a10',
  panel: '#0c0c14',
  panelHover: '#121220',
  border: '#1a1a2e',
  accent: '#00c8ff',
  accentMuted: 'rgba(0, 200, 255, 0.08)',
  accentGlow: 'rgba(0, 200, 255, 0.2)',
  success: '#00e890',
  lti: '#a78bfa',
  text: '#c8c8d0',
  textMuted: '#606078',
  textDim: '#38384a',
  heading: '#e8e8f0',
  sidebar: '#030306',
  sidebarBorder: '#141428',
}

export const shape = {
  borderRadius: '0px',
  heroClipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
  panelClipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
}

export const chartColors = [
  '#00c8ff', // teal
  '#a78bfa', // violet
  '#00e890', // green
  '#ff6b9d', // pink
  '#4e9eff', // blue
  '#ffb347', // orange
  '#36d399', // mint
  '#818cf8', // indigo
]

export const tooltipStyle = {
  contentStyle: {
    background: '#0c0c14',
    border: '1px solid rgba(0, 200, 255, 0.2)',
    borderRadius: '0px',
    boxShadow: '0 0 20px rgba(0, 200, 255, 0.1)',
  },
  labelStyle: {
    color: '#606078',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
  },
  itemStyle: {
    color: '#c8c8d0',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
  },
}

export const scopedCSS = `
  .theme-quantum .dot-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.4;
    background-image: radial-gradient(circle, rgba(0, 200, 255, 0.07) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .theme-quantum .crt-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.4) 100%);
  }
  .theme-quantum .hud-bracket {
    position: relative;
  }
  .theme-quantum .hud-bracket::before,
  .theme-quantum .hud-bracket::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    border-color: rgba(0, 200, 255, 0.3);
    border-style: solid;
    pointer-events: none;
  }
  .theme-quantum .hud-bracket::before {
    top: -1px;
    left: -1px;
    border-width: 1px 0 0 1px;
  }
  .theme-quantum .hud-bracket::after {
    bottom: -1px;
    right: -1px;
    border-width: 0 1px 1px 0;
  }
  .theme-quantum .panel-header-bar {
    border-bottom: 1px solid #1a1a2e;
    padding: 8px 14px;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #00c8ff;
    font-family: 'Orbitron', sans-serif;
    font-weight: 500;
    position: relative;
    background: linear-gradient(90deg, rgba(0, 200, 255, 0.04) 0%, transparent 50%);
  }
  @keyframes scan-in {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .theme-quantum .stat-value {
    animation: scan-in 0.4s ease-out both;
  }
`
