import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        dotBounce: {
          "0%,100%": { transform: "translateY(0)",   opacity: "0.5" },
          "50%":     { transform: "translateY(-5px)", opacity: "1" },
        },
        cursorBlink: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0" },
        },
        shimmer: {
          from: { backgroundPosition: "-400px 0" },
          to:   { backgroundPosition: "400px 0" },
        },
        progressBar: {
          from: { width: "0%" },
          to:   { width: "100%" },
        },
      },
      animation: {
        "fade-up":     "fadeUp 0.3s ease forwards",
        "dot-1":       "dotBounce 1.2s ease-in-out infinite 0ms",
        "dot-2":       "dotBounce 1.2s ease-in-out infinite 150ms",
        "dot-3":       "dotBounce 1.2s ease-in-out infinite 300ms",
        "cursor":      "cursorBlink 1s step-end infinite",
        "shimmer":     "shimmer 2s linear infinite",
        "progress":    "progressBar 3s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
