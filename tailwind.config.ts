import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef8f5", 100: "#d5efe7", 500: "#2f8f74", 600: "#24745e", 700: "#1d5d4c" },
        // Clinica Medica 101 logo colours, used on the public landing page
        cm: { blue: "#015ea4", navy: "#003e70", sky: "#e8f1fa", red: "#e30613", redDark: "#bf0510", green: "#44a949", mint: "#ecf7ed",
          // Supporting colours for the public website, picked to sit well next to the logo's blue, red and green.
          teal: "#0b7d71", tealSoft: "#e3f5f2", gold: "#e9a100", goldSoft: "#fff5dc", coral: "#ec6a52", coralSoft: "#fdece8", cream: "#fffaf1" },
      },
    },
  },
  plugins: [],
} satisfies Config;
