/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // You can define your specific Katen Indigo here
        primary: "#4f46e5", 
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