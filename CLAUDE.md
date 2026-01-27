# Instruções fixas para este projeto

Sempre siga rigorosamente os design tokens extraídos da nova logo, disponíveis em design-tokens.md:

# Design System — PassaGene

---

## 1. Paleta de Cores

A logo utiliza uma combinação de **verde vibrante** (remetendo a vida, saúde, biotecnologia) com **cinza escuro** (profissionalismo, confiança). O símbolo sugere uma **dupla hélice de DNA estilizada**, reforçando o tema genético/científico.

### Cores Principais

| Nome | Hex | HSL | RGB | Tailwind |
|------|-----|-----|-----|----------|
| **Primary** | `#2ECC71` | `hsl(145, 63%, 49%)` | `rgb(46, 204, 113)` | `emerald-500` |
| **Primary Dark** | `#1E8449` | `hsl(153, 62%, 32%)` | `rgb(30, 132, 73)` | `emerald-700` |
| **Primary Light** | `#82E0AA` | `hsl(145, 59%, 69%)` | `rgb(130, 224, 170)` | `emerald-300` |
| **Primary Subtle** | `#D5F5E3` | `hsl(145, 65%, 89%)` | `rgb(213, 245, 227)` | `emerald-100` |
| **Accent** | `#27AE60` | `hsl(145, 63%, 42%)` | `rgb(39, 174, 96)` | `green-600` |

### Neutros

| Nome | Hex | HSL | RGB | Tailwind |
|------|-----|-----|-----|----------|
| **Neutral 900** | `#4A5568` | `hsl(218, 11%, 35%)` | `rgb(74, 85, 104)` | `gray-600` |
| **Neutral 700** | `#5D6D7E` | `hsl(212, 15%, 43%)` | `rgb(93, 109, 126)` | `slate-500` |
| **Neutral 400** | `#A0AEC0` | `hsl(216, 15%, 69%)` | `rgb(160, 174, 192)` | `gray-400` |
| **Neutral 100** | `#F7FAFC` | `hsl(204, 45%, 98%)` | `rgb(247, 250, 252)` | `gray-50` |
| **Background** | `#FFFFFF` | `hsl(0, 0%, 100%)` | `rgb(255, 255, 255)` | `white` |

---

## 2. Tipografia Sugerida

A logo apresenta uma tipografia **bold, geométrica e levemente itálica** — transmite movimento, modernidade e dinamismo científico.

### Famílias Recomendadas

| Uso | Fonte | Fallback |
|-----|-------|----------|
| **Principal** | **Manrope** | `system-ui, sans-serif` |
| **Títulos/Destaques** | **Outfit** ou **Plus Jakarta Sans** | `sans-serif` |
| **Monospace (dados/código)** | **JetBrains Mono** | `monospace` |

### Escala Tipográfica

| Token | Tamanho | Line Height | Weight |
|-------|---------|-------------|--------|
| `heading-1` | 48px / 3rem | 1.1 | 700 |
| `heading-2` | 36px / 2.25rem | 1.2 | 700 |
| `heading-3` | 28px / 1.75rem | 1.25 | 600 |
| `heading-4` | 24px / 1.5rem | 1.3 | 600 |
| `heading-5` | 20px / 1.25rem | 1.4 | 600 |
| `heading-6` | 18px / 1.125rem | 1.4 | 500 |
| `body` | 16px / 1rem | 1.6 | 400 |
| `body-sm` | 14px / 0.875rem | 1.5 | 400 |
| `small` | 12px / 0.75rem | 1.4 | 400 |

---

## 3. Formas e Estilo Geométrico

### Bordas
- **Padrão:** `rounded-xl` (12–16px)
- **Botões:** `rounded-lg` (8px)
- **Pills/Tags:** `rounded-full`
- **Cards:** `rounded-2xl` (16–20px)

### Sombras
Sombras **suaves e difusas** — evocam leveza e confiança médica/científica:

```css
--shadow-sm: 0 1px 3px rgba(46, 204, 113, 0.08);
--shadow-md: 0 4px 12px rgba(46, 204, 113, 0.12);
--shadow-lg: 0 8px 24px rgba(30, 132, 73, 0.15);
```

### Ícones
- **Estilo:** Line icons com stroke médio (1.5–2px)
- **Biblioteca sugerida:** Phosphor Icons, Lucide, ou Heroicons
- **Variações:** Duotone para destaques (preenchimento com cor primária + stroke neutro)

