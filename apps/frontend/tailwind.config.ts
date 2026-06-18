import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep, premium dark palette. Avoid pure-black; layered grays read
        // better against the accent gradients used in cards and charts.
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec2ff',
          400: '#599fff',
          500: '#3781f9',
          600: '#1f63ee',
          700: '#1a4fd7',
          800: '#1c43ae',
          900: '#1d3c89',
          950: '#162553',
        },
        ink: {
          50: '#f6f7f9',
          100: '#ecedf2',
          200: '#d4d7e2',
          300: '#aeb4c7',
          400: '#828aa6',
          500: '#646b8a',
          600: '#4f5470',
          700: '#41445b',
          800: '#383a4d',
          900: '#1f2030',
          950: '#13131e',
        },
        surface: {
          base: '#121215',
          raised: '#1c1c22',
          overlay: '#272730',
          border: '#333340',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          soft: '#8b5cf622',
        },
        primary: {
          DEFAULT: '#d946ef',
          soft: '#d946ef22',
        },
        income: '#22c55e',
        expense: '#ef4444',
        muted: '#7a8499',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        'card': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
        'modal': '0 30px 80px rgba(0,0,0,0.55)',
      },
      backdropBlur: { xs: '2px', md: '12px', xl: '24px' },
      transitionTimingFunction: { smooth: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'blob': {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'blob': 'blob 7s infinite',
      }
    },
  },
  plugins: [],
};
export default config;
