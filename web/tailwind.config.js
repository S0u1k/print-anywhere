/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        "brand-gray": "#1A1A1A",
        brand: {
          gray: "#1A1A1A",
        },
      },
    },
  },
  plugins: [],
}
