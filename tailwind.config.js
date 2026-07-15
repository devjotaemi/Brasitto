/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      colors: {
        // Warm neutral base
        cream: '#faf4ea',
        surface: '#fffdf8',
        sand: '#f2e8d8',
        line: '#e8dcc9',
        // Terracotta — primary / brand
        terracotta: {
          50: '#fbeee8',
          100: '#f5d8ca',
          200: '#eab59d',
          300: '#df9170',
          400: '#d1714d',
          500: '#c2603a', // primary
          600: '#a54c2b', // hover
          700: '#853c23',
          800: '#653020',
        },
        // Espresso — ink / text (browns)
        espresso: {
          DEFAULT: '#241a12',
          ink: '#241a12',
          body: '#5b4a3b',
          muted: '#867160',
          soft: '#a5917d',
        },
        honey: '#c98a28', // warm gold accent
        sage: '#5f7350', // warm confirmations
        brick: '#a83b28', // warm danger
      },
      boxShadow: {
        soft: '0 1px 2px rgba(36,26,18,0.04), 0 10px 30px -18px rgba(36,26,18,0.20)',
        card: '0 2px 6px -2px rgba(36,26,18,0.08), 0 18px 40px -24px rgba(36,26,18,0.28)',
        lift: '0 30px 70px -30px rgba(36,26,18,0.45)',
        'inner-top': 'inset 0 1px 1px rgba(255,255,255,0.6)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'ember': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.06)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'sheet-up': 'sheet-up 0.42s cubic-bezier(0.32,0.72,0,1) both',
        'ember': 'ember 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
