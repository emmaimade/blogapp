/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#9333EA',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'], // Katen-style modern font
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}