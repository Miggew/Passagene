# PassaGene Design System v3.0

> **Fonte unica de verdade** para toda decisao visual do app.
> Qualquer dev ou agente IA deve seguir este guia. Nenhuma outra referencia de design e valida.

---

## 1. Filosofia & Identidade

### Principio Central
> **"Precisao de laboratorio, prestigio de leilao."**

O PassaGene e onde a ciencia genetica encontra o topo do agronegocio brasileiro. Cada pixel deve transmitir: **competencia tecnica** e **valor economico**.

### As 5 Regras de Ouro

1. **Consistencia acima de decoracao** — Um componente, um estilo. Zero excecoes por pagina.
2. **Informacao e o protagonista** — Efeitos existem para hierarquizar, nunca para enfeitar.
3. **Verde = Ciencia, Dourado = Valor** — A intensidade do dourado sobe em contextos de negocio.
4. **Animacoes com proposito** — Cada animacao comunica algo (loading, transicao, feedback). Nenhuma e cosmetica.
5. **AI-first** — A Genia e o centro. Tudo converge para a experiencia conversacional.

### Tom de Voz (UX Writing)
- **Profissional mas proximo** — como um geneticista que tambem entende de negocios
- Textos sempre em **Portugues do Brasil**
- Nunca jargao tecnico sem contexto
- Numeros sempre formatados (1.250, nao 1250)

---

## 2. Paleta de Cores

### Brand (DNA da Logo)
| Token | Hex | Papel |
|-------|-----|-------|
| `brand` | `#09C972` | Cor exata da logo — splash, marketing, icone |
| `brand-deep` | `#049357` | Verde profundo da logo — hovers de destaque |

### Green (Ciencia — o lado Lab)
| Token | Hex | Uso |
|-------|-----|-----|
| `green-50` | `#EEFBF4` | Backgrounds sutis, hover states |
| `green-100` | `#D7F5E5` | Badges leves, tags |
| `green-200` | `#B3EBD0` | Borders de foco |
| `green-300` | `#7ADCB0` | Decorativos, indicadores |
| `green-400` | `#3EC98A` | Icones ativos |
| `green-500` | `#1A7A50` | **Cor principal UI** — botoes primarios, links |
| `green-600` | `#156842` | Hover de botoes |
| `green-700` | `#105434` | Texto primary sobre fundo claro |
| `green-800` | `#0C4229` | Headings fortes |
| `green-900` | `#08311E` | Backgrounds de sidebar/nav |
| `green-950` | `#041A10` | Background dark mode |

### Gold (Valor — o lado Elite)
| Token | Hex | Uso |
|-------|-----|-----|
| `gold-50` | `#FDF8ED` | Backgrounds accent suaves |
| `gold-100` | `#FAF0D4` | Badges premium |
| `gold-200` | `#F4DFA8` | Borders douradas |
| `gold-300` | `#ECCC73` | Indicadores, destaques |
| `gold-400` | `#D4A24C` | **Cor accent principal** — CTAs secundarios, destaques de valor |
| `gold-500` | `#B8862E` | Texto accent, icones premium |
| `gold-600` | `#96691E` | Hover de accent |
| `gold-700` | `#745016` | Texto accent escuro |
| `gold-800` | `#5A3E11` | Labels de destaque |
| `gold-900` | `#3D2A0B` | Backgrounds accent dark |

### Neutral (Slate)
Escala Tailwind `slate` padrao (slate-50 a slate-950). Sem customizacao.

### Surfaces
| Contexto | Light | Dark |
|----------|-------|------|
| Background | `#F7FAF8` (off-white com tint verde) | `#080B0A` (quase-preto organico) |
| Card | `#FFFFFF` | `var(--bg-card)` |
| Card hover | `#F0F4F1` | `var(--bg-card-hover)` |
| Subtle | `#E8EDE9` | `var(--bg-subtle)` |
| Elevated | glass-panel (backdrop-blur) | glass-panel (backdrop-blur) |

### Semanticas (Status do Sistema)
| Tipo | Light bg | Base | Dark text |
|------|----------|------|-----------|
| Success | `#dcfce7` | `#22c55e` | `#16a34a` |
| Danger | `#fee2e2` | `#ef4444` | `#dc2626` |
| Warning | `#fef3c7` | `#f59e0b` | `#d97706` |
| Info | `#dbeafe` | `#3b82f6` | `#2563eb` |

### Cores de Status (Regras de Negocio — fixas)
| Status | Cor |
|--------|-----|
| VAZIA | red |
| PRENHE | green |
| PRENHE_RETOQUE | amber |
| PRENHE_FEMEA | pink |
| PRENHE_MACHO | blue |
| PRENHE_2_SEXOS | indigo |
| PRENHE_SEM_SEXO | purple |
| SERVIDA, UTILIZADA | violet |
| CONGELADO | cyan |

### Regra de Intensidade do Dourado
- **Modulos tecnicos** (embrioes, protocolos, lab): green como primary, gold ausente ou minimo
- **Modulos de negocio** (dashboard, clientes, vendas, perfil): gold aparece em headers, CTAs, badges premium
- **Genia**: fusao — green na estrutura, gold nos highlights de valor (precos, metricas, recomendacoes)

---

## 3. Tipografia

### Fontes
| Papel | Fonte | Por que |
|-------|-------|---------|
| **Display + Body** | `Outfit` | Geometrica moderna, pesos variados (300-800), leitura excelente em tela |
| **Dados + Codigo** | `JetBrains Mono` | Monospace premium, alinhamento tabular perfeito para IDs, valores, scores |

### Escala Tipografica

