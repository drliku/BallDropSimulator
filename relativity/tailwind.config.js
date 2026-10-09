/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: { 950: '#02040b', 900: '#050a18', 850: '#081024', 800: '#0b1430', 700: '#13204a' },
        earth: { DEFAULT: '#22d3ee', soft: '#67e8f9', deep: '#3b82f6' },
        ship: { DEFAULT: '#f59e0b', soft: '#fcd34d', deep: '#fb923c' },
        ink: { DEFAULT: '#e6ecf8', muted: '#94a3c4', faint: '#5f6d8f' },
      },
      fontFamily: {
        display: ['"Chakra Petch"', '"Arial Narrow"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glass: '0 18px 50px rgba(1, 4, 14, 0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
};
