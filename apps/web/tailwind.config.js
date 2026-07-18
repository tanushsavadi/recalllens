/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy palette names are remapped to theme CSS variables so older
        // components flip automatically between dark/light. New code should
        // prefer the token utilities (text-hi/text-mid/text-lo, .glass, etc.).
        midnight: {
          950: "var(--bg-0)",
          900: "var(--bg-1)",
          850: "var(--bg-2)",
          800: "var(--bg-2)",
          700: "var(--line-strong)",
          600: "var(--line-strong)",
        },
        surface: {
          DEFAULT: "transparent",
          muted: "color-mix(in oklab, var(--text-hi) 8%, transparent)",
          card: "var(--glass-fill-strong)",
        },
        // slate.* used widely for text/borders → map to theme tokens
        slate: {
          100: "color-mix(in oklab, var(--text-hi) 10%, transparent)",
          200: "var(--line)",
          300: "var(--line-strong)",
          400: "var(--text-lo)",
          500: "var(--text-lo)",
          600: "var(--text-mid)",
          700: "var(--text-mid)",
          800: "var(--text-hi)",
          900: "var(--text-hi)",
        },
        verified: {
          DEFAULT: "var(--verified)",
          bg: "color-mix(in oklab, var(--verified) 15%, transparent)",
          fg: "var(--verified-fg)",
        },
        amber: {
          safety: "var(--amber)",
          bg: "color-mix(in oklab, var(--amber) 15%, transparent)",
        },
        outbreak: {
          DEFAULT: "var(--outbreak)",
          bg: "color-mix(in oklab, var(--outbreak) 15%, transparent)",
        },
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        display: ["Fraunces", "Space Grotesk", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
