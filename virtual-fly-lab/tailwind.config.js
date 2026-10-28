/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0e0f10',
          900: '#141517',
          850: '#191a1d',
          800: '#1e2023',
          700: '#2a2c30',
          600: '#3a3d42',
          500: '#5b5f66',
          400: '#8a8e95',
          300: '#b4b7bc',
          200: '#d6d8db',
          100: '#eceded',
        },
        accent: { DEFAULT: '#3987e5', muted: '#2a5f9e' },
        incoming: '#56b4d9',
        outgoing: '#e0a338',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Mono', 'SF Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: { '2xs': ['10.5px', '14px'] },
    },
  },
  plugins: [],
};
