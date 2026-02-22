// Recharts can't use CSS vars in SVG fill, so JS constants are needed
export const CHART_COLORS = [
  '#5b9bd5', // sc-accent2
  '#818cf8', // indigo
  '#a78bfa', // violet / sc-lti
  '#e8873a', // sc-accent
  '#2ec4b6', // sc-success (teal)
  '#f5a623', // sc-warn (amber)
  '#ec4899', // pink
  '#6366f1', // indigo deeper
]

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#132238',
    border: '1px solid #1e3a5f',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  labelStyle: {
    color: '#9ca3af',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
  },
  itemStyle: {
    color: '#d1d5db',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
  },
}
