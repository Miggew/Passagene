# PassaGene Design System v2.0

> **Fonte única de verdade** para toda decisão visual do app.
> Qualquer dev ou agente IA deve seguir este guia. Nenhuma outra referência de design é válida.

---

## 1. Filosofia

### Regra de Ouro: MENOS É MAIS
- **Proibido**: glows, stripes, dots, gradients, blur, animate-ping, decorações excessivas
- Verde como acento pontual, **nunca dominante**
- Cards limpos e funcionais — a informação é o protagonista
- A marca é **biológica e orgânica**, não mecânica — evitar cantos vivos e rigidez visual

### UX Writing
- Tom: **Profissional, mas próximo** — como um geneticista explicando algo para um amigo
- Mensagens humanizadas:
  - ✅ "Análise genética concluída!"
  - ❌ "Dados processados com sucesso."
  - ✅ "Tivemos um problema. Tente novamente."
  - ❌ "Erro 500."
- Textos **sempre em Português do Brasil**

---

## 2. Paleta de Cores

### Brand (extraído dos vetores originais da logo)
| Token | Hex | Uso |
|-------|-----|-----|
| brand | `#09C972` | Cor exata da logo — ícone de marca, splash, marketing |
| brand-deep | `#049357` | Verde profundo da logo — hovers de destaque |

### Primary (escala UI derivada do brand)
| Token | Hex | Uso |
|-------|-----|-----|
| primary-50 | `#f0f9f4` | Backgrounds sutis, hover states |
| primary-100 | `#daf1e4` | Badges default, backgrounds leves |
| primary-200 | `#b8e3cb` | Borders de foco |
| primary-300 | `#89ceaa` | Decorativos |
| primary-400 | `#57b584` | Ícones ativos, indicadores |
| primary-500 | `#3d9e6b` | **Cor principal UI** — botões, links |
| primary-600 | `#3a8a5e` | Hover de botões |
| primary-700 | `#2d6e4a` | Texto primary sobre fundo claro |
| primary-800 | `#27583d` | Headings fortes |
| primary-900 | `#1e4732` | Backgrounds escuros |
| primary-950 | `#0d2a1c` | Sidebar background |

### Accent (Dourado Âmbar — complementar)
| Token | Hex | Uso |
|-------|-----|-----|
| accent-50 | `#fefce8` | Backgrounds warning suaves |
| accent-100 | `#fef9c3` | Badges accent |
| accent-200 | `#fef08a` | Borders accent |
| accent-400 | `#facc15` | Indicadores, destaques |
| accent-500 | `#eab308` | **Cor accent principal** |
| accent-600 | `#ca8a04` | Botões accent, texto accent |
| accent-700 | `#a16207` | Texto accent escuro |

### Neutral (Slate)
Usar a escala Tailwind `slate` padrão: slate-50 até slate-950.

### Surfaces (fundos com identidade de marca)
| Contexto | Valor | Nota |
|----------|-------|------|
| Light background | `#F2FBF7` | Off-white com tint verde — **nunca branco puro** |
| Dark background | `#051F15` | Preto-verde profundo — **nunca preto puro** |
| Card light | `#FFFFFF` | Branco puro apenas em cards (contraste com bg) |
| Card dark | CSS var `--card` | Definido no tema escuro |

### Semânticas
| Tipo | Light | Base | Dark | Uso |
|------|-------|------|------|-----|
| Success | `#dcfce7` | `#22c55e` | `#16a34a` | Confirmações, aprovações |
| Danger | `#fee2e2` | `#ef4444` | `#dc2626` | Erros, exclusões, alertas |
| Warning | `#fef3c7` | `#f59e0b` | `#d97706` | Avisos, prazos próximos |
| Info | `#dbeafe` | `#3b82f6` | `#2563eb` | Informações, processamento |

### Cores de Status (Regras de Negócio)
Mapeamento fixo usado em StatusBadge, CountBadge e ResultBadge:

