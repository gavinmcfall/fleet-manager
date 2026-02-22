/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#050807',
        'sc-darker': '#020403',
        'sc-panel': '#0a120a',
        'sc-border': '#1a2e1a',
        'sc-accent': '#4ade80',
        'sc-accent2': '#d4a017',
        'sc-warn': '#d4a017',
        'sc-danger': '#dc2626',
        'sc-success': '#22c55e',
        'sc-lti': '#86efac',
        'sc-melt': '#f59e0b',
      },
      fontFamily: {
        mono: ['"Source Code Pro"', '"JetBrains Mono"', 'monospace'],
        display: ['"Teko"', '"Rajdhani"', 'sans-serif'],
        body: ['"Rajdhani"', '"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
