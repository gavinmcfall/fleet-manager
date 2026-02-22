import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './frontend/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#0d1b2a',
        'sc-darker': '#09131f',
        'sc-panel': '#132238',
        'sc-border': '#2a4a6b',
        'sc-accent': '#22d3ee',
        'sc-accent2': '#5b9bd5',
        'sc-warn': '#f5a623',
        'sc-danger': '#ef4444',
        'sc-success': '#2ec4b6',
        'sc-lti': '#a78bfa',
        'sc-melt': '#f0c674',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
}
