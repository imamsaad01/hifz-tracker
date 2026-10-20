/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)', line: 'rgb(var(--line) / <alpha-value>)', ink: { DEFAULT: 'rgb(var(--ink) / <alpha-value>)', soft: 'rgb(var(--ink-soft) / <alpha-value>)', faint: 'rgb(var(--ink-faint) / <alpha-value>)' },
        pine: { 50: '#EEF5F3', 100: '#D6E8E3', 600: '#2E6B60', 700: '#215549', 800: '#1A443B', 900: '#123029' },
        brass: { 100: '#F5ECDB', 500: '#B8893B', 700: '#8A6424' },
        good: 'rgb(var(--good) / <alpha-value>)', warn: 'rgb(var(--warn) / <alpha-value>)', bad: 'rgb(var(--bad) / <alpha-value>)',
      },
      fontFamily: { sans: ['"Atkinson Hyperlegible"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'], quran: ['"Amiri Quran"', 'Amiri', 'serif'] },
      boxShadow: { card: '0 1px 2px rgba(27,37,36,.06), 0 1px 1px rgba(27,37,36,.04)' },
    },
  },
  plugins: [],
};
