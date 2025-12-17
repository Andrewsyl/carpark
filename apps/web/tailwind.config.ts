import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f8ff",
          100: "#dff1ff",
          200: "#b7e0ff",
          300: "#7dc8ff",
          400: "#38a7ff",
          500: "#007ee6",
          600: "#005fbf",
          700: "#004a99",
          800: "#003a7a",
          900: "#002f66"
        }
      },
      boxShadow: {
        card: "0 12px 30px rgba(0, 48, 102, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
