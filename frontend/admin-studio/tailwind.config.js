/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        inko: {
          primary: '#4F46E5',
          secondary: '#7C3AED',
          accent: '#EC4899',
          'primary-light': '#6366F1',
          'primary-dark': '#4338CA',
        }
      }
    },
  },
  plugins: [require('@tailwindcss/typography')],
}