/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#090B11',
          surface: '#0E1119',
          card: '#13161F',
          'card-hover': '#181C27',
          border: '#1E2333',
          'border-light': '#252B3D',
        },
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
        },
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.08)' },
        },
        'waveform': {
          '0%, 100%': { height: '4px' },
          '50%': { height: '20px' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 0 rgba(245, 158, 11, 0.3)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(245, 158, 11, 0.6)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
        'waveform': 'waveform 0.8s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.4s ease-out forwards',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'studio': '0 0 0 1px rgba(30, 35, 51, 0.8), 0 4px 24px rgba(0,0,0,0.4)',
        'card': '0 0 0 1px rgba(30, 35, 51, 0.8), 0 2px 12px rgba(0,0,0,0.3)',
        'amber-glow': '0 0 20px rgba(245, 158, 11, 0.25)',
        'cyan-glow': '0 0 16px rgba(6, 182, 212, 0.2)',
      },
    },
  },
  plugins: [],
}
