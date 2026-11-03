/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        space: {
          50: '#f4f6fb',
          100: '#e8edf7',
          200: '#cbd7ed',
          300: '#9db7de',
          400: '#6892cc',
          500: '#4373ba',
          600: '#325b9f',
          700: '#2a4980',
          800: '#263f6a',
          900: '#15243e',
          950: '#0c1626',
        },
      },
    },
  },
  plugins: [],
};
