import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#0d1b2a',
        'sc-darker': '#09131f',
        'sc-panel': '#132238',
        'sc-border': '#2a4a6b',
        'sc-accent': '#e8873a',
        'sc-accent2': '#5b9bd5',
        'sc-warn': '#f5a623',
        'sc-danger': '#ef4444',
        'sc-success': '#2ec4b6',
        'sc-lti': '#a78bfa',
        'sc-melt': '#f0c674',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Electrolize"', '"Rajdhani"', 'sans-serif'],
        body: ['"Inter"', '"Segoe UI"', 'sans-serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [typography],
}
