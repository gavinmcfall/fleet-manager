/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#0d0f14',
        'sc-darker': '#08090d',
        'sc-panel': '#141720',
        'sc-border': '#2a2418',
        'sc-accent': '#f59e0b',
        'sc-accent2': '#fb923c',
        'sc-warn': '#fbbf24',
        'sc-danger': '#ef4444',
        'sc-success': '#22c55e',
        'sc-lti': '#e0a3ff',
        'sc-melt': '#ff6b35',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"Chakra Petch"', '"Rajdhani"', 'sans-serif'],
        body: ['"Chakra Petch"', '"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
