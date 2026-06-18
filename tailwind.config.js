/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0F", panel: "#17171F", raised: "#20212B",
        cyan: "#29E0FF", magenta: "#FF3D7F",
        ghost: "#F4F5FA", muted: "#9A9CB0",
        bella: "#FF4D6D", bianca: "#3DF0D0", damare: "#FFB23C",
      },
      fontFamily: {
        display: ['Bangers', 'cursive'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};