| Elemento | Tamanho | Peso | Tailwind | Quando usar |
|----------|---------|------|----------|-------------|
| Display | 32px | 800 | `text-[32px] font-extrabold tracking-tight` | Hero da Genia, numero principal de dashboard |
| Page Title | 24px | 700 | `text-2xl font-bold tracking-tight` | Titulo de cada pagina |
| H2 | 18px | 700 | `text-lg font-bold` | Titulo de secao dentro de pagina |
| H3 | 16px | 600 | `text-base font-semibold` | Subtitulo, titulo de card |
| Body | 14px | 400 | `text-sm` | Texto corrido, descricoes |
| Body Strong | 14px | 600 | `text-sm font-semibold` | Labels de formulario, enfase inline |
| Caption | 13px | 500 | `text-[13px] font-medium` | Metadata, timestamps, hints |
| Small | 12px | 400 | `text-xs` | Texto auxiliar, footnotes |
| Tiny | 11px | 600 | `text-[11px] font-semibold` | Badges, tags, contadores |
| Mono Data | 14px | 500 | `font-mono text-sm font-medium` | IDs, valores monetarios, scores, contagens |
| Mono Small | 12px | 500 | `font-mono text-xs font-medium` | IDs em tabelas, codigos curtos |

### Regras de Tipografia

**Espacamento:**
- Headings (Display, Page Title, H2): `tracking-tight` (-0.025em)
- Labels uppercase: `tracking-wider` (0.05em) + `uppercase`
- Body text: `leading-relaxed` (1.625)

**Hierarquia por cor:**
- Titulos: `text-foreground` (maximo contraste)
- Body: `text-foreground` ou `text-secondary`
- Auxiliar: `text-muted`
- Desabilitado: `text-muted/50`

**Numeros e dados financeiros:**
- Sempre `font-mono` para alinhamento tabular
- Valores monetarios: `font-mono font-semibold` + formatacao BR (R$ 1.250,00)
- Scores/porcentagens: `font-mono font-bold` com cor semantica

**Regra do dourado na tipografia:**
- Valores financeiros em contextos de negocio podem usar `text-gold-500` (dark) / `text-gold-600` (light)
- Nunca usar gold em body text corrido — apenas em dados numericos de valor

---

## 4. Espacamento, Layout & Grid

### Escala de Espacamento (multiplos de 4px)

| Token | Classe | Valor | Uso |
|-------|--------|-------|-----|
| 2xs | `1` | 4px | Padding minimo, gap entre icone e texto |
| xs | `1.5` | 6px | Padding interno de badges/tags |
| sm | `2` | 8px | Gap label-input, padding de inputs compactos |
| md | `3` | 12px | Gap entre itens em lista, padding de celulas |
| lg | `4` | 16px | Padding de cards mobile, gap entre componentes |
| xl | `5` | 20px | Padding de cards desktop |
| 2xl | `6` | 24px | Gap entre secoes, padding de containers |
| 3xl | `8` | 32px | Padding de pagina desktop |
| 4xl | `12` | 48px | Espacamento generoso entre blocos maiores |

### Regras de Layout

**Pagina:**
- Mobile: `px-4 pt-4 pb-24` (clearance do bottom nav)
- Desktop: `px-8 pt-6`

**Entre secoes:**
- `space-y-6` (24px) — separacao principal
- `space-y-4` (16px) — dentro de secoes

**Formularios:**
- Label - Input: `space-y-1.5` (6px)
- Entre campos: `space-y-4` (16px)
- Grupos de campos: `space-y-6` (24px)

**Grid de cards:**
```
grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4
```

**Grid de stats:**
```
grid grid-cols-2 lg:grid-cols-4 gap-3
```

### Border Radius (Hierarquia organica)

| Token | Valor | Tailwind | Uso |
|-------|-------|----------|-----|
| sm | 6px | `rounded-md` | Badges, tags, inputs inline |
| md | 10px | `rounded-lg` | Inputs, botoes, dropdowns |
| lg | 14px | `rounded-xl` | Cards, dialogs, alerts |
| xl | 20px | `rounded-2xl` | Containers principais, glass-panels |
| full | 9999px | `rounded-full` | Avatares, pills, FAB |

**Regra**: Nunca `rounded-none` ou `rounded-sm` (2px). A marca e biologica — cantos sempre suavizados.

### Sombras

| Token | Uso | Light | Dark |
|-------|-----|-------|------|
| `shadow-sm` | Cards em repouso | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` |
| `shadow-md` | Cards em hover, dropdowns | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 12px rgba(0,0,0,0.4)` |
| `shadow-lg` | Modals, popovers | `0 8px 24px rgba(0,0,0,0.12)` | `0 8px 24px rgba(0,0,0,0.5)` |
| `shadow-glow-green` | Hover de CTAs primarios | `0 0 20px rgba(9,201,114,0.15)` | `0 0 20px rgba(9,201,114,0.25)` |
| `shadow-glow-gold` | Hover de CTAs premium | `0 0 20px rgba(212,162,76,0.15)` | `0 0 20px rgba(212,162,76,0.25)` |

**Regra de glow**: So em elementos interativos no hover/focus. Nunca em repouso. Nunca em mais de 1 elemento simultaneo por viewport.

### Responsividade

**Breakpoints:**
| Token | Largura | Uso |
|-------|---------|-----|
| `sm` | 640px | Telefones landscape |
| `md` | 768px | **Breakpoint principal** — tablet |
| `lg` | 1024px | Desktop pequeno |
| `xl` | 1280px | Desktop |
| `2xl` | 1400px | Desktop largo |

**Padrao Dual-Layout:**
- Mobile (`md:hidden`): Cards empilhados, full width, touch-first
- Desktop (`hidden md:block`): Tabelas, grids, density maior

**Touch targets:**
- Mobile: `h-11` (44px) — sem excecao
- Desktop: `h-9` (36px) padrao, `h-10` (40px) para acoes principais

