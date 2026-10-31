import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-noto-sans-thai)', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      colors: {
        'line-green': '#06C755',
        'line-green-dark': '#05a648',
        'senior-bg': '#F2F7FA', // SVG canvas background (replaces previous #F8F6F2)
        'senior-text': '#21215C', // SVG deep indigo navy text (replaces previous #2D2D2D)
        'senior-muted': '#7D84A3', // SVG slate gray (replaces previous #6B7280)
        'senior-secondary': '#4B4F72', // SVG dark slate secondary text
        'senior-accent': '#3E81F7', // SVG azure blue
        'senior-danger': '#EF4444',
        'senior-warning': '#F59E0B',
      },
      fontSize: {
        'senior-sm': ['1rem', '1.5rem'], // 16px — minimum readable
        'senior-base': ['1.25rem', '1.75rem'], // 20px — default body
        'senior-lg': ['1.5rem', '2rem'], // 24px — subheadings
        'senior-xl': ['1.875rem', '2.25rem'], // 30px — headings
        'senior-2xl': ['2.25rem', '2.75rem'], // 36px — page titles
      },
      spacing: {
        touch: '3rem', // 48px minimum touch target
        'touch-lg': '4rem', // 64px large touch target
      },
      borderRadius: {
        card: '1.5rem', // 24px rounded corners matching SVG
      },
      boxShadow: {
        'hub-card': '0 2px 6px rgba(33, 33, 92, 0.06), 0 8px 24px rgba(33, 33, 92, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
