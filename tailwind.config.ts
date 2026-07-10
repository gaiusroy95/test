import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        /* brand.* maps to design tokens — brand-accent === primary indigo */
        brand: {
          navy:      "hsl(var(--foreground))",
          navyLight: "hsl(222 47% 18%)",
          navyMid:   "hsl(215 19% 35%)",
          accent:    "hsl(var(--primary))",
          accentDk:  "hsl(var(--primary-dark))",
          teal:      "hsl(var(--teal))",
          tealDk:    "hsl(var(--teal-dark))",
        },
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:     { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", dark: "hsl(var(--primary-dark))" },
        primaryDk:   "hsl(var(--primary-dark))",
        secondary:   { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))", tint: "hsl(var(--destructive-tint))" },
        muted:       { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card:        { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        ok:          { DEFAULT: "hsl(var(--ok))", tint: "hsl(var(--ok-tint))" },
        warn:        { DEFAULT: "hsl(var(--warn))", tint: "hsl(var(--warn-tint))" },
        info:        { DEFAULT: "hsl(var(--info))", tint: "hsl(var(--info-tint))" },
        sunken:      "hsl(var(--surface-sunken))",
        placeholder: "hsl(var(--placeholder))",
        sidebar:     {
          DEFAULT: "hsl(var(--sidebar-background))", foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))", "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))", "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))", ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius)",
      },
      fontFamily: {
        sans:  ['"Manrope"', 'system-ui', 'sans-serif'],
        mono:  ['"IBM Plex Mono"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      // Type scale:
      //   text-2xs  = 10px  → uppercase labels, taglines
      //   text-label= 11px  → table headers, badges, meta
      //   text-ui   = 13px  → buttons, inputs, table cells, nav
      //   text-xs   = 12px  → secondary body (Tailwind default)
      //   text-sm   = 14px  → body (Tailwind default)
      //   text-base = 16px  → section headers (Tailwind default)
      //   text-lg   = 18px  → page h1 (Tailwind default)
      fontSize: {
        "2xs":   ["10px", { lineHeight: "1.2",  letterSpacing: "0.04em" }],
        "label": ["11px", { lineHeight: "1.4" }],
        "ui":    ["13px", { lineHeight: "1.5" }],
      },
      boxShadow: {
        "surface": "0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.02)",
        "elevated": "0 2px 8px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.03)",
        "modal": "0 16px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.05)",
        "primary": "none",
        "sidebar": "1px 0 0 hsl(var(--sidebar-border))",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "slide-in-left": "slide-in-left 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