---

## 5. Componentes

### Botoes

**Base**: shadcn/ui Button customizado. Todos os botoes:
- `rounded-lg` (10px), `font-bold`, `tracking-tight`
- `transition-all duration-200`
- `focus-visible:ring-2 focus-visible:ring-offset-2`
- Icone a esquerda, `gap-2`

**Variantes:**

| Variante | Estilo | Quando usar |
|----------|--------|-------------|
| `primary` | bg-green-500, text-white, hover bg-green-600, `shadow-sm hover:shadow-glow-green` | Acao principal da pagina (1 por tela) |
| `gold` | bg-gold-400, text-green-950, hover bg-gold-500, `shadow-sm hover:shadow-glow-gold` | CTA premium — vendas, valores, destaque financeiro |
| `secondary` | bg-white, text-green-700, border border-green-200, hover bg-green-50 | Acoes secundarias |
| `ghost` | bg-transparent, text-slate-600, hover bg-slate-100 | Acoes terciarias, toolbars |
| `outline` | bg-transparent, text-slate-700, border border-slate-300, hover bg-slate-50 | Acoes neutras, cancelar |
| `danger` | bg-red-500, text-white, hover bg-red-600 | Excluir, acoes destrutivas |
| `success` | bg-green-500, text-white, hover `shadow-glow-green` | Confirmar, salvar |
| `link` | text-green-600, underline-offset-4, hover underline | Links inline |

**Tamanhos:**

| Size | Altura | Padding | Font | Uso |
|------|--------|---------|------|-----|
| `sm` | h-9 (36px) | px-3.5 | text-sm | Acoes em tabelas, inline |
| `md` | h-10 (40px) | px-5 | text-sm | Padrao |
| `lg` | h-11 (44px) | px-6 | text-base | CTA principal, mobile |
| `icon` | h-10 w-10 | — | — | Botoes so icone |
| `icon-sm` | h-9 w-9 | — | — | Icone em tabelas |

**Regra**: Maximo 1 botao `primary` ou `gold` por viewport. Resto e `secondary`, `ghost` ou `outline`.

### Cards

**Base**: glass-panel com hierarquia clara.

```
rounded-2xl border border-border bg-card shadow-sm
transition-all duration-200
```

**Variantes:**

| Variante | Diferencial | Quando usar |
|----------|-------------|-------------|
| `default` | Base glass-panel | Container generico |
| `interactive` | + `hover:shadow-md hover:-translate-y-0.5 cursor-pointer` | Cards clicaveis (listagens) |
| `stat` | Compacto, valor grande mono + label caption | Metricas de dashboard |
| `accent-green` | `border-l-3 border-l-green-500` | Destaque de modulo lab |
| `accent-gold` | `border-l-3 border-l-gold-400` | Destaque de modulo negocio |

**Padding interno:**
- Mobile: `p-4` (16px)
- Desktop: `p-5` (20px)

**Estrutura interna:**
```
CardHeader  -> p-5 pb-0 (titulo + descricao)
CardContent -> p-5 (conteudo)
CardFooter  -> p-5 pt-0 flex gap-3 (acoes)
```

### Inputs

**Base**: shadcn/ui Input customizado.

```
rounded-lg border border-border bg-card
h-11 md:h-9 px-3 text-sm
transition-all duration-200
focus:border-green-400 focus:ring-2 focus:ring-green-500/10
```

**Estados:**

| Estado | Estilo |
|--------|--------|
| Default | `border-border` |
| Hover | `border-slate-400` |
| Focus | `border-green-400 ring-2 ring-green-500/10` |
| Error | `border-red-500 ring-2 ring-red-500/10` |
| Disabled | `opacity-50 cursor-not-allowed bg-muted` |

**Com icone**: Icone a esquerda, `text-muted`, padding-left aumentado.

**Selects, Textareas, DatePickers**: Mesma base, mesmos estados. Zero variacao.

### Tabelas

**Container:**
```
rounded-xl border border-border overflow-hidden
```

**Header:**
```
bg-muted/50
text-[11px] font-semibold uppercase tracking-wider text-muted
```

**Rows:**
```
border-b border-border/50
hover:bg-green-50 dark:hover:bg-green-950/30
transition-colors duration-150
```

**Celulas de dados:**
- IDs: `font-mono text-xs font-medium text-green-600`
- Valores monetarios: `font-mono font-semibold text-gold-600`
- Status: Badge com variante semantica
- Texto: `text-sm text-foreground`

**Sem zebra** — hover e suficiente para rastreamento visual (padrao Linear).

### Badges (Sistema Unificado)

Tres componentes especializados: **StatusBadge**, **CountBadge**, **ResultBadge**.

**Base:**
```
inline-flex items-center rounded-md
px-2 py-0.5
text-[11px] font-semibold
border
```

**Padrao de cor universal:**
```
bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/20
```

**Variantes de cor:** green, gold, red, amber, blue, indigo, purple, pink, violet, cyan, slate.

**Regra**: Badges sao **informativos**, nunca interativos. Se clicavel, e um Button variant `outline` size `sm`.

### Alertas

```
rounded-xl border-l-[3px] p-4
flex gap-3 items-start
```

| Variante | Border-left | Background | Icone |
|----------|-------------|------------|-------|
| `success` | `border-l-green-500` | `bg-green-50` | `CheckCircle` |
| `warning` | `border-l-amber-500` | `bg-amber-50` | `AlertTriangle` |
| `danger` | `border-l-red-500` | `bg-red-50` | `XCircle` |
| `info` | `border-l-blue-500` | `bg-blue-50` | `Info` |

### Icones

**Estrategia: Icon set custom para conceitos-chave + tipografia no resto.**

**Icones Custom PassaGene** (~15 icones a criar):

