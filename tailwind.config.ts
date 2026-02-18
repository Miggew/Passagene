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
        sans: ["Manrope", "system-ui", "sans-serif"],
        heading: ["Outfit", "Plus Jakarta Sans", "sans-serif"], // Outfit adicionada como principal
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
        // Cores diretas do design system PassaGene (baseadas na logo real)
        passagene: {
          primary: "#09C972",        // Verde vibrante da logo
          "primary-dark": "#049357", // Verde escuro da logo
          "primary-light": "#5EDFA3",// Derivado mais claro
          "primary-subtle": "#D0F5E3",// Fundo sutil
          accent: "#07B566",         // Intermediário
          text: "#666666",           // Cinza do texto da logo
          "neutral-900": "#333333",
          "neutral-700": "#555555",
          "neutral-400": "#999999",
          "neutral-100": "#F7FAF9",
        },
      },
      // Border radius dos design tokens (Atualizado: Organic/Rounded)
      borderRadius: {
        none: "0",
        sm: "calc(var(--radius) - 4px)", // 8px
        DEFAULT: "calc(var(--radius))",   // 12px
        md: "calc(var(--radius))",        // 12px
        lg: "calc(var(--radius) + 4px)",  // 16px
        xl: "calc(var(--radius) + 8px)",  // 20px
        "2xl": "calc(var(--radius) + 12px)", // 24px - Super arredondado para Cards
        "3xl": "calc(var(--radius) + 20px)", // 32px
        full: "9999px",
      },
      // Sombras suaves com tom verde (cores reais da logo)
      boxShadow: {
        sm: "0 1px 3px rgba(9, 201, 114, 0.08)",
        DEFAULT: "0 4px 12px rgba(9, 201, 114, 0.12)",
        md: "0 4px 12px rgba(9, 201, 114, 0.12)",
        lg: "0 8px 24px rgba(4, 147, 87, 0.15)",
        xl: "0 12px 32px rgba(4, 147, 87, 0.18)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssAspectRatio],
} satisfies Config;
