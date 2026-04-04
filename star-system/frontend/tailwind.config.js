/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        star: {
          50:  '#f0f7ff',
          100: '#e0effe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e3a8a',
        },
        gap: {
          low:      '#16a34a',
          moderate: '#d97706',
          high:     '#dc2626',
        }
      },
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
    },
  },
  plugins: [],
}