| Conceito | Contexto |
|----------|----------|
| Embriao | Classificacao, TE, EmbryoScore |
| Doadora | Listagem, perfil, aspiracao |
| Receptora | Listagem, protocolo, DG |
| DNA / Genetica | Modulo genetico, helix |
| Lote FIV | Listagem de lotes |
| Aspiracao | Hub lab |
| Transferencia | Hub lab |
| Botijao | Criopreservacao |
| Genia (IA) | Chat, FAB, assistente |
| Fazenda | Perfil, filtros |
| Touro | Reprodutor, genetica |
| Prenhez | DG, status |
| Score | EmbryoScore, qualidade |
| Relatorio | Exports, PDFs |
| Protocolo | Sincronizacao |

**Specs dos icones custom:**
- **Grid**: 24x24px (design), renderizado em 16/20/24px
- **Stroke**: 1.75px (consistente com identidade organica)
- **Estilo**: Linhas arredondadas, biologico/organico, sem cantos vivos
- **Cor**: Herda `currentColor` — nunca cor fixa no SVG
- **Formato**: SVG como componente React

**Icones utilitarios (Lucide como fallback temporario):**
- Apenas para acoes genericas: fechar (X), seta, chevron, busca, menu, check, plus, minus, copy, download
- Marcados internamente como `[PLACEHOLDER]` para substituicao futura

**Onde NAO usar icones:**
- Headers de pagina — tipografia forte e suficiente
- Labels de formulario — texto e mais claro
- Itens de menu quando o texto e autoexplicativo
- Badges — cor e texto bastam

### Loading & Empty States

**LoaderDNA (loading principal):**
- 7-dot DNA double helix animado
- Tamanho padrao: 64px
- Variantes: `default` (green), `accent` (green bg), `premium` (gradient)
- Uso: Loading de pagina, operacoes longas (>500ms)

**Skeleton (loading de conteudo):**
- shadcn/ui Skeleton, `rounded-lg`
- Replica o layout do conteudo real
- Animacao `pulse` padrao

**Empty State:**
```
rounded-xl border-2 border-dashed border-border/60
p-8 text-center
flex flex-col items-center gap-3
```
Icone (`size-10 text-muted/40`) + Titulo (`font-semibold`) + Descricao (`text-muted text-sm`) + Acao opcional (Button `secondary`)

---

## 6. Navegacao & Estrutura

### Arquitetura de Navegacao

O app e **AI-first**. A Genia e o destino padrao. A navegacao existe para acessar as ferramentas de suporte.

```
+---------------------------------------------+
|  TopBar (fixa, glass-panel)                 |
+----------+----------------------------------+
|          |                                  |
| Sidebar  |     Conteudo da pagina           |
| (desktop)|                                  |
|          |                                  |
+----------+----------------------------------+
|  MobileNav (bottom, so mobile)              |
+---------------------------------------------+
```

### TopBar

```
sticky top-0 z-50
h-14 (56px)
glass-panel border-b border-border
px-4 md:px-6
flex items-center justify-between
```

**Elementos:**

| Posicao | Desktop | Mobile |
|---------|---------|--------|
| Esquerda | Logo PassaGene (DNA + texto) | Logo PassaGene (DNA so) |
| Centro | — (limpo) | — |
| Direita | Badge de analises + Avatar dropdown | Badge de analises + Avatar |

**Avatar dropdown:**
- Saudacao com nome
- Toggle dark/light mode
- Perfil
- Logout

**Regras:**
- TopBar e **sempre** glass-panel — consistencia absoluta
- Nenhum icone de navegacao na topbar (navegacao vive na sidebar/bottom nav)
- Nenhuma busca na topbar — a Genia e a busca

### Sidebar (Desktop — lg+)

```
fixed left-0 top-14
w-[220px] (expandida) / w-[60px] (colapsada)
h-[calc(100vh-56px)]
bg-green-950 dark:bg-green-950
border-r border-white/5
transition-all duration-300
```

**Itens de navegacao:**

```
flex items-center gap-3
px-3 h-10 rounded-lg
text-sm font-medium
transition-all duration-150
```

| Estado | Estilo |
|--------|--------|
| Inativo | `text-white/50` |
| Hover | `text-white/80 bg-white/5` |
| Ativo | `text-white font-semibold bg-green-500/15 border-l-2 border-l-green-400` |

**Estrutura da sidebar:**
```
Navegacao:
  * Genia (IA)        <- destaque, sempre primeiro
  o Dashboard
  o Lab
  o Campo
  o Escritorio
  o Genetica
  o Financeiro

  ----------------

  o Configuracoes

  Avatar + Nome
  Role
```

**Genia como item especial:**
- Icone custom (nao Lucide)
- Quando ativo: `bg-green-500/20` com `shadow-glow-green` sutil
- Indicador de "online" — dot verde pulsante `animate-pulse`

**Sidebar colapsada** (toggle via botao na topbar ou hover):
- So icones, `w-[60px]`
- Tooltip no hover com nome da secao
- Logo reduzida (so DNA, sem texto)

### MobileNav (Bottom — abaixo de lg)

```
fixed bottom-0 left-0 right-0 z-50
glass-panel border-t border-border
pb-[env(safe-area-inset-bottom)]
```

**Layout:**
```
flex items-center justify-around
h-16 (64px) + safe-area
```

**5 itens maximo:**

| Slot | Item | Icone |
|------|------|-------|
| 1 | Dashboard | Custom |
| 2 | Lab | Custom |
| 3 | **Genia** (centro, destaque) | Custom — maior, elevated |
| 4 | Campo | Custom |
| 5 | Mais... | Lucide `MoreHorizontal` -> sheet com resto |

