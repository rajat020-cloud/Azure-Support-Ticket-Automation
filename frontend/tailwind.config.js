/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        azure: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0078d4',
          600: '#0062ad',
          700: '#004c87',
          900: '#0b132b'
        }
      }
    },
  },
  plugins: [],
}
