import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette from the Magic Patterns design (design/magic-patterns/data/brand.ts).
        ink: { DEFAULT: "#0B1530", soft: "#132045", 3: "#1D2D59", muted: "#5B6478" },
        marquee: { DEFAULT: "#D6A84E", soft: "#F3E6C8", bright: "#EBCB86", deep: "#8C6620" },
        canvas: "#F7F3EA",
        sand: "#ECE4D3",
        line: "#DDD4C1",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
