// Industrial Frontier — Charcoal + Amber/Rust
// Rugged, utilitarian feel. Tight density, chamfered corners, subtle noise.

export const meta = {
  name: 'Industrial Frontier',
  slug: 'industrial-frontier',
  description: 'Charcoal base, amber accent. Chamfered corners, scan-line texture.',
}

export const fonts = {
  heading: "'Electrolize', sans-serif",
  body: "'Source Sans 3', sans-serif",
  mono: "'JetBrains Mono', monospace",
  googleUrl: 'https://fonts.googleapis.com/css2?family=Electrolize&family=Source+Sans+3:wght@400;600;700&display=swap',
}

export const colors = {
  bg: '#1a1a1e',
  bgAlt: '#252529',
  panel: '#222226',
  panelHover: '#2a2a2f',
  border: '#3a3a40',
  accent: '#d4842a',
  accentMuted: 'rgba(212, 132, 42, 0.15)',
  accentGlow: 'rgba(212, 132, 42, 0.3)',
  success: '#5a9e4b',
  lti: '#c99a3e',
  text: '#d4d4d8',
  textMuted: '#8a8a90',
  textDim: '#5a5a62',
  heading: '#f0ece4',
  sidebar: '#161618',
  sidebarBorder: '#2e2e34',
}

export const shape = {
  borderRadius: '2px',
  heroClipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
  panelClipPath: 'none',
}

export const chartColors = [
  '#d4842a', // amber
  '#c99a3e', // gold
  '#5a9e4b', // green
  '#b86830', // rust
  '#7a9e8e', // sage
  '#a0785a', // copper
  '#88683a', // bronze
  '#9a6050', // terracotta
]

export const tooltipStyle = {
  contentStyle: {
    background: '#252529',
    border: '1px solid #3a3a40',
    borderRadius: '2px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
  },
  labelStyle: {
    color: '#8a8a90',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
  },
  itemStyle: {
    color: '#d4d4d8',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
  },
}

// CSS injected into the preview scope
export const scopedCSS = `
  .theme-industrial .noise-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 128px 128px;
  }
  .theme-industrial .scan-lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.015) 3px,
      rgba(255, 255, 255, 0.015) 4px
    );
  }
  .theme-industrial .panel-header-bar {
    background: linear-gradient(90deg, rgba(212, 132, 42, 0.12) 0%, transparent 70%);
    border-bottom: 1px solid #3a3a40;
    padding: 8px 14px;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #d4842a;
    font-family: 'Electrolize', sans-serif;
    position: relative;
  }
  .theme-industrial .panel-header-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #d4842a;
  }
`