### Sensação Geral
> **Clean • Científico • Moderno • Confiável • Orgânico-Tech**

---

## 4. Moodboard — Palavras-chave

```
┌─────────────────────────────────────────────────────────────┐
│  🧬 Biotecnologia   •   🌿 Orgânico   •   💚 Vitalidade    │
│  🔬 Ciência         •   ✨ Inovação   •   🏥 Saúde         │
│  📊 Precisão        •   🛡️ Confiança  •   🚀 Futuro        │
│  🎯 Clareza         •   💎 Premium                         │
└─────────────────────────────────────────────────────────────┘
```

**10 palavras que definem o estilo:**
1. Biotecnologia
2. Vitalidade
3. Confiança
4. Inovação
5. Clareza
6. Orgânico
7. Precisão científica
8. Modernidade
9. Saúde
10. Premium acessível

---

## 5. JSON de Design Tokens

```json
{
  "colors": {
    "primary": {
      "DEFAULT": "#2ECC71",
      "dark": "#1E8449",
      "light": "#82E0AA",
      "subtle": "#D5F5E3"
    },
    "accent": "#27AE60",
    "neutral": {
      "900": "#4A5568",
      "700": "#5D6D7E",
      "400": "#A0AEC0",
      "100": "#F7FAFC"
    },
    "background": {
      "DEFAULT": "#FFFFFF",
      "secondary": "#F7FAFC",
      "accent": "#D5F5E3"
    }
  },
  "typography": {
    "fontFamily": {
      "primary": ["Manrope", "system-ui", "sans-serif"],
      "heading": ["Outfit", "sans-serif"],
      "mono": ["JetBrains Mono", "monospace"]
    },
    "fontSize": {
      "h1": ["3rem", { "lineHeight": "1.1", "fontWeight": "700" }],
      "h2": ["2.25rem", { "lineHeight": "1.2", "fontWeight": "700" }],
      "h3": ["1.75rem", { "lineHeight": "1.25", "fontWeight": "600" }],
      "h4": ["1.5rem", { "lineHeight": "1.3", "fontWeight": "600" }],
      "h5": ["1.25rem", { "lineHeight": "1.4", "fontWeight": "600" }],
      "h6": ["1.125rem", { "lineHeight": "1.4", "fontWeight": "500" }],
      "body": ["1rem", { "lineHeight": "1.6", "fontWeight": "400" }],
      "bodySm": ["0.875rem", { "lineHeight": "1.5", "fontWeight": "400" }],
      "small": ["0.75rem", { "lineHeight": "1.4", "fontWeight": "400" }]
    }
  },
  "borderRadius": {
    "none": "0",
    "sm": "4px",
    "DEFAULT": "8px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "2xl": "20px",
    "full": "9999px"
  },
  "boxShadow": {
    "sm": "0 1px 3px rgba(46, 204, 113, 0.08)",
    "DEFAULT": "0 4px 12px rgba(46, 204, 113, 0.12)",
    "md": "0 4px 12px rgba(46, 204, 113, 0.12)",
    "lg": "0 8px 24px rgba(30, 132, 73, 0.15)",
    "xl": "0 12px 32px rgba(30, 132, 73, 0.18)"
  },
  "icons": {
    "style": "line",
    "strokeWidth": "1.5px",
    "library": ["Phosphor Icons", "Lucide", "Heroicons"],
    "accentStyle": "duotone"
  },
  "mood": [
    "biotecnologia",
    "vitalidade", 
    "confiança",
    "inovação",
    "clareza",
    "orgânico",
    "precisão",
    "modernidade",
    "saúde",
    "premium"
  ]
}
```

---

### Exemplo de aplicação Tailwind

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        passagene: {
          primary: '#2ECC71',
          'primary-dark': '#1E8449',
          'primary-light': '#82E0AA',
          'primary-subtle': '#D5F5E3',
          accent: '#27AE60',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      }
    }
  }
}
```

Regras obrigatórias:
- Use SOMENTE as cores, fonts, radii, shadows etc. definidas ali
- Converta tudo para CSS variables no Tailwind (ex: --primary, --primary-foreground)
- Preserve lógica de negócio, hooks, server components
- Edite componentes existentes (não crie duplicatas)