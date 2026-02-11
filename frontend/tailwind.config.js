/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#0a0e17',
        'sc-darker': '#060a12',
        'sc-panel': '#111827',
        'sc-border': '#1e293b',
        'sc-accent': '#38bdf8',
        'sc-accent2': '#818cf8',
        'sc-warn': '#f59e0b',
        'sc-danger': '#ef4444',
        'sc-success': '#22c55e',
        'sc-lti': '#a78bfa',
        'sc-melt': '#fb923c',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Orbitron"', '"Rajdhani"', 'sans-serif'],
        body: ['"Rajdhani"', '"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
