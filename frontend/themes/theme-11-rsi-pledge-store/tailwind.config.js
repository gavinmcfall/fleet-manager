/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#0d1b2a',
        'sc-darker': '#09131f',
        'sc-panel': '#132238',
        'sc-border': '#1e3a5f',
        'sc-accent': '#e8873a',
        'sc-accent2': '#5b9bd5',
        'sc-warn': '#e8873a',
        'sc-danger': '#dc3545',
        'sc-success': '#28a745',
        'sc-lti': '#a78bfa',
        'sc-melt': '#e8873a',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Electrolize"', '"Rajdhani"', 'sans-serif'],
        body: ['"Inter"', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
