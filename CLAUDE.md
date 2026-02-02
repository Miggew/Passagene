# PassaGene - Instruções

## REGRA PRINCIPAL
**NUNCA efetue mudanças no código sem aprovação prévia do usuário.**

---

## Contexto
Sistema de gestão de FIV (Fertilização In Vitro) para gado bovino.

---

## Design Tokens

### Cores
- **Primary:** `#2ECC71` (emerald-500)
- **Primary Dark:** `#1E8449` (emerald-700)
- **Accent:** `#27AE60` (green-600)

### Tipografia
- **Principal:** Manrope
- **Títulos:** Outfit

### Componentes
- **Bordas:** `rounded-lg` (8px) / `rounded-xl` (16px)
- **Sombras:** Usar CSS variables com rgba verde

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

**D0** = `data_abertura` do lote FIV (data fecundação)

---

## Dark Mode
Usar CSS variables: `bg-muted`, `text-foreground`, `border-border` (não hardcodar cores).

---

## Componentes Premium (Padrão Aprovado)

> **REFERÊNCIA:** `src/pages/relatorios/RelatoriosServicos.tsx`

### Filosofia de Design

O padrão premium usa **verde como acento pontual**, nunca dominante:
- Fundos neutros (`bg-muted`, `bg-card`)
- Verde apenas em: indicadores, ícones, bordas sutis, badges
- Opacidades relativas (`primary/15`, `primary/40`, `primary/60`) funcionam em light/dark
- Separações visuais claras com bordas e backgrounds alternados

---

### 1. Tabs Premium