| Status | Cor Tailwind |
|--------|-------------|
| VAZIA | red |
| PRENHE | green |
| PRENHE_RETOQUE | amber |
| PRENHE_FEMEA | pink |
| PRENHE_MACHO | blue |
| PRENHE_2_SEXOS | indigo |
| PRENHE_SEM_SEXO | purple |
| SERVIDA, UTILIZADA | violet |
| CONGELADO | cyan |

**Padrão universal de badge**: `bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/30`

---

## 3. Tipografia

### Fontes
- **Headings + Body**: `Plus Jakarta Sans` (geométrica humanista, compatível com a logo)
- **Monospace**: `JetBrains Mono` (IDs, códigos, valores numéricos)

### Escala Tipográfica
| Elemento | Tamanho | Peso | Tailwind |
|----------|---------|------|----------|
| Page Title | 22px | 800 (ExtraBold) | `text-[22px] font-extrabold tracking-tight` |
| H2 | 18px | 700 (Bold) | `text-lg font-bold` |
| H3 | 16px | 700 (Bold) | `text-base font-bold` |
| H4 / Label | 14px | 600 (Semibold) | `text-sm font-semibold` |
| Body | 14px | 400 (Regular) | `text-sm` |
| Caption | 13px | 500 (Medium) | `text-[13px] font-medium` |
| Small | 12px | 400 | `text-xs` |
| Tiny | 11px | 500 | `text-[11px] font-medium` |
| Mono Data | 12-14px | 500 | `font-mono text-sm font-medium` |

### Regras
- Line-height body text: `leading-relaxed` (1.625)
- Letter-spacing headings grandes: `tracking-tight` (-0.025em)
- Letter-spacing labels uppercase: `tracking-wider` (0.05em)

---

## 4. Espaçamento

Usar **múltiplos de 4px** via classes Tailwind:

| Nome | Classe | Valor | Uso |
|------|--------|-------|-----|
| xs | `p-1` | 4px | Padding mínimo interno |
| sm | `p-2` | 8px | Gap entre label e input |
| md | `p-4` | 16px | Padding de seções internas |
| lg | `p-6` | 24px | Padding de cards, gap entre seções |
| xl | `p-8` | 32px | Padding de página desktop |
| 2xl | `p-12` | 48px | Espaçamento generoso |

### Regras de layout
- **Entre seções de página**: `space-y-6` (24px)
- **Dentro de seções**: `space-y-4` (16px)
- **Label → Input**: `space-y-2` (8px)
- **Gap em grid/flex**: `gap-3` (12px) a `gap-4` (16px)
- **Padding de página**: `p-4` mobile, `p-8` desktop

---

## 5. Componentes

### Botões (shadcn/ui Button)
- **border-radius**: `rounded-lg` (8px)
- **font-weight**: `font-semibold` (600)
- **Interação**: `active:scale-[0.98]` + `transition-all duration-200`
- **Com ícone**: Lucide React à esquerda, `gap-2`
- **Variantes:**
  - `primary`: bg-primary-600, text-white, hover bg-primary-700, shadow-sm
  - `secondary`: bg-white, text-primary-700, border border-primary-300, hover bg-primary-50
  - `accent`: bg-accent-500, text-white, hover bg-accent-600
  - `ghost`: bg-transparent, text-slate-600, hover bg-slate-100
  - `outline`: bg-transparent, text-slate-700, border border-slate-300, hover bg-slate-50
  - `danger`: bg-red-500, text-white, hover bg-red-600
- **Tamanhos**: sm (py-1.5 px-3.5), md (py-2.5 px-5), lg (py-3 px-6)

### Cards (shadcn/ui Card)
- **border-radius**: `rounded-xl` (12px)
- **border**: `border border-slate-200` (light) / `border-border` (dark)
- **shadow**: `shadow-sm` padrão, `shadow-lg` no hover
- **hover**: `hover:-translate-y-0.5 transition-all duration-200`
- **Variante accent**: barra sólida de 3px no topo com `bg-primary-500`
- **padding**: `p-5` (20px) padrão
- **Card mobile**: `rounded-xl border border-border/60 bg-card shadow-sm p-3.5`

### Badges (Sistema Unificado)
Três componentes especializados:
- **StatusBadge**: status de receptoras/protocolos/embriões (89 mapeamentos)
- **CountBadge**: contagens numéricas com variantes de cor (11 variantes)
- **ResultBadge**: resultados DG/Sexagem/TE/Classificação

