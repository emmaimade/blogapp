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
          DEFAULT: '#7B39ED',
          hover: '#6D28D9',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
