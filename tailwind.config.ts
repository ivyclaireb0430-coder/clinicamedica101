import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef8f5", 100: "#d5efe7", 500: "#2f8f74", 600: "#24745e", 700: "#1d5d4c" },
        // Clinica Medica 101 logo colours, used on the public landing page
        cm: { blue: "#015ea4", navy: "#003e70", sky: "#e8f1fa", red: "#e30613", redDark: "#bf0510", green: "#44a949", mint: "#ecf7ed" },
      },
    },
  },
  plugins: [],
} satisfies Config;