Specs:
- **border-radius**: `rounded-md` (6px)
- **font**: `text-[11px] font-semibold`
- **Padrão CSS**: `bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/30`
- **Variantes**: default (primary), accent, danger, success, warning, info, neutral, outline

### Inputs (shadcn/ui Input)
- **border-radius**: `rounded-lg` (8px)
- **border**: `border-1.5 border-slate-300`
- **focus**: `focus:border-primary-400 focus:ring-2 focus:ring-primary-500/8`
- **error**: `border-red-500 focus:ring-red-500/8`
- **Com ícone**: Lucide React à esquerda, cor slate-400
- **Altura**: `h-11` (44px) mobile → `h-9` (36px) desktop

### Tabelas
- **Container**: `rounded-xl border border-slate-200 overflow-hidden`
- **Header**: `bg-slate-50`, texto `uppercase text-[11px] font-semibold tracking-wider text-slate-500`
- **Rows**: zebra com `odd:bg-white even:bg-slate-50`
- **Hover row**: `hover:bg-primary-50`
- **IDs**: `font-mono text-xs font-medium text-primary-600`
- **Status**: usar Badge com variante semântica

#### CSS Grid — Armadilha Conhecida
`overflow-x-auto` + `minmax(X,1fr)` = colunas travadas no mínimo.

**100% largura (sem scroll):**
```tsx
<div className="rounded-lg border border-border">
  <div className="grid grid-cols-[2fr_16px_1.2fr_1.8fr]">
```

**Scroll horizontal:**
```tsx
<div className="overflow-x-auto">
  <div className="min-w-[750px]">
    <div className="grid grid-cols-[160px_36px_90px_100px]">
```

**Centralização**: Usar `flex justify-center`, não `text-center`.

### Alertas
- **border-radius**: `rounded-xl` (12px)
- **Layout**: ícone + título + mensagem
- **border-left**: `border-l-[3px]` com cor semântica
- **background**: cor semântica light
- **Variantes**: success, warning, danger, info

### Ícones
- **Biblioteca**: Lucide React — SEMPRE
- **Stroke**: `strokeWidth={1.5}` ou `{2}` (traços arredondados, combina com identidade orgânica)
- **Tamanho padrão**: `size-4` (16px) em botões, `size-5` (20px) standalone
- **NUNCA** usar emojis — sempre ícones Lucide

### Loading & Empty States

**Loading principal — DNA Wave** (`<LoadingSpinner />`):
- Silhueta do escudo PassaGene (3 frames a 15% opacidade constante)
- 6 marks (barras diagonais da logo) pulsam em onda do canto superior-direito → inferior-esquerdo
- Animação: `dna-wave` 2.4s ease-in-out infinite, delays escalonados (0.12s → 1.00s)
- Tamanho padrão: 48px. Cores brand: `#09C972` (topo) + `#049357` (base)
- Keyframes e classes `.dna-wave .dna-m*` definidos em `index.css`
- Quando `className` é passado (uso inline, e.g. dentro de botões), cai pra `Loader2` do Lucide

**Skeletons**: usar `Skeleton` do shadcn/ui para placeholders de conteúdo

**Empty state**: borda tracejada, centralizado, ícone + título + descrição + ação opcional

---

## 6. Navegação

### Sidebar (Desktop)
- **Background**: `bg-slate-950`
- **Largura**: 220px expandida, 60px colapsada
- **Logo**: PassaGene com ícone + texto no topo
- **Item ativo**: `bg-primary-500/15 border-l-2 border-primary-400`
- **Item hover**: `bg-white/4`
- **Texto ativo**: `text-white font-semibold`
- **Texto inativo**: `text-white/50 font-normal`
- **Ícones**: Lucide React (LayoutDashboard, Dna, Store, Brain, DollarSign, FileText, Users, Settings)
- **Footer**: Avatar com iniciais + nome/role

### Top Bar
- **Background**: `bg-white border-b border-slate-200`
- **Altura**: 52-60px
- **Elementos**: toggle sidebar | busca (⌘K) | notificações | data

