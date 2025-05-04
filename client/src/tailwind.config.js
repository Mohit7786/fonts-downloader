/** @type {import('tailwindcss').Config} */
module.exports = {
    // allow toggling dark mode via a .dark class on <html>
    darkMode: 'class',
    // make sure Tailwind scans your source files:
    content: [
        './index.html',
        './src/**/*.{js,jsx,ts,tsx}',
    ],

    theme: {
        extend: {},
    },

    plugins: [],
};
