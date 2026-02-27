import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssAspectRatio from "@tailwindcss/aspect-ratio";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Tipografia dos design tokens
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        heading: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          dark: "hsl(var(--primary-dark))",
          "dark-foreground": "hsl(var(--primary-dark-foreground))",
          light: "hsl(var(--primary-light))",
          "light-foreground": "hsl(var(--primary-light-foreground))",
          subtle: "hsl(var(--primary-subtle))",
          "subtle-foreground": "hsl(var(--primary-subtle-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Cores Orgânicas Biotech do app
        "bg-primary": "var(--bg-primary)",
        "bg-card": "var(--bg-card)",
        "bg-card-hover": "var(--bg-card-hover)",
        "bg-subtle": "var(--bg-subtle)",
        "bg-warm": "var(--bg-warm)",
        "border-default": "var(--border-default)",
        "border-active": "var(--border-active)",
        "border-gold": "var(--border-gold)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        green: {
          DEFAULT: "var(--green)",
          dim: "var(--green-dim)",
          50: "#ECFDF5",
          400: "#34D399",
          500: "#1A7A50",
          600: "#15653F",
          950: "#052E16",
        },
        gold: {
          DEFAULT: "var(--gold)",
          light: "var(--gold-light)",
          dim: "var(--gold-dim)",
          400: "#E8C77B",
          500: "#D4A24C",
          600: "#8B6A2F",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      // Border radius dos design tokens (Organic Builder)
      borderRadius: {
        none: "0",
        sm: "var(--radius-sm)", // 6px
        DEFAULT: "var(--radius-md)", // 10px
        md: "var(--radius-md)", // 10px
        lg: "var(--radius-lg)", // 14px
        xl: "var(--radius-xl)", // 20px
        "2xl": "1.5rem",
        "3xl": "2rem",
        full: "9999px",
      },
      // Sombras Brutalistas + Glow Orgânico
      boxShadow: {
        sm: "0 1px 3px rgba(9, 201, 114, 0.08)",
        DEFAULT: "0 4px 12px rgba(9, 201, 114, 0.12)",
        md: "0 4px 12px rgba(9, 201, 114, 0.12)",
        lg: "0 8px 24px rgba(4, 147, 87, 0.15)",
        xl: "0 12px 32px rgba(4, 147, 87, 0.18)",
        'brutal': '4px 4px 0px 0px var(--brutal-shadow-color)',
        'brutal-sm': '2px 2px 0px 0px var(--brutal-shadow-color)',
        'brutal-lg': '8px 8px 0px 0px var(--brutal-shadow-color)',
        'brutal-dark': '4px 4px 0px 0px #09C972',
        'brutal-dark-lg': '8px 8px 0px 0px rgba(9, 201, 114, 0.4)',
        'glow': '0 0 20px rgba(9, 201, 114, 0.4)',
        'glow-green': '0 0 20px rgba(9, 201, 114, 0.15)',
        'glow-gold': '0 0 20px rgba(212, 162, 76, 0.15)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "mitosis-left": {
          "0%, 100%": { transform: "translateX(0) scale(1.1)", opacity: "0.9" },
          "50%": { transform: "translateX(-120%) scale(0.6)", opacity: "0.4" },
        },
        "mitosis-right": {
          "0%, 100%": { transform: "translateX(0) scale(1.1)", opacity: "0.9" },
          "50%": { transform: "translateX(120%) scale(0.6)", opacity: "0.4" },
        },
        "bio-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        "dna-spin": {
          "0%": { top: "0", transform: "scale(1)", zIndex: "2", opacity: "1" },
          "50%": { top: "100%", transform: "scale(0.5)", zIndex: "1", opacity: "0.3" },
          "100%": { top: "0", transform: "scale(1)", zIndex: "2", opacity: "1" },
        },
        "dna-spin-rev": {
          "0%": { bottom: "0", transform: "scale(0.5)", zIndex: "1", opacity: "0.3" },
          "50%": { bottom: "100%", transform: "scale(1)", zIndex: "2", opacity: "1" },
          "100%": { bottom: "0", transform: "scale(0.5)", zIndex: "1", opacity: "0.3" },
        },
        /* 06 — Slide In: entrada de cards, painéis, toasts */
        "slide-in": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-up": {
          "0%": { transform: "translateY(24px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        /* 43 — Spotlight Sweep: destaque premium em cards e headers */
        "spotlight-sweep": {
          "0%": { transform: "translateX(-200%) skewX(-15deg)" },
          "100%": { transform: "translateX(400%) skewX(-15deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "mitosis-left": "mitosis-left 1.6s ease-in-out infinite",
        "mitosis-right": "mitosis-right 1.6s ease-in-out infinite",
        "bio-breathe": "bio-breathe 3s ease-in-out infinite",
        "bio-breathe-fast": "bio-breathe 2s ease-in-out infinite",
        "dna-spin": "dna-spin 1.5s ease-in-out infinite",
        "dna-spin-rev": "dna-spin-rev 1.5s ease-in-out infinite",
        /* 06 — Slide In variants */
        "slide-in": "slide-in 0.3s ease-out both",
        "slide-in-right": "slide-in-right 0.3s ease-out both",
        "slide-in-up": "slide-in-up 0.3s ease-out both",
        "slide-in-slow": "slide-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        /* 43 — Spotlight Sweep */
        "spotlight-sweep": "spotlight-sweep 2.5s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssAspectRatio],
} satisfies Config;
