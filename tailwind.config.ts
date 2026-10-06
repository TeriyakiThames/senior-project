import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'line-green': '#06C755',
        'line-green-dark': '#05a648',
        'senior-bg': '#F8F6F2', // Warm off-white background
        'senior-text': '#2D2D2D', // High-contrast dark text
        'senior-muted': '#6B7280',
        'senior-accent': '#4F46E5', // Indigo accent for actions
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
        card: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
