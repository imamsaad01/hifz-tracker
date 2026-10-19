/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F4', line: '#E6E1D6', ink: { DEFAULT: '#1B2524', soft: '#4F5B59', faint: '#7C8784' },
        pine: { 50: '#EEF5F3', 100: '#D6E8E3', 600: '#2E6B60', 700: '#215549', 800: '#1A443B', 900: '#123029' },
        brass: { 100: '#F5ECDB', 500: '#B8893B', 700: '#8A6424' },
        good: '#1F7A4D', warn: '#A15C07', bad: '#B42318',
      },
      fontFamily: { sans: ['"Atkinson Hyperlegible"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'], quran: ['"Amiri Quran"', 'Amiri', 'serif'] },
      boxShadow: { card: '0 1px 2px rgba(27,37,36,.06), 0 1px 1px rgba(27,37,36,.04)' },
    },
  },
  plugins: [],
};
