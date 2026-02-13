# PassaGene - Instruções

## REGRA PRINCIPAL
**NUNCA efetue mudanças no código sem aprovação prévia do usuário.**

---

## Contexto
Sistema de gestão de FIV (Fertilização In Vitro) para gado bovino.
Stack: Vite + React 19 + TypeScript + Tailwind + Supabase + TanStack Query + shadcn/ui

---

## CSS Grid - Tabelas (CRÍTICO)

### Problema Recorrente
`overflow-x-auto` + `minmax(X,1fr)` = colunas travadas no mínimo.

### Soluções

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

**Centralização:** Usar `flex justify-center`, não `text-center`.

---

## Regras de Negócio

| Módulo | Dias Mínimos | Status Entrada | Status Saída |
|--------|--------------|----------------|--------------|
| DG | 27 dias | SERVIDA | PRENHE, VAZIA, RETOQUE |
| Sexagem | 54 dias | PRENHE, PRENHE_RETOQUE | PRENHE_FEMEA/MACHO/SEM_SEXO/2_SEXOS, VAZIA |

- **D0** = `data_abertura` do lote FIV (data fecundação)
- **`data_te`** = coluna correta em `transferencias_embrioes` (NÃO `data_transferencia`)
- **`disponivel_para_transferencia`** em `lotes_fiv` deve ser `true` (despacho explícito)
- **`UTILIZADA`** em `protocolo_receptoras` = receptora que recebeu embrião na TE
- **Oócitos** = `aspiracoes_doadoras.viaveis`
- **Embriões** = `COUNT(*)` de `embrioes` WHERE classificacao IN ('A','B','C','BE','BN','BX','BL','BI')

---

## Dark Mode
Usar CSS variables: `bg-muted`, `text-foreground`, `border-border` (não hardcodar cores).

---

## Padrões do App

### Mobile Dual-Layout
- `md:hidden` (cards mobile) + `hidden md:block` (tabela desktop)
- Touch targets: `h-11 md:h-9`, inputs `w-full md:w-[Xpx]`
- Card mobile: `rounded-xl border border-border/60 bg-card shadow-sm p-3.5`

### Filtros
- Container: `rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4`
- Mobile: `flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6`
- Indicador: `w-1 h-6 rounded-full bg-[cor]/40`

### Badges (sistema unificado)
- `StatusBadge` → status de receptoras/protocolos/embriões
- `CountBadge` → contagens numéricas com variantes de cor
- `ResultBadge` → resultados DG/Sexagem/TE/Classificação
- Padrão: `bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/30`

### Cores Semânticas de Status
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

### Design - REGRA DE OURO
- **MENOS É MAIS** - Nada de glows, stripes, dots, gradient text, blur, animate-ping
- Verde como acento pontual, nunca dominante
- Cards limpos: `bg-card border-border shadow-sm rounded-xl`

---

## Módulo Cliente

### Público Alvo
Usuários idosos com vista ruim e pouca intimidade com tecnologia.
- Fontes mínimas: `text-xs` (12px) para labels, `text-base` (16px) para nomes
- Touch targets mínimos: 44px (h-11)

### Navegação
```
Home | Rebanho | Serviços | Botijão
```

---

## Supabase - Armadilhas Conhecidas

- **Nested joins** podem falhar silenciosamente → preferir queries separadas
- **`vw_receptoras_fazenda_atual`** é necessária para obter fazenda de receptoras (sem FK direto)
- **DatePickerBR** usa string ISO (`"2026-01-15"`), não objeto Date
- **Supabase CLI NÃO executa SQL arbitrário** sem Docker → entregar SQL ao usuário para o Dashboard

---

## EmbryoScore v4

- 3 frames, sub-scoring morfológico, kinetic refinado pelo Gemini
- Classificação: ≥82 Excelente, ≥65 Bom, ≥48 Regular, ≥25 Borderline, <25 Inviável
- Página própria: `/embryoscore`
- Cloud Run: `frame-extractor` em `apppassatempo` (us-central1)
- Deploy: `gcloud run deploy frame-extractor --source cloud-run/frame-extractor/ --project apppassatempo --region us-central1`

---

## Infraestrutura

- **Google Cloud**: projeto `apppassatempo`
- **Supabase**: projeto `twsnzfzjtjdamwwembzp`
- **NUNCA fazer `migration repair`** sem saber quais migrations foram aplicadas

---

## Trabalho Futuro

### Fase 5 - Relatórios Pré-definidos e Alertas (PENDENTE)

**1. Relatórios Pré-definidos**
- Relatórios com filtros já configurados para casos comuns
- Relatórios periódicos (semanal, mensal) de produção

**2. Sistema de Alertas**
- Notificações automáticas (protocolo pendente, parto próximo, estoque baixo, DG pendente)

**3. Dashboard de KPIs**
- Comparativos período a período, gráficos de tendência, métricas por fazenda/cliente

---

## Referências
- Design premium: `src/pages/relatorios/RelatoriosServicos.tsx`
- Tabelas Grid: `src/pages/Aspiracoes.tsx`, `src/pages/Protocolos.tsx`
- Badges: `src/components/shared/StatusBadge.tsx`, `CountBadge.tsx`, `ResultBadge.tsx`
- Rotas e tabelas: `DOCS.md`
