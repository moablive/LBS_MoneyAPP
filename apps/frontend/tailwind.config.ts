import type { Config } from 'tailwindcss';

/**
 * Tema por CSS vars (ver styles/main.css): o claro é o padrão — canvas creme,
 * cards brancos, botões pretos e lima como destaque (referência "Dashboard V5",
 * reel do code.xr, 10/2026). O escuro continua existindo pela classe `dark`
 * no <html>, trocada pelo composable useTheme.
 *
 * Cada cor semântica é `rgb(var(--x) / <alpha-value>)` para que `bg-fg/5`,
 * `text-accent/60` etc. continuem funcionando com opacidade.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
          950: '#111113',
        },
        surface: {
          base: v('surface-base'),
          raised: v('surface-raised'),
          overlay: v('surface-overlay'),
          border: v('surface-border'),
        },
        // Texto principal (preto no claro, quase-branco no escuro).
        fg: v('fg'),
        muted: v('muted'),
        // Ação primária: preto no claro (botão-pílula), violeta no escuro.
        accent: {
          DEFAULT: v('accent'),
          soft: 'rgb(var(--accent) / 0.12)',
        },
        // Destaque "V5": lima com texto escuro em cima.
        lime: {
          DEFAULT: v('lime'),
          fg: '#111113',
        },
        // Índigo dos painéis de detalhe da referência.
        primary: {
          DEFAULT: v('primary'),
          soft: 'rgb(var(--primary) / 0.12)',
        },
        income: v('income'),
        expense: v('expense'),
        alert: v('alert'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        modal: 'var(--shadow-modal)',
        rail: '0 18px 40px -16px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
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
        },
        'draw': {
          '0%': { strokeDashoffset: '1' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'blob': 'blob 7s infinite',
        'draw': 'draw 1.2s cubic-bezier(0.22, 1, 0.36, 1) both',
      }
    },
  },
  plugins: [],
};
export default config;
