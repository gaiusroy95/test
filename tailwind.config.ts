import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        brand: {
          navy:      "#0f172a",
          navyLight: "#1e293b",
          navyMid:   "#334155",
          accent:    "#0ea5e9",
          accentDk:  "#0284c7",
          teal:      "#14b8a6",
          tealDk:    "#0d9488",
        },
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:     { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card:        { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar:     {
          DEFAULT: "hsl(var(--sidebar-background))", foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))", "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))", "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))", ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: {
        sans:  ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono:  ['"IBM Plex Mono"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      // ── UI Type Scale ──────────────────────────────────────────────
      // Use these named classes instead of arbitrary text-[Xpx] values.
      // Tailwind defaults (do NOT re-add these):
      //   text-xs   = 12px  → small secondary text
      //   text-sm   = 14px  → body prose
      //   text-base = 16px  → section / card headers
      //   text-lg   = 18px  → page <h1>
      //   text-xl   = 20px  → dashboard welcome heading
      //   text-2xl  = 24px  → stat card numbers
      // Custom additions (sizes Tailwind doesn't have):
      //   text-2xs  = 10px  → uppercase tracking labels, taglines, sidebar portal label
      //   text-label= 11px  → table column headers, badges, meta info, form sub-labels
      //   text-ui   = 13px  → primary UI text: buttons, inputs, table cells, nav items
      fontSize: {
        "2xs":   ["10px", { lineHeight: "1.2",  letterSpacing: "0.04em" }],
        "label": ["11px", { lineHeight: "1.4" }],
        "ui":    ["13px", { lineHeight: "1.5" }],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