**Genia no centro (FAB integrado):**
```
-translate-y-2 (elevado acima da barra)
w-12 h-12 rounded-full
bg-green-500 shadow-glow-green
```
Destaque visual: o botao da Genia "sobe" da nav bar, indicando que e o centro do app.

**Item ativo:**
- Cor: `text-green-500`
- Label: `text-[10px] font-semibold`
- Transicao suave de cor

**Item inativo:**
- Cor: `text-muted`
- Label: `text-[10px] font-medium`

**Regras:**
- Touch target: `h-11` (44px) minimo por item
- Sheet "Mais..." contem: Escritorio, Genetica, Financeiro, Configuracoes

### Navegacao entre Hubs

Cada hub (Lab, Campo, Escritorio) tem sub-rotas internas. Dentro de um hub:

```
Tabs com TabsList horizontal (scrollavel em mobile)
rounded-lg bg-muted/50 p-1
```

| Estado | Estilo |
|--------|--------|
| Inativo | `text-muted` |
| Hover | `text-foreground` |
| Ativo | `bg-card text-foreground font-semibold shadow-sm rounded-md` |

Sem sidebar aninhada. Sem breadcrumbs complexos. Tabs bastam.

---

## 7. Genia — A Experiencia Central

A Genia e onde o usuario vive. Nao e uma feature — e **o app**. Todo o design system converge aqui.

### Layout da Tela

```
+-------------------------------------+
|  TopBar (glass-panel)               |
+-------------------------------------+
|                                     |
|         Area de conversa            |
|         (scroll vertical)           |
|                                     |
|  +-----------------------------+    |
|  |  Mensagem do usuario        |    |
|  +-----------------------------+    |
|                                     |
|  +-----------------------------+    |
|  |  Resposta da Genia          |    |
|  |  com rich content           |    |
|  +-----------------------------+    |
|                                     |
+-------------------------------------+
|  Input bar (fixa no bottom)         |
+-------------------------------------+
```

**Container:**
```
flex flex-col h-[calc(100vh-56px)]
bg-background
```

**Area de conversa:**
```
flex-1 overflow-y-auto
px-4 md:px-0
md:max-w-3xl md:mx-auto
py-6 space-y-6
```

Centrada com `max-w-3xl` no desktop (como ChatGPT/Claude). Full-width no mobile.

### Mensagens do Usuario

```
ml-auto max-w-[85%] md:max-w-[70%]
bg-green-500 text-white
rounded-2xl rounded-br-md
px-4 py-3
text-sm
```

Alinhada a direita. Verde solido. Canto inferior direito mais agudo (indica "saiu de mim").

### Respostas da Genia

```
max-w-[90%] md:max-w-[80%]
bg-card border border-border
rounded-2xl rounded-bl-md
px-5 py-4
```

Alinhada a esquerda. Card com borda sutil. Canto inferior esquerdo mais agudo.

**Avatar da Genia** (inline, antes da mensagem):
```
w-7 h-7 rounded-full
bg-green-500/10 border border-green-500/20
flex items-center justify-center
```
Icone custom da Genia dentro.

**Rich Content dentro das respostas:**

| Tipo | Estilo |
|------|--------|
| Texto | `text-sm leading-relaxed text-foreground` |
| Codigo/dados | `font-mono text-xs bg-muted/50 rounded-md px-2 py-1` |
| Tabelas inline | Compactas, `text-xs font-mono`, borders sutis |
| Valores monetarios | `font-mono font-semibold text-gold-500` |
| Metricas/scores | `font-mono font-bold` + cor semantica |
| Links/acoes | `text-green-500 font-medium hover:underline` |
| Cards de resumo | Mini-cards dentro da resposta com `bg-muted/30 rounded-lg p-3` |

**Genia "pensando" (loading):**
```
3 dots pulsando em sequencia
bg-card border border-border rounded-2xl rounded-bl-md
px-5 py-4
```
Dots com `animate-pulse` e delays escalonados (0ms, 150ms, 300ms). Verde com opacidade variavel.

### Input Bar

```
sticky bottom-0
glass-panel border-t border-border
px-4 py-3
md:max-w-3xl md:mx-auto
```

**Campo de input:**
```
flex items-end gap-3
bg-card border border-border rounded-xl
px-4 py-3
min-h-[48px] max-h-[200px]
resize-none
```

Textarea auto-expansivel. Cresce com o conteudo ate `max-h-[200px]`.

**Botao de envio:**
```
self-end
w-10 h-10 rounded-full
bg-green-500 text-white
hover:bg-green-600
transition-all duration-200
disabled:opacity-30
```
Icone de seta. So ativo quando ha texto.

**Botao de voz (VoiceFAB):**
```
self-end
w-10 h-10 rounded-full
bg-card border border-border text-muted
hover:text-foreground hover:border-green-400
```

Quando gravando:
```
bg-red-500 text-white
animate-pulse
shadow-glow com vermelho
```

**Acoes rapidas (acima do input, opcional):**
```
flex gap-2 overflow-x-auto pb-2
scrollbar-none
```

Pills de sugestao:
```
rounded-full border border-border
px-3 py-1.5
text-xs font-medium text-muted
hover:text-foreground hover:border-green-400
transition-all duration-150
```

### Fusao Green + Gold na Genia

| Elemento | Lado |
|----------|------|
| Estrutura (bg, borders, avatar) | **Green** — ciencia, precisao |
| Valores monetarios em respostas | **Gold** — `text-gold-500 font-mono` |
| Metricas de performance/lucro | **Gold** — destaque de valor |
| Dados tecnicos (scores, classificacoes) | **Green** — dados cientificos |
| Recomendacoes de acao | **Green** — botao primary |
| Insights financeiros | **Gold** — badge ou highlight |

**Regra**: O dourado na Genia aparece **dentro do conteudo** (dados de valor), nunca na estrutura (que e verde/neutra).

