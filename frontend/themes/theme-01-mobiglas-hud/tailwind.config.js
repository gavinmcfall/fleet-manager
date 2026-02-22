/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'sc-dark': '#040a0f',
        'sc-darker': '#020608',
        'sc-panel': '#081418',
        'sc-border': '#0e3a40',
        'sc-accent': '#00e5ff',
        'sc-accent2': '#00b8d4',
        'sc-warn': '#ffab00',
        'sc-danger': '#ff1744',
        'sc-success': '#00e676',
        'sc-lti': '#18ffff',
        'sc-melt': '#ff6d00',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', '"Share Tech Mono"', 'monospace'],
        body: ['"Share Tech Mono"', '"Rajdhani"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
