/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07060f',
          900: '#0b0918',
          800: '#120f26',
          700: '#1a1636',
          600: '#252048',
          500: '#352e63',
        },
        carrot: { DEFAULT: '#ff7a1a', 300: '#ffb070', 400: '#ff9443', 600: '#e5600a' },
        grape: { DEFAULT: '#8b5cf6', 300: '#c4b5fd', 400: '#a78bfa', 600: '#6d3fe0' },
        byte: { DEFAULT: '#22d3ee', 300: '#8beaf7' },
        lime: { DEFAULT: '#b6f23a' },
        rizz: { DEFAULT: '#ff4d8d', 300: '#ff9ebf' },
        paper: '#f4efe6',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,.06), 0 10px 40px -10px rgba(139,92,246,.45)',
        carrot: '0 10px 30px -8px rgba(255,122,26,.6)',
        pop: '4px 4px 0 0 #07060f',
        'pop-lg': '6px 6px 0 0 #07060f',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,20px) scale(.95)' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
        scan: { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(100%)' } },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        float: 'float 5s ease-in-out infinite',
        blob: 'blob 18s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        wiggle: 'wiggle .5s ease-in-out infinite',
        scan: 'scan 6s linear infinite',
      },
    },
  },
  plugins: [],
}