### Genia em Mobile

Mesma estrutura, ajustes:
- Input bar acima do MobileNav: `bottom-16` (clearance da nav)
- Mensagens: `max-w-[90%]` (mais espaco)
- Sugestoes rapidas: scroll horizontal com snap
- Sem avatar da Genia em mobile (economizar espaco) — diferenciacao por alinhamento e cor basta

---

## 8. Animacoes & Micro-interacoes

### Filosofia

> **Cada animacao comunica algo. Nenhuma e cosmetica.**

Tres categorias: **Feedback**, **Transicao**, **Identidade**. Se nao cabe em nenhuma, nao existe.

### Feedback (resposta a acao do usuario)

| Interacao | Animacao | Spec |
|-----------|----------|------|
| Botao click | Scale down | `active:scale-[0.97]` duration-100 |
| Card hover | Elevar | `hover:-translate-y-0.5 hover:shadow-md` duration-200 |
| Input focus | Ring expand | `ring-2 ring-green-500/10` duration-150 |
| Toggle/Switch | Slide | `transition-transform` duration-200 |
| Toast enter | Slide up + fade | `translate-y-2 -> 0, opacity 0 -> 1` duration-300 |
| Toast exit | Fade out | `opacity 1 -> 0` duration-200 |
| Botao submit (Genia) | Scale pulse | `scale-100 -> 105 -> 100` duration-200 ao enviar |

### Transicao (mudanca de estado/pagina)

| Contexto | Animacao | Spec |
|----------|----------|------|
| Pagina enter | Fade up | `opacity 0->1, translate-y-4->0` duration-300 ease-out |
| Tab switch | Fade cross | Conteudo antigo fade-out, novo fade-in, duration-200 |
| Modal/Dialog open | Scale up + backdrop | `scale-95->100, opacity 0->1` duration-200. Backdrop `bg-black/50` fade-in |
| Modal/Dialog close | Scale down | `scale-100->95, opacity 1->0` duration-150 |
| Sheet (mobile) open | Slide up | `translate-y-full -> 0` duration-300 ease-out |
| Sidebar collapse | Width shrink | `w-[220px] -> w-[60px]` duration-300 |
| Dropdown open | Scale + fade | `scale-95->100, opacity 0->1` from top, duration-150 |
| Skeleton pulse | Opacity loop | `opacity 0.4->1->0.4` duration-1500 infinite |

### Identidade (DNA do PassaGene)

Animacoes que dao personalidade e nao existem em nenhum outro app:

**1. LoaderDNA (Loading principal)**
```
7 dots em formacao de dupla-helice
Rotacao continua: rotate 360 em 1.5s linear infinite
Dots com opacidade escalonada criando efeito de profundidade 3D
```
- Uso: Loading de pagina, operacoes longas (>500ms)
- Tamanhos: `sm` (32px), `md` (64px), `lg` (96px)
- Nunca mais de 1 LoaderDNA visivel por tela

**2. Genia Breathing (idle do bot)**
```
scale: 1 -> 1.03 -> 1
opacity do glow: 0.1 -> 0.2 -> 0.1
duration: 4s ease-in-out infinite
```
- Uso: Icone da Genia na sidebar/nav quando idle
- Comunica: "estou aqui, pronta"
- Para quando a Genia esta respondendo (substitui por loading dots)

**3. Mitose (Acao de expansao)**
```
Elemento central -> sub-elementos "brotam" com:
transform: scale(0) -> scale(1)
translate de dentro pra fora
delays escalonados: 50ms, 100ms, 150ms...
duration: 250ms ease-out cada
```
- Uso: Menu de acoes rapidas, FAB expansion
- Comunica: uma acao gerando multiplas opcoes
- Maximo 5 sub-elementos (mais que isso vira ruido)

**4. Gold Shimmer (Destaque de valor)**
```
background-position: -200% -> 200%
gradient linear: transparent -> gold-400/20 -> transparent
duration: 2s ease-in-out (single play, nao loop)
```
- Uso: Quando a Genia apresenta um valor financeiro relevante, insight de lucro, ou recomendacao premium
- Trigger: Uma vez na montagem do elemento, nao repete
- Sutil — e um brilho que passa, nao uma animacao constante

### Regras Absolutas de Animacao

1. **Durations**: Feedback <=200ms. Transicoes 200-300ms. Identidade livre (mas <=4s loop).
2. **Easing**: `ease-out` para entradas, `ease-in` para saidas, `ease-in-out` para loops.
3. **Reduce motion**: Respeitar `prefers-reduced-motion`. Quando ativo:
   - Feedback: manter (sao funcionais)
   - Transicoes: substituir por fade simples de 150ms
   - Identidade: LoaderDNA vira spinner estatico, breathing/mitose desativados, shimmer desativado
4. **Performance**: So animar `transform` e `opacity` (GPU-accelerated). Nunca `width`, `height`, `margin`, `padding`, `top`, `left`.
5. **Maximo 1 animacao de identidade visivel por viewport**. Se o LoaderDNA esta rodando, nenhum breathing/shimmer/mitose.
6. **Removido do sistema**: `animate-ping`, `animate-bounce`, blobs, gradients animados constantes, parallax. Nao existem no PassaGene.

---

## 9. Dark Mode

### Estrategia

- Toggle via classe `dark` no `<html>` (Tailwind `darkMode: ["class"]`)
- **Todas** as cores via CSS variables — nunca hardcodar hex por modo
- Ambos os modos sao cidadaos de primeira classe — nenhum e "versao degradada"

### Superficies

