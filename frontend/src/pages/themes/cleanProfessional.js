// Clean Professional — Warm near-black, desaturated teal
// Linear/Vercel-inspired. No sci-fi decoration. Let content breathe.

export const meta = {
  name: 'Clean Professional',
  slug: 'clean-professional',
  description: 'Warm near-black base, desaturated teal accent. No borders — background shifts only.',
}

export const fonts = {
  heading: "'Geist Sans', 'Inter', sans-serif",
  body: "'Geist Sans', 'Inter', sans-serif",
  mono: "'Geist Mono', 'JetBrains Mono', monospace",
  googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
}

export const colors = {
  bg: '#111113',
  bgAlt: '#1c1c1e',
  panel: '#191919',
  panelHover: '#1f1f21',
  border: 'transparent',
  accent: '#3b9dad',
  accentMuted: 'rgba(59, 157, 173, 0.1)',
  accentGlow: 'rgba(59, 157, 173, 0.15)',
  success: '#34d399',
  lti: '#a78bfa',
  text: '#a1a1aa',
  textMuted: '#71717a',
  textDim: '#52525b',
  heading: '#fafafa',
  sidebar: '#0f0f11',
  sidebarBorder: 'transparent',
}

export const shape = {
  borderRadius: '6px',
  heroClipPath: 'none',
  panelClipPath: 'none',
}

export const chartColors = [
  '#3b9dad', // teal
  '#a78bfa', // violet
  '#34d399', // green
  '#f97316', // orange
  '#60a5fa', // blue
  '#f472b6', // pink
  '#a3e635', // lime
  '#818cf8', // indigo
]

export const tooltipStyle = {
  contentStyle: {
    background: '#1c1c1e',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  labelStyle: {
    color: '#71717a',
    fontFamily: "'Inter', sans-serif",
    fontSize: '12px',
  },
  itemStyle: {
    color: '#a1a1aa',
    fontFamily: "'Inter', sans-serif",
    fontSize: '12px',
  },
}

export const scopedCSS = `
  .theme-clean .panel-header-bar {
    padding: 10px 16px;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #71717a;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
`
