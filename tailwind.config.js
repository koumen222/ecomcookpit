/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f2ed',
          100: '#c0ddd2',
          200: '#96c7b5',
          300: '#6cb198',
          400: '#4d9f82',
          500: '#0F6B4F',
          600: '#0d6048',
          700: '#0a533e',
          800: '#084634',
          900: '#053326',
        },
        scalor: {
          black: '#0F1115',
          green: '#0F6B4F',
          'green-light': '#14855F',
          'green-dark': '#0A5740',
          sand: '#D8CFC4',
          'sand-light': '#EDE8E2',
          'sand-dark': '#C4B8A9',
          copper: '#C56A2D',
          'copper-light': '#D4803F',
          'copper-dark': '#A85824',
        },
        ecom: {
          primary: '#0F6B4F',
          'primary-dark': '#0A5740',
          secondary: '#C56A2D',
          danger: '#ef4444',
          warning: '#f59e0b',
          info: '#0F6B4F',
          success: '#22c55e',
        }
      },
      fontFamily: {
        'sans': ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        'satoshi': ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
