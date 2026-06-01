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
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        'card': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
        'modal': '0 30px 80px rgba(0,0,0,0.55)',
      },
      backdropBlur: { xs: '2px' },
      transitionTimingFunction: { smooth: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
export default config;