### Mobile Bottom Nav
- **Altura**: 80px + safe-area-bottom (iOS notch)
- **Touch targets**: mínimo 44px (h-11)
- **Hub-aware**: mostra rotas relevantes do hub ativo
- **Ícones**: 20px + label de 1 linha

---

## 7. Dark Mode

### Estratégia
- Toggle via classe `dark` no `<html>` (Tailwind `darkMode: ["class"]`)
- CSS variables em `:root` e `.dark` para todas as cores semânticas
- Usar `bg-muted`, `text-foreground`, `border-border` — **nunca hardcodar cores por modo**

### Surfaces
- **Background**: `#051F15` (preto-verde, nunca preto puro)
- **Card / Muted**: via CSS variables (`--card`, `--muted`)

### Regras
- `muted-foreground` em dark deve ter **≥70% lightness** para legibilidade
- Shadows com green tint precisam de opacidade maior em dark mode
- Badges mantêm o padrão `dark:text-[cor]-400` automaticamente
- **NUNCA** usar `text-green-600` etc. direto — sempre `text-primary` ou CSS var

---

## 8. Responsividade & Mobile

### Dual-Layout Pattern
- **Mobile** (`md:hidden`): cards empilhados, full width
- **Desktop** (`hidden md:block`): tabelas com CSS Grid
- Touch targets: `h-11 md:h-9`, inputs `w-full md:w-[Xpx]`

### Breakpoints
| Token | Largura | Uso |
|-------|---------|-----|
| `sm` | 640px | Telefones landscape |
| `md` | 768px | **Ponto de quebra principal** — tablets |
| `lg` | 1024px | Desktops pequenos |
| `xl` | 1280px | Desktops |

### Padding de Página
- Mobile: `p-4` (16px) + `pb-24` (96px, clearance do bottom nav)
- Desktop: `p-8` (32px)

### Filtros (padrão mobile-friendly)
- Container: `rounded-xl border border-border bg-card p-4`
- Layout: `flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6`
- Indicador lateral: `w-1 h-6 rounded-full bg-[cor]/40`

---

## 9. Módulo Cliente (Acessibilidade Reforçada)

Público-alvo: **usuários idosos com vista ruim e pouca intimidade com tecnologia**.

### Regras Obrigatórias
- Fontes mínimas: `text-xs` (12px) para labels, `text-base` (16px) para nomes/valores
- Touch targets: **44px** (h-11) — sem exceção
- Vocabulário simplificado, sem jargão técnico
- Mobile-first: cards + filtros simples, sem tabelas complexas

### Navegação
```
Home | Rebanho | Serviços | Botijão
```

---

## 10. Stat Cards (Dashboard)

- **Layout**: Label (caption) + Valor (grande) + Variação (seta ▲/▼)
- **Ícone**: canto superior direito, `bg-primary-50 rounded-lg`
- **Valor**: `text-[28px] font-extrabold tracking-tight`
- **Variação positiva**: `text-green-600` com ▲
- **Variação negativa**: `text-red-500` com ▼
- **Hover**: `hover:shadow-lg hover:-translate-y-0.5`
- **Grid**: 4 cols desktop (`lg`), 2 cols tablet (`md`), 1 col mobile (`sm`)

---

## 11. Regras Gerais

### Obrigatórias
1. **NUNCA** usar cores inline (`style={{ color: "..." }}`). SEMPRE classes Tailwind.
2. **NUNCA** usar emojis no app. SEMPRE Lucide React icons.
3. **NUNCA** cantos vivos (`rounded-none`, `rounded-sm`). A marca é biológica.
4. **SEMPRE** manter consistência: todos os cards mesmos radius e sombras.
5. **SEMPRE** espaçamento em múltiplos de 4px.
6. **SEMPRE** textos em Português do Brasil.
7. **SEMPRE** usar shadcn/ui como base, customizando via variantes.
8. **SEMPRE** usar CSS variables para dark mode.

