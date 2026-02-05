/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // PPAfan Brand Colors
      colors: {
        brand: {
          blue: '#5B8FCC',      // Primary blue - main actions
          amber: '#F5A623',     // Amber - highlights, warnings
          coral: '#D85641',     // Coral - CTAs, important actions
          'blue-dark': '#4A7AB8',
          'blue-light': '#6DA3E0',
          'amber-dark': '#E09515',
          'amber-light': '#FFBD3F',
          'coral-dark': '#C74839',
          'coral-light': '#E66B57',
        },
      },
      // Raleway (Headers/Titles) + Inter (Everything Else)
      fontFamily: {
        display: ['Raleway', 'system-ui', '-apple-system', 'sans-serif'],    // Headers/Titles - Elegant
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],         // Body/Buttons/Forms - Professional
        accent: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],       // Stats/CTAs - Inter Bold
      },
    },
  },
  plugins: [],
};