| Token | Light | Dark | Nota |
|-------|-------|------|------|
| `--bg-primary` | `#F7FAF8` | `#080B0A` | Nunca branco puro, nunca preto puro |
| `--bg-card` | `#FFFFFF` | `#0F1412` | Cards se destacam do fundo |
| `--bg-card-hover` | `#F0F4F1` | `#161D19` | Hover sutil |
| `--bg-subtle` | `#E8EDE9` | `#1A211D` | Areas recuadas, muted sections |
| `--bg-elevated` | glass-panel | glass-panel | TopBar, modals — mesmo efeito |

### Textos

| Token | Light | Dark | Contraste minimo |
|-------|-------|------|------------------|
| `--text-primary` | `#080B0A` | `#F1F5F2` | >=15:1 |
| `--text-secondary` | `#4E5F54` | `#A3B5A9` | >=7:1 |
| `--text-muted` | `#8A9B90` | `#6B7C71` | >=4.5:1 |
| `--text-disabled` | `#B5C0B9` | `#3D4A42` | Decorativo — sem requisito |

### Borders

| Token | Light | Dark |
|-------|-------|------|
| `--border-default` | `#E2E8E4` | `#1E2722` |
| `--border-active` | `#34D399` | `#34D399` |
| `--border-gold` | `#D4A24C` | `#D4A24C` |

Green-dim e gold **nao mudam** entre modos — sao ancoras de identidade.

### Green no Dark Mode

| Token | Light | Dark | Nota |
|-------|-------|------|------|
| `--green-500` | `#1A7A50` | `#34D399` | Inverte: escuro->claro para manter legibilidade |
| Botao primary bg | `#1A7A50` | `#1A7A50` | **Nao inverte** — solido nos dois modos |
| Botao primary hover | `#156842` | `#22916A` | Hover clareia no dark |
| Text green | `#1A7A50` | `#34D399` | Links, IDs, destaques |
| Green bg sutil | `#EEFBF4` | `#0A1F16` | Badges, backgrounds |

### Gold no Dark Mode

| Token | Light | Dark | Nota |
|-------|-------|------|------|
| `--gold-400` | `#D4A24C` | `#D4A24C` | **Nao muda** — dourado brilha mais no escuro naturalmente |
| Text gold | `#96691E` | `#D4A24C` | Clareia para legibilidade |
| Gold bg sutil | `#FDF8ED` | `#1A1508` | Badges, highlights |
| Gold shimmer | `gold-400/20` | `gold-400/15` | Levemente reduzido no dark |

### Componentes — Diferencas por Modo

**Glass Panel:**
```css
/* Light */
background: rgba(255, 255, 255, 0.8);
backdrop-filter: blur(12px);
border: 1px solid var(--border-default);

/* Dark */
background: rgba(15, 20, 18, 0.8);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.06);
```

**Sidebar:**
```
Light: bg-green-950 (escura nos dois modos — ancora visual)
Dark:  bg-green-950
```
A sidebar **nao muda** entre modos. E sempre escura. Cria consistencia e ancora a navegacao.

**Cards:**
```css
/* Light */
bg-card border-border shadow-sm

/* Dark */
bg-card border-white/[0.06] shadow-none
```
No dark mode, cards perdem sombra (nao funciona em fundo escuro) e ganham borda luminosa sutil.

**Badges:**
```
Padrao universal (funciona nos dois modos):
bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/20
```

**Tabelas:**
```css
/* Light */
header: bg-muted/50
row hover: bg-green-50

/* Dark */
header: bg-muted/30
row hover: bg-green-950/50
```

**Inputs:**
```css
/* Light */
bg-card border-border

/* Dark */
bg-card border-white/10
focus: border-green-400 ring-green-400/10
```

### Glow Effects no Dark

Glows ganham **mais presenca** no dark mode:

| Glow | Light | Dark |
|------|-------|------|
| `shadow-glow-green` | `rgba(9,201,114, 0.15)` | `rgba(9,201,114, 0.30)` |
| `shadow-glow-gold` | `rgba(212,162,76, 0.15)` | `rgba(212,162,76, 0.30)` |

Opacidade dobra no dark. O dourado sobre fundo escuro e onde a identidade "elite" mais aparece.

### Regras Absolutas de Dark Mode

