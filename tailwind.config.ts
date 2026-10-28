import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef8f5", 100: "#d5efe7", 500: "#2f8f74", 600: "#24745e", 700: "#1d5d4c" },
      },
    },
  },
  plugins: [],
} satisfies Config;
