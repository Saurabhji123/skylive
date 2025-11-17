import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
        body: ["Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", ...defaultTheme.fontFamily.mono]
      },
      colors: {
        "skylive-purple": "#1D1233",
        "skylive-midnight": "#0B0F1E",
        "skylive-magenta": "#B834F4",
        "skylive-cyan": "#33E0FF",
        "skylive-amber": "#FF9F1C"
      },
      boxShadow: {
        glow: "0 0 40px rgba(51, 224, 255, 0.35)",
        neon: "0 0 40px rgba(184, 52, 244, 0.35)"
      },
      backdropBlur: {
        xs: "4px"
      },
      animation: {
        pulseGlow: "pulseGlow 2.5s infinite"
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(51, 224, 255, 0.0)" },
          "50%": { boxShadow: "0 0 30px rgba(184, 52, 244, 0.4)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
