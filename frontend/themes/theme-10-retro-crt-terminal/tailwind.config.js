/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#000000',
        'sc-darker': '#000000',
        'sc-panel': '#0a1a0a',
        'sc-border': '#1a3a1a',
        'sc-accent': '#33ff33',
        'sc-accent2': '#22cc22',
        'sc-warn': '#cccc00',
        'sc-danger': '#ff3333',
        'sc-success': '#33ff33',
        'sc-lti': '#66ff66',
        'sc-melt': '#ffaa00',
      },
      fontFamily: {
        mono: ['"VT323"', '"Fira Code"', 'monospace'],
        display: ['"VT323"', 'monospace'],
        body: ['"VT323"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