1. **Nunca** `text-green-600` direto — sempre `text-green-500 dark:text-green-400` ou CSS var
2. **Nunca** branco puro (#FFF) como background no dark — usar `--bg-card`
3. **Nunca** preto puro (#000) — usar `--bg-primary` com tint verde
4. **Sidebar e imutavel** entre modos — ancora visual
5. **Borders no dark**: `white/[0.06]` para sutil, `white/[0.12]` para enfase
6. **Sombras no dark**: substituir por borders luminosas. `shadow-sm` -> `border border-white/[0.06]`
7. **Testar sempre**: todo componente deve ser verificado nos dois modos antes de merge

---

## 10. Modulo Cliente (Acessibilidade Reforcada)

### Publico-alvo

**Fazendeiros e produtores rurais** — frequentemente:
- Idade 50+, vista cansada
- Pouca intimidade com tecnologia
- Usando celular no campo, com sol forte
- Querem ver seus animais e resultados, nao operar sistemas complexos

### Regras Obrigatorias (sem excecao)

| Regra | Spec | Por que |
|-------|------|---------|
| Fonte minima | `text-base` (16px) para qualquer informacao legivel | Vista cansada |
| Labels | `text-sm` (14px) minimo, nunca `text-xs` | Precisa ler sem esforco |
| Touch targets | `h-12` (48px) — acima do padrao 44px | Dedos grossos, maos de trabalho |
| Contraste | WCAG AAA (>=7:1) em todo texto funcional | Sol forte na tela |
| Vocabulario | Zero jargao tecnico — "Prenhe" sim, "PRENHE_RETOQUE" nao | Simplicidade |
| Navegacao | Maximo 4 itens visiveis, sem menus aninhados | Sem confusao |
| Acoes | Botoes grandes com texto explicito, nunca so icone | Clareza total |

### Layout Mobile-Only

O modulo cliente e **mobile-first e mobile-only na pratica**. Desktop funciona mas nao e prioridade.

```
px-5 pt-5 pb-28
space-y-5
```

Padding mais generoso que o app principal. Mais ar entre elementos.

### Componentes Adaptados

**Cards de Animal:**
```
rounded-2xl border border-border bg-card
p-5
space-y-3
```
- Nome do animal: `text-lg font-bold` (18px)
- Info secundaria: `text-base text-secondary` (16px)
- Status: Badge com `text-sm` (14px) — maior que o padrao

**Botoes:**
```
w-full h-12 rounded-xl
text-base font-bold
```
Sempre full-width no mobile. Sempre com texto, nunca so icone.

**Filtros:**
- Select grande (`h-12`) com texto `text-base`
- Maximo 2 filtros visiveis — resto em "Mais filtros" (sheet)
- Opcoes com texto descritivo, nao codigos

**Tabelas -> Cards:**
Nunca tabela no modulo cliente. Sempre lista de cards empilhados.

### Navegacao do Cliente

```
Home  |  Rebanho  |  Resultados  |  Perfil
```

4 itens. Nomes em linguagem do produtor. Sem "Dashboard", sem "Hub", sem "Modulo".

### Tom de Voz (Cliente)

| Padrao | Cliente |
|--------|---------|
| "PRENHE_FEMEA" | "Prenhe — Femea" |
| "DG pendente" | "Diagnostico de gestacao pendente" |
| "TE realizada" | "Embriao transferido" |
| "Erro 500" | "Algo deu errado. Tente de novo." |
| "Nenhum registro" | "Nenhum animal encontrado" |
| "N/A" | "Sem informacao" |

---

## 11. Regras Gerais de Implementacao

### Obrigatorias (quebrar = bug)

1. **Cores**: Sempre via CSS variables ou classes Tailwind semanticas. Nunca `style={{ color: "..." }}`.
2. **Icones**: Custom PassaGene para conceitos-chave. Lucide so para acoes genericas (marcados `[PLACEHOLDER]`). Nunca emojis.
3. **Radius**: Nunca `rounded-none` ou `rounded-sm`. Minimo `rounded-md` (6px).
4. **Espacamento**: Multiplos de 4px. Sem valores arbitrarios (`mt-[7px]`).
5. **Textos**: Portugues do Brasil. Sempre.
6. **Touch targets mobile**: `h-11` (44px) minimo no app principal, `h-12` (48px) no modulo cliente.
7. **Dark mode**: Todo componente funciona nos dois modos. Testar antes de merge.
8. **Animacao**: So `transform` e `opacity`. Respeitar `prefers-reduced-motion`.
9. **shadcn/ui**: Base de todos os componentes. Customizar via variantes, nunca reescrever do zero.
10. **1 primary action por viewport**: Maximo 1 botao `primary` ou `gold` visivel por vez.

### Padroes de Codigo

**Componente novo:**
```tsx
// Sempre tipar props
interface CardAnimalProps {
  nome: string
  status: StatusReceptora
  className?: string
}

// Sempre usar cn() para merge de classes
export function CardAnimal({ nome, status, className }: CardAnimalProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card p-5",
      className
    )}>
      ...
    </div>
  )
}
```

**CSS Variables (em index.css):**
```css
:root {
  --bg-primary: #F7FAF8;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F0F4F1;
  --bg-subtle: #E8EDE9;
  --text-primary: #080B0A;
  --text-secondary: #4E5F54;
  --text-muted: #8A9B90;
  --border-default: #E2E8E4;
  --border-active: #34D399;
  --border-gold: #D4A24C;
}

.dark {
  --bg-primary: #080B0A;
  --bg-card: #0F1412;
  --bg-card-hover: #161D19;
  --bg-subtle: #1A211D;
  --text-primary: #F1F5F2;
  --text-secondary: #A3B5A9;
  --text-muted: #6B7C71;
  --border-default: #1E2722;
  --border-active: #34D399;
  --border-gold: #D4A24C;
}
```

**Tailwind config (theme.extend):**
```ts
{
  colors: {
    brand: '#09C972',
    'brand-deep': '#049357',
    green: {
      50: '#EEFBF4', 100: '#D7F5E5', 200: '#B3EBD0', 300: '#7ADCB0',
      400: '#3EC98A', 500: '#1A7A50', 600: '#156842', 700: '#105434',
      800: '#0C4229', 900: '#08311E', 950: '#041A10',
    },
    gold: {
      50: '#FDF8ED', 100: '#FAF0D4', 200: '#F4DFA8', 300: '#ECCC73',
      400: '#D4A24C', 500: '#B8862E', 600: '#96691E', 700: '#745016',
      800: '#5A3E11', 900: '#3D2A0B',
    },
    background: 'var(--bg-primary)',
    card: 'var(--bg-card)',
    foreground: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    border: 'var(--border-default)',
  },
  fontFamily: {
    sans: ['Outfit', 'system-ui', 'sans-serif'],
    heading: ['Outfit', 'system-ui', 'sans-serif'],
    mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  },
  borderRadius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    '2xl': '24px',
  },
}
```

### Checklist de Novo Componente

Antes de considerar pronto, todo componente deve passar por:

- [ ] Funciona em light mode
- [ ] Funciona em dark mode
- [ ] Funciona em mobile (<=768px)
- [ ] Funciona em desktop (>=1024px)
- [ ] Touch targets >=44px em mobile
- [ ] Sem cores hardcodadas — so CSS vars / Tailwind
- [ ] Animacoes respeitam `prefers-reduced-motion`
- [ ] Texto em Portugues do Brasil
- [ ] Usa `cn()` para merge de classes