### Padrões de Interação
- Hover em cards: elevar com shadow + translate
- Hover em rows de tabela: mudar background
- Focus em inputs: ring com cor primary
- Transições: `transition-all duration-200` padrão
- Loading states: Skeleton do shadcn/ui

---

## 12. Configuração Tailwind

```ts
// tailwind.config.ts — theme.extend
{
  colors: {
    brand: '#09C972',  // Cor exata da logo
    primary: {
      50: '#f0f9f4', 100: '#daf1e4', 200: '#b8e3cb', 300: '#89ceaa',
      400: '#57b584', 500: '#3d9e6b', 600: '#3a8a5e', 700: '#2d6e4a',
      800: '#27583d', 900: '#1e4732', 950: '#0d2a1c',
    },
    accent: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
      400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
      800: '#854d0e', 900: '#713f12', 950: '#422006',
    },
  },
  fontFamily: {
    sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
    mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  },
}
```

---

## 13. Elementos Disruptivos (Orgânicos e de Alta Performance)

Para quebrar a dureza "mecânica" das interfaces tradicionais, o PassaGene utiliza 3 padrões não-convencionais e de alto desempenho que mimetizam propriedades biológicas. Estes padrões **substituem** soluções quadradas ou estáticas em futuras refatorações estéticas.

### 13.1 Membrana Curva (Menu/Navegação)
- **O que é**: Evitar barras de navegação (Bottom Nav Mobile ou Sidebar Desktop) perfeitamente retas. Uma "vala" ou "barriga" suave deforma a barra para abraçar a principal Ação Flutuante (FAB).
- **Como implementar**: Usar um `<svg>` com fundo opaco preenchendo o espaço (ex: `fill-white dark:fill-card`) com filtro `drop-shadow`.
- **Custo de Performance**: **ZERO GPU/CPU**. É uma ilusão de ótica estática gerada uma única vez pelo navegador.
- **Caso de uso**: `MobileNav` (app celular) e menus principais isolados.

### 13.2 Botão "Mitose" de Ação (Apenas CSS)
- **O que é**: Ao clicar no Botão de Ação Principal (FAB), em vez de um menu seco, bolhas menores "deslizam" de dentro dele esticando uma membrana (linha de ligação) invisível como uma célula se dividindo. 
- **Como implementar**: **NUNCA usar SVG Filters (`feColorMatrix` ou `goo`).** Construir exclusivamente com `transform: scale()`, `translate()` e `opacity` do CSS Tailwind com tempos em cascata (`delay-75`, `delay-150`). As propriedades de curvatura e estiramento são ilusões de escala no CSS.
- **Custo de Performance**: **Extremamente Baixo**. Os navegadores aceleram as propriedades `transform` na placa gráfica do celular, rodando a 60FPS num piscar de olhos sem exigir da bateria.
- **Caso de uso**: Inserção rápida de dados essenciais (ex: Botão Central para "Transferir Embrião", "Novo Animal").

### 13.3 Fecho Ecler Dinâmico "Dupla Hélice" (Listas Animadas)
- **O que é**: Uma Timeline vertical onde as células (cards) não descem do topo, mas sim cruzam animadas dos lados esquerdo e direito simulando os degraus (bases nitrogenadas) de uma dupla-hélice de DNA conectando-se na espinha dorsal.
- **Como implementar**: Usar transição CSS (`transition-all duration-700 delay-[staggered]`) mesclada a `translate-x` reversos dependendo se o item é par ou ímpar (side `left`/`right`). A linha central vertical deve ter propriedades gradientes.
- **Custo de Performance**: **Seguro e leve**. Depende de CSS Transforms acionados apenas na montagem da tela (`mount`).
- **Caso de uso**: Páginas de Históricos longos (Histórico de Vida do Animal, Protocolo FIV de uma Doadora, Etapas de um Lote).

> **Aviso de Performance Geral:** Efeitos de intersecção complexa com embaçamento e "Blobs" constantes na membrana geométrica (ex: `animate-blob` deformando `border-radius` em milisegundos) foram **testados e REPROVADOS** para telas múltiplas por fritarem o processador de celulares antigos. Limite os blobs a casos excepcionais, muito contidos. No dia a dia, use apenas as 3 regras acima.