```tsx
<div className="rounded-xl border border-border bg-card p-1.5">
  <div className="flex gap-1">
    {tabs.map(({ value, label, icon: Icon }) => (
      <button
        key={value}
        onClick={() => onChange(value)}
        className={`
          relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
          text-sm font-medium transition-all duration-200
          ${isActive
            ? 'bg-muted/80 text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }
        `}
      >
        {/* Indicador inferior - linha verde */}
        {isActive && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
        )}

        {/* Ícone com container */}
        <div className={`
          flex items-center justify-center w-7 h-7 rounded-md transition-colors
          ${isActive ? 'bg-primary/15' : 'bg-muted/50'}
        `}>
          <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>

        <span className="hidden sm:inline">{label}</span>

        {/* Badge opcional */}
        {isActive && count > 0 && (
          <span className="hidden md:inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold bg-primary/15 text-primary rounded-full">
            {count}
          </span>
        )}
      </button>
    ))}
  </div>
</div>
```

| Elemento | Ativo | Inativo |
|----------|-------|---------|
| Background | `bg-muted/80 shadow-sm` | `hover:bg-muted/40` |
| Texto | `text-foreground` | `text-muted-foreground` |
| Ícone container | `bg-primary/15` | `bg-muted/50` |
| Ícone cor | `text-primary` | `text-muted-foreground` |
| Indicador | `w-10 h-0.5 bg-primary` (bottom) | — |

---

### 2. Barra de Filtros Premium

```tsx
<div className="rounded-xl border border-border bg-card overflow-hidden">
  <div className="flex flex-wrap items-stretch">
    {/* Grupo: Busca */}
    <div className="flex items-center px-4 py-3 border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
      <div className="relative min-w-[200px] max-w-[280px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
        <Input
          placeholder="Buscar..."
          className="pl-9 h-9 bg-background/80 border-primary/20 focus:border-primary/40"
        />
      </div>
    </div>

    {/* Grupo: Filtros */}
    <div className="flex items-center gap-3 px-4 py-3 border-r border-border">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 rounded-full bg-primary/40" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filtros</span>
      </div>
      <Select>...</Select>
    </div>

    {/* Grupo: Período */}
    <div className="flex items-center gap-3 px-4 py-3 border-r border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 rounded-full bg-primary/40" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Período</span>
      </div>
      <DatePickerBR placeholder="Início" className="h-9 w-[120px] bg-background" />
      {/* Separador estilizado */}
      <div className="flex items-center gap-1">
        <div className="w-2 h-px bg-primary/40" />
        <div className="w-1 h-1 rounded-full bg-primary/60" />
        <div className="w-2 h-px bg-primary/40" />
      </div>
      <DatePickerBR placeholder="Fim" className="h-9 w-[120px] bg-background" />
    </div>

    {/* Grupo: Ações */}
    <div className="flex items-center gap-2 px-4 py-3 ml-auto bg-gradient-to-b from-muted/50 to-transparent">
      <Button variant="outline" className="h-9 border-dashed border-muted-foreground/30">
        <X className="w-4 h-4 mr-1" />Limpar
      </Button>
      <Button className="h-9 bg-primary hover:bg-primary-dark shadow-sm shadow-primary/25">
        <Search className="w-4 h-4 mr-1" />Buscar
      </Button>
    </div>
  </div>
</div>
```

| Elemento | Classes |
|----------|---------|
| Container | `rounded-xl border border-border bg-card overflow-hidden` |
| Grupo base | `flex items-center px-4 py-3 border-r border-border` |
| Grupo destaque | + `bg-gradient-to-b from-primary/5 to-transparent` |
| Grupo alternado | + `bg-muted/30` |
| Indicador seção | `w-1 h-6 rounded-full bg-primary/40` |
| Label seção | `text-[10px] font-semibold text-muted-foreground uppercase tracking-wider` |
| Separador datas | `w-2 h-px bg-primary/40` + `w-1 h-1 rounded-full bg-primary/60` |
| Input busca | `border-primary/20 focus:border-primary/40` |
| Botão secundário | `border-dashed border-muted-foreground/30` |
| Botão primário | `shadow-sm shadow-primary/25` |

---

### 3. Tabela Premium

```tsx
<div className="rounded-xl border border-border bg-card overflow-hidden">
  {/* Header com gradiente */}
  <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
    <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_0.6fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="w-1 h-4 rounded-full bg-primary/40" />
        Coluna Principal
      </div>
      <div className="px-3 py-3 text-center">Data</div>
      <div className="px-3 py-3">Texto</div>
      <div className="px-3 py-3 text-center">Contagem</div>
      <div className="px-2 py-3"></div>
    </div>
  </div>

  {/* Linhas */}
  <div className="divide-y divide-border/50">
    {items.map((row, index) => (
      <div
        key={row.id}
        className={`
          group grid grid-cols-[2fr_1fr_1.5fr_1fr_0.6fr] items-center cursor-pointer transition-all duration-150
          hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
          ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
        `}
      >
        {/* Coluna principal com indicador */}
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
          <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {row.nome}
          </span>
        </div>

        {/* Coluna data */}
        <div className="px-3 py-3.5 text-sm text-center text-muted-foreground">
          {formatDate(row.data)}
        </div>

        {/* Coluna texto */}
        <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
          {row.texto || '-'}
        </div>

        {/* Coluna badge contagem */}
        <div className="px-3 py-3.5 flex justify-center">
          <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-semibold bg-primary/10 text-primary rounded-md group-hover:bg-primary/20 transition-colors">
            {row.count}
          </span>
        </div>

        {/* Coluna ação */}
        <div className="px-2 py-3.5 flex justify-center">
          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-colors">
            <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>
    ))}
  </div>

  {/* Paginação Premium */}
  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-t border-border">
    <span className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">1-15</span> de <span className="font-medium text-foreground">42</span>
    </span>
    <div className="flex items-center gap-1">
      <button className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
        Anterior
      </button>
      <div className="flex items-center gap-0.5 mx-2">
        {/* Página ativa */}
        <button className="w-8 h-8 text-xs font-medium rounded-md bg-primary/15 text-primary">1</button>
        {/* Página inativa */}
        <button className="w-8 h-8 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">2</button>
      </div>
      <button className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
        Próximo
      </button>
    </div>
  </div>
</div>
```

| Elemento | Classes |
|----------|---------|
| Container | `rounded-xl border border-border bg-card overflow-hidden` |
| Header | `bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border` |
| Header texto | `text-[10px] font-semibold text-muted-foreground uppercase tracking-wider` |
| Indicador header | `w-1 h-4 rounded-full bg-primary/40` |
| Linhas container | `divide-y divide-border/50` |
| Linha par | `bg-transparent` |
| Linha ímpar | `bg-muted/20` |
| Linha hover | `hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent` |
| Indicador lateral | `w-0.5 h-8 bg-transparent group-hover:bg-primary` |
| Texto principal hover | `group-hover:text-primary` |
| Badge contagem | `min-w-7 h-7 bg-primary/10 text-primary rounded-md group-hover:bg-primary/20` |
| Ícone ação | `w-8 h-8 rounded-md group-hover:bg-primary/10` |
| Paginação fundo | `bg-gradient-to-r from-muted/30 via-transparent to-muted/30` |
| Página ativa | `bg-primary/15 text-primary` |

---

### Tokens de Acento Verde (Usar com moderação)

```
bg-primary/5    → Gradientes sutis de fundo
bg-primary/10   → Fundo de containers inativos
bg-primary/15   → Fundo de containers ativos, badges
bg-primary/40   → Indicadores, separadores
bg-primary/60   → Ícones, pontos de destaque
text-primary    → Ícones ativos, texto de badges
text-primary/60 → Ícones de busca
```

---

## Referências
- **Componentes Premium**: `src/pages/relatorios/RelatoriosServicos.tsx` (tabs, filtros, tabela)
- Tabelas Grid: `src/pages/Aspiracoes.tsx`, `src/pages/Protocolos.tsx`
- DG/Sexagem: `src/pages/DiagnosticoGestacao.tsx`, `src/pages/Sexagem.tsx`
- Rascunho localStorage: `src/pages/Aspiracoes.tsx`

---

## Padrão de Filtros Premium - Implementado em Todo o App

> **Status:** CONCLUIDO - Aplicado em todas as paginas com filtros

### Padrao Visual Aplicado

```tsx
<div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
  <div className="flex flex-wrap items-end gap-6">
    {/* Grupo com indicador colorido */}
    <div className="flex items-end gap-3">
      <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
        <FilterIcon className="w-3.5 h-3.5" />
        <span>Label</span>
      </div>
      {/* Input/Select */}
    </div>

    {/* Separador vertical */}
    <div className="h-10 w-px bg-border hidden lg:block" />

    {/* Mais grupos... */}

    {/* Botao limpar (quando filtros ativos) */}
    {hasFilters && (
      <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 ml-auto">
        <X className="w-4 h-4 mr-2" />
        Limpar
      </Button>
    )}
  </div>
</div>
```

### Cores dos Indicadores por Tipo de Filtro

| Tipo de Filtro | Cor do Indicador |
|----------------|------------------|
| Busca (texto) | `bg-primary/40` |
| Status/Tipo | `bg-emerald-500/40` |
| Genetica/Raca | `bg-blue-500/40` |
| Cliente/Pessoa | `bg-amber-500/40` |

### Arquivos Atualizados

| Arquivo | Grupos de Filtro |
|---------|------------------|
| `src/pages/Touros.tsx` | Busca, Raca |
| `src/pages/DosesSemen.tsx` | Touro, Cliente, Tipo |
| `src/pages/EmbrioesCongelados.tsx` | Busca, Cliente, Genetica (Raca/Classificacao/Touro) |
| `src/pages/Usuarios.tsx` | Busca, Tipo |
| `src/pages/Doadoras.tsx` | Busca |
| `src/components/fazenda/FazendaReceptorasTab.tsx` | Busca, Status |
| `src/components/fazenda/FazendaDoadorasTab.tsx` | Busca |

### Paginas de Detalhe (Sem Alteracao)

Paginas de formulario/detalhe de registro unico nao possuem barra de filtros:
- `ClienteDetail.tsx`, `DoadoraDetail.tsx`, `TouroDetail.tsx`
- `FazendaDetail.tsx`, `ProtocoloDetail.tsx`, `Portal.tsx`

### Elementos Padrao

| Elemento | Classes |
|----------|---------|
| Container | `rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4` |
| Wrapper | `flex flex-wrap items-end gap-6` |
| Indicador | `w-1 h-6 rounded-full bg-[cor]/40 self-center` |
| Label | `text-xs font-medium text-muted-foreground self-center` |
| Input altura | `h-9` |
| Separador | `h-10 w-px bg-border hidden lg:block` |
| Botao limpar | `h-9 ml-auto` |

---

## Trabalho Futuro

### Fase 5 - Relatórios Pré-definidos e Alertas (PENDENTE)

> **Status:** A implementar posteriormente

**1. Relatórios Pré-definidos**
- Relatórios com filtros já configurados para casos de uso comuns
- Exemplos:
  - "Receptoras prenhes nos próximos 30 dias"
  - "Doadoras com média de oócitos acima de X"
  - "Protocolos aguardando 2º passo há mais de 7 dias"
- Relatórios periódicos (semanal, mensal) de produção

**2. Sistema de Alertas**
- Notificações automáticas baseadas em condições
- Exemplos:
  - Protocolo aguardando 2º passo há mais de X dias
  - Receptora com data provável de parto em X dias
  - Estoque de embriões do cliente abaixo de X unidades
  - DG pendente para receptoras servidas há mais de 27 dias

**3. Dashboard de KPIs**
- Indicadores chave de performance consolidados
- Comparativos período a período
- Gráficos de tendência (linha, barras)
- Métricas por fazenda/cliente

**Local sugerido:** `src/pages/relatorios/RelatoriosAlertas.tsx` (nova página)

---

## Sistema de Badges Padronizado (30/01/2026)

> **Status:** CONCLUIDO - Sistema unificado de badges com cores semanticas

### Componentes Criados/Atualizados

| Componente | Arquivo | Função |
|------------|---------|--------|
| **StatusBadge** | `src/components/shared/StatusBadge.tsx` | Badge principal para status (receptoras, protocolos, embriões) |
| **CountBadge** | `src/components/shared/CountBadge.tsx` | Badge para contagens numéricas com variantes de cor |
| **ResultBadge** | `src/components/shared/ResultBadge.tsx` | Badge para resultados (DG, Sexagem, TE, Classificação embrião) |
| **statusLabels** | `src/lib/statusLabels.ts` | Mapeamento de status para labels legíveis |

### Padrão Visual de Cores

```
bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/30
```

### Mapa de Cores Semânticas (StatusBadge)

| Categoria | Status | Cor |
|-----------|--------|-----|
| **Neutros** | VAZIA, NAO_UTILIZADA, DISPONIVEL | slate |
| **Sincronização** | EM_SINCRONIZACAO, SINCRONIZANDO | teal |
| **Sincronizado** | SINCRONIZADA, SINCRONIZADO | emerald |
| **Ação tomada** | INICIADA | sky |
| **Servida** | SERVIDA, UTILIZADA | violet |
| **Prenhez base** | PRENHE | green |
| **Prenhez retoque** | PRENHE_RETOQUE, RETOQUE | amber |
| **Prenhez fêmea** | PRENHE_FEMEA | pink |
| **Prenhez macho** | PRENHE_MACHO | blue |
| **Prenhez sem sexo** | PRENHE_SEM_SEXO | purple |
| **Prenhez 2 sexos** | PRENHE_2_SEXOS | indigo |
| **Protocolo** | PASSO1_FECHADO, EM_PROTOCOLO | blue |
| **Protocolo fechado** | FECHADO, EM_TE | slate |
| **Aptidão positiva** | APTA, REALIZADA | green |
| **Aptidão negativa** | INAPTA, DESCARTE | red |
| **Embriões** | CONGELADO | cyan |
| **Embriões** | TRANSFERIDO | violet |
| **Propriedade** | VENDIDA | slate |

### CountBadge - Variantes

| Variante | Uso | Cor |
|----------|-----|-----|
| default | Contagem neutra | muted |
| primary | Destaque principal | primary (verde) |
| success | Resultado positivo | green |
| warning | Atenção | amber |
| danger | Alerta/erro | red |
| info | Informativo | blue |
| pink | Fêmea | pink |
| blue | Macho | blue |
| purple | Indefinido | purple |
| cyan | Congelado | cyan |
| violet | Transferido | violet |

### ResultBadge - Tipos

| Tipo | Valores | Cores |
|------|---------|-------|
| dg | PRENHE, VAZIA, RETOQUE | green, slate, amber |
| sexagem | FEMEA, MACHO, SEM_SEXO, 2_SEXOS | pink, blue, purple, indigo |
| te | FRESCO, CONGELADO | amber, cyan |
| classificacao | A, B, C, D | green, blue, amber, red |

### Páginas Atualizadas

- `DiagnosticoSessaoDetail.tsx` - Badges de resultado DG
- `SexagemSessaoDetail.tsx` - Badges de resultado sexagem
- `TESessaoDetail.tsx` - Badges de tipo TE e classificação
- `PacoteAspiracaoDetail.tsx` - CountBadges para oócitos
- `ProtocoloRelatorioFechado.tsx` - StatusBadges e CountBadges
- `DoadoraHistoricoAspiracoes.tsx` - CountBadges
- `RelatoriosServicos.tsx` - StatusBadge centralizado
- `RelatoriosAnimais.tsx` - StatusBadge centralizado (substituiu config local)
- `Doadoras.tsx` - Badge de disponibilidade
- `Protocolos.tsx` - CountBadges para estatísticas

### Funções Auxiliares

```tsx
// CountBadge - determinar variante por taxa
import { getTaxaVariant } from '@/components/shared/CountBadge';
const variant = getTaxaVariant(taxa, 50); // 'primary' se >= 50, 'warning' se < 50

// StatusBadge - obter classes de cor
import { getStatusColor } from '@/components/shared/StatusBadge';
const colorClasses = getStatusColor('PRENHE_FEMEA'); // para uso em renderCell
```

---

## Correções Relatórios e KPIs (01/02/2026)

> **Status:** CONCLUÍDO

### Problemas Corrigidos

#### 1. RelatoriosAnimais.tsx - Filtro de Doadoras para Aspiração
- Adicionada coluna "Última Aspiração" na listagem de doadoras
- Botão de ordenação cíclico: sem ordem → recentes → antigas → sem ordem
- Filtro por data de aspiração futura (período de descanso de 14 dias)
  - DatePickerBR com data da próxima aspiração
  - Filtra doadoras cuja última aspiração + 14 dias ≤ data selecionada

#### 2. RelatoriosMaterial.tsx - Doses de Sêmen
- Corrigido nome da coluna: `quantidade_disponivel` → `quantidade`
- Queries separadas para clientes e touros (sem nested joins)

#### 3. RelatoriosProducao.tsx - Métricas e Lotes FIV
- Corrigido `data_fiv` → `data_abertura`
- Corrigido `pacote_id` → `pacote_aspiracao_id`
- Reescrita função `loadLotesFiv` para query direta em lotes_fiv

#### 4. useKPIData.ts - Dashboards Visão Geral (CRÍTICO)

**Problema:** Nested joins do Supabase falhavam silenciosamente, retornando dados vazios.

**Funções corrigidas:**

| Função | Problema | Solução |
|--------|----------|---------|
| `fetchRankingFazendas` | Join em receptoras para fazenda | Usar view `vw_receptoras_fazenda_atual` |
| `fetchRankingTouros` | Sem filtro de data + campos errados | Filtrar por `lotes_fiv.data_abertura`, buscar oócitos de `aspiracoes_doadoras.viaveis`, contar embriões da tabela `embrioes` |
| `fetchRankingDoadoras` | Nested join em doadoras + campos errados | Mesma correção acima |

**Padrão correto para KPIs de taxa de virada:**
```tsx
// Oócitos = aspiracoes_doadoras.viaveis
// Embriões = COUNT(*) from embrioes WHERE classificacao IN ('A','B','C','BE','BN','BX','BL','BI')
```

### Lições Aprendidas

1. **Supabase nested joins** podem falhar silenciosamente - preferir queries separadas
2. **Verificar nomes de colunas** no código existente antes de assumir
3. **Dados de embriões** são contados da tabela `embrioes`, não de campos agregados
4. **DatePickerBR** usa string ISO (`"2026-01-15"`), não objeto Date
5. **View `vw_receptoras_fazenda_atual`** é necessária para obter fazenda atual de receptoras (não há FK direto)

### Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/pages/relatorios/RelatoriosAnimais.tsx` | Coluna última aspiração, filtro data, ordenação cíclica |
| `src/pages/relatorios/RelatoriosMaterial.tsx` | Correção coluna quantidade |
| `src/pages/relatorios/RelatoriosProducao.tsx` | Correções data_abertura, pacote_aspiracao_id |
| `src/hooks/useKPIData.ts` | Reescrita completa das funções de ranking |
