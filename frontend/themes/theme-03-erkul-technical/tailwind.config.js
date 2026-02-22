/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#0b1120',
        'sc-darker': '#070d1a',
        'sc-panel': '#111a2e',
        'sc-border': '#1e2d4a',
        'sc-accent': '#60a5fa',
        'sc-accent2': '#818cf8',
        'sc-warn': '#fbbf24',
        'sc-danger': '#f87171',
        'sc-success': '#34d399',
        'sc-lti': '#a78bfa',
        'sc-melt': '#fb923c',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Exo 2"', '"Inter"', 'sans-serif'],
        body: ['"Inter"', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
