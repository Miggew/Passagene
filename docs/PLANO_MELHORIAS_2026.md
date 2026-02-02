# Plano de Melhorias - PassaGene

**Data:** 01/02/2026
**Versão:** 2.0
**Status:** IMPLEMENTADO (Fases 1-4)

---

## Resumo da Implementação (01/02/2026)

### Itens Concluídos

| Fase | Item | Status |
|------|------|--------|
| 1 | Fix import HubProtectedRoute.tsx | ✅ |
| 1 | Fix anti-pattern usePagination.ts | ✅ |
| 2 | Deletar 5 páginas obsoletas | ✅ |
| 2 | Deletar 10 componentes UI não usados | ✅ |
| 2 | Deletar PaginatedTable, FilterBar | ✅ |
| 2 | Deletar ClipboardIcon | ✅ |
| 3 | Deletar use-fazendas.ts duplicado | ✅ |
| 3 | Deletar loteTE/FazendaSelector duplicado | ✅ |
| 3 | Consolidar calcularDiasGestacao | ✅ |
| 3 | Consolidar getHoje → todayISO | ✅ |
| 3 | Consolidar normalizarData → extractDateOnly | ✅ |
| 3 | Consolidar formatarData → formatDateBR | ✅ |
| 3 | Remover funções deprecated | ✅ |
| 3 | Deletar useFormValidation não usado | ✅ |
| 3 | Remover isValidDate, compareDates não usados | ✅ |
| 4 | Criar index.ts para transferencia/ | ✅ |
| 4 | Criar index.ts para lotes/ | ✅ |
| 4 | Criar index.ts para layout/ | ✅ |
| 4 | Criar index.ts para cliente/ | ✅ |
| 4 | Criar index.ts para fazenda/ | ✅ |
| 4 | Criar index.ts para icons/ | ✅ |

### Arquivos Deletados (24 arquivos)

**Páginas obsoletas:**
- `src/pages/Portal.tsx`
- `src/pages/Clientes.tsx`
- `src/pages/Fazendas.tsx`
- `src/pages/Usuarios.tsx`
- `src/pages/Receptoras.tsx`

**Componentes UI não usados:**
- `src/components/ui/accordion.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/resizable.tsx`

**Componentes duplicados/não usados:**
- `src/components/shared/PaginatedTable.tsx`
- `src/components/shared/FilterBar.tsx`
- `src/components/icons/ClipboardIcon.tsx`
- `src/components/loteTE/FazendaSelector.tsx`
- `src/hooks/use-fazendas.ts`
- `src/hooks/core/useFormValidation.ts`

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `HubProtectedRoute.tsx` | Fix import LoadingSpinner |
| `usePagination.ts` | useMemo → useEffect |
| `useLotesTE.ts` | Import calcularDiasGestacao de dataEnrichment |
| `DiagnosticoGestacao.tsx` | Import consolidado, getHoje → todayISO |
| `Sexagem.tsx` | Import consolidado, getHoje → todayISO |
| `useReceptoraHistoricoData.ts` | normalizarData → extractDateOnly |
| `ReceptoraTimelineTable.tsx` | formatarData → formatDateBR |
| `ReceptoraAdminHistoricoCard.tsx` | formatarData → formatDateBR |
| `gestacao.ts` | Removidas funções duplicadas |
| `receptoraHistoricoUtils.ts` | Removidas funções deprecated |
| `dateUtils.ts` | Removidas funções não usadas |
| `hooks/core/index.ts` | Removido export useFormValidation |
| `loteTE/index.ts` | Removido export FazendaSelector |

### Impacto

- **~4.000+ linhas** de código removidas
- **24 arquivos** deletados
- **6 index files** criados
- Build verificado e funcionando

---

## Documentação Original (Referência)

---

## Resumo Executivo

O codebase do PassaGene está em **bom estado geral (7.5/10)**, com arquitetura sólida e padrões modernos. As principais oportunidades são:

- **~2.700 linhas de código morto** em páginas obsoletas
- **11 componentes UI não utilizados** do shadcn/ui
- **Funções duplicadas** em utilitários de data
- **Hooks com anti-patterns** que precisam correção
- **Import quebrado** em um componente de autenticação

---

## Prioridade 1: CRÍTICO (Fazer Imediatamente)

### 1.1 Corrigir Import Quebrado

**Arquivo:** `src/components/auth/HubProtectedRoute.tsx` (linha 3)

```tsx
// ERRADO:
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// CORRETO:
import LoadingSpinner from '@/components/shared/LoadingSpinner';
```

**Impacto:** Componente falha em runtime se usado.

---

### 1.2 Deletar Páginas Obsoletas (~2.716 linhas)

Estas páginas não têm mais rotas no App.tsx e foram substituídas:

| Arquivo | Linhas | Substituído Por |
|---------|--------|-----------------|
| `src/pages/Portal.tsx` | 1074 | Home.tsx (dashboard unificado) |
| `src/pages/Clientes.tsx` | 236 | Administrativo.tsx → tab clientes |
| `src/pages/Fazendas.tsx` | 258 | Administrativo.tsx → tab fazendas |
| `src/pages/Usuarios.tsx` | 715 | Administrativo.tsx → tab usuarios |
| `src/pages/Receptoras.tsx` | 233 | FazendaDetail.tsx → tab receptoras |

**Comando para deletar:**
```bash
rm src/pages/Portal.tsx
rm src/pages/Clientes.tsx
rm src/pages/Fazendas.tsx
rm src/pages/Usuarios.tsx
rm src/pages/Receptoras.tsx
```

**Nota:** Os redirects já existem em App.tsx (linhas 125-131, 178).

---

### 1.3 Corrigir Anti-Pattern no usePagination

**Arquivo:** `src/hooks/core/usePagination.ts` (linhas 75-79)

```tsx
// ERRADO - State update em useMemo é anti-pattern:
useMemo(() => {
  if (validPage !== currentPage) {
    setCurrentPage(validPage);  // ❌ Side effect em useMemo
  }
}, [validPage, currentPage]);

// CORRETO - Usar useEffect:
useEffect(() => {
  if (validPage !== currentPage) {
    setCurrentPage(validPage);
  }
}, [validPage, currentPage]);
```

---

### 1.4 Consolidar Hook useFazendas Duplicado

**Duplicatas encontradas:**
- `src/hooks/use-fazendas.ts` - Implementação simples inline
- `src/api/hooks.ts` - Implementação canônica com React Query

**Ação:**
1. Deletar `src/hooks/use-fazendas.ts`
2. Atualizar imports para usar `@/api/hooks`

---

## Prioridade 2: ALTA (Esta Semana)

### 2.1 Deletar Componentes UI Não Utilizados

11 componentes shadcn/ui nunca são importados:

```bash
rm src/components/ui/accordion.tsx
rm src/components/ui/aspect-ratio.tsx
rm src/components/ui/carousel.tsx
rm src/components/ui/context-menu.tsx
rm src/components/ui/drawer.tsx
rm src/components/ui/hover-card.tsx
rm src/components/ui/input-otp.tsx
rm src/components/ui/menubar.tsx
rm src/components/ui/navigation-menu.tsx
rm src/components/ui/resizable.tsx
rm src/components/ui/collapsible.tsx
```

**Também deletar ícone não utilizado:**
```bash
rm src/components/icons/ClipboardIcon.tsx
```

---

### 2.2 Remover Funções Duplicadas em Utilitários

#### A. calcularDiasGestacao (DUPLICADO)

| Localização | Status |
|-------------|--------|
| `src/lib/gestacao.ts:16` | DELETAR |
| `src/lib/dataEnrichment.ts:290` | MANTER |

#### B. getHoje (REDUNDANTE)

| Localização | Substituir Por |
|-------------|----------------|
| `src/lib/gestacao.ts:35` | `todayISO()` de `dateUtils.ts` |

#### C. Funções Deprecated Ainda em Uso (11 arquivos)

| Função | Localização | Substituir Por |
|--------|-------------|----------------|
| `normalizarData` | `receptoraHistoricoUtils.ts:31` | `extractDateOnly` de `dateUtils.ts` |
| `formatarData` | `receptoraHistoricoUtils.ts:40` | `formatDateBR` de `dateUtils.ts` |

---

### 2.3 Consolidar FazendaSelector Duplicado

**Duplicatas:**
- `src/components/shared/FazendaSelector.tsx` - Versão genérica ✓ MANTER
- `src/components/loteTE/FazendaSelector.tsx` - Versão específica ✗ DELETAR

**Ação:**
1. Deletar `src/components/loteTE/FazendaSelector.tsx`
2. Atualizar `src/components/loteTE/index.ts`
3. Atualizar imports para usar versão em `/shared/`

---

### 2.4 Deletar Componentes Shared Não Utilizados

| Componente | Arquivo | Motivo |
|------------|---------|--------|
| PaginatedTable | `src/components/shared/PaginatedTable.tsx` | Substituído por DataTable |
| FilterBar | `src/components/shared/FilterBar.tsx` | Substituído por padrão premium |

---

## Prioridade 3: MÉDIA (Este Mês)

### 3.1 Criar Index Files Faltando

Adicionar `index.ts` para exports centralizados:

```
src/components/transferencia/index.ts
src/components/lotes/index.ts
src/components/layout/index.ts
src/components/cliente/index.ts
src/components/fazenda/index.ts
src/components/icons/index.ts
src/hooks/index.ts  (root-level hooks)
```

**Template:**
```typescript
// src/components/transferencia/index.ts
export { default as EmbrioesTableCongelados } from './EmbrioesTableCongelados';
export { default as EmbrioesTablePacote } from './EmbrioesTablePacote';
export { default as ReceptorasSelection } from './ReceptorasSelection';
export { default as RelatorioTransferenciaDialog } from './RelatorioTransferenciaDialog';
```

---

### 3.2 Padronizar Nomenclatura de Hooks

**Convenção React:** Arquivos de hooks usam `kebab-case`, funções exportam `camelCase`.

| Arquivo Atual | Renomear Para |
|---------------|---------------|
| `useLotesFIVData.ts` | `use-lotes-fiv-data.ts` |
| `useLotesFiltros.ts` | `use-lotes-filtros.ts` |
| `useTransferenciaEmbrioesData.ts` | `use-transferencia-embrioes-data.ts` |
| `useTransferenciaEmbrioesFilters.ts` | `use-transferencia-embrioes-filters.ts` |
| `useTransferenciaHandlers.ts` | `use-transferencia-handlers.ts` |
| `usePermissions.ts` | `use-permissions.ts` |
| `useClienteFilter.ts` | `use-cliente-filter.ts` |
| `useKPIData.ts` | `use-kpi-data.ts` |
| `useUserClientes.ts` | `use-user-clientes.ts` |

---

### 3.3 Adicionar Constantes Faltando

**Arquivo:** `src/lib/gestacao.ts`

```typescript
// Adicionar após DIAS_MINIMOS:
export const CONSTANTES_GESTACAO = {
  DIAS_GESTACAO: 275,           // Duração média da gestação bovina
  DIAS_DESCANSO_DOADORA: 14,    // Período mínimo entre aspirações
  HORAS_OVERFLOW_CULTIVO: 24,   // Horas para overflow em cultivo
} as const;
```

---

### 3.4 Remover Funções Não Utilizadas

| Função | Arquivo | Status |
|--------|---------|--------|
| `compareDates` | `src/lib/dateUtils.ts:139` | 0 usos - DELETAR |
| `isValidDate` | `src/lib/dateUtils.ts:129` | 0 usos - DELETAR |
| `atualizarStatusReceptora` | `src/lib/receptoraStatus.ts:22` | Verificar uso - provavelmente não usado |
| `useFormValidation` | `src/hooks/core/useFormValidation.ts` | 0 usos - DELETAR ou documentar |

---

### 3.5 Padronizar Cores em Charts

**Arquivo:** `src/components/charts/HorizontalBarChart.tsx`

```tsx
// ERRADO - Cores hardcoded:
'hsl(142, 76%, 36%)'  // emerald-600
'hsl(45, 93%, 47%)'   // amber-500
'hsl(0, 84%, 60%)'    // red-500

// CORRETO - Usar CSS variables:
'hsl(var(--color-success))'
'hsl(var(--color-warning))'
'hsl(var(--color-danger))'
```

**Criar em `src/lib/designTokens.ts`:**
```typescript
export const chartColors = {
  success: 'hsl(var(--primary))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
  info: 'hsl(var(--info))',
} as const;
```

---

## Prioridade 4: BAIXA (Quando Possível)

### 4.1 Aumentar Strictness do TypeScript

**Arquivo:** `tsconfig.json`

Progressivamente habilitar:
```json
{
  "compilerOptions": {
    "noImplicitAny": true,       // Catch tipo gaps
    "strictNullChecks": true,    // Safer null handling
    "noUnusedLocals": true       // Remover código morto
  }
}
```

**Nota:** Fazer incrementalmente, uma flag por vez.

---

### 4.2 Refatorar Hooks com useLotesFiltros

**Arquivo:** `src/hooks/useLotesFiltros.ts`

Usar composição com `usePersistedFilters` ao invés de implementação manual.

---

### 4.3 Consolidar EmbrioesTable Duplicados

| Arquivo | Linhas |
|---------|--------|
| `EmbrioesTableCongelados.tsx` | 129 |
| `EmbrioesTablePacote.tsx` | 133 |

**Ação:** Criar componente parametrizado único que aceita config de sorting e colunas.

---

### 4.4 Refatorar Componentes Grandes

| Componente | Linhas | Recomendação |
|------------|--------|--------------|
| `AdminUsuariosTab.tsx` | 905 | Extrair sub-componentes |
| `AdminFazendasTab.tsx` | 702 | Extrair sub-componentes |
| `LoteDetailView.tsx` | 672 | Extrair dialogs e forms |
| `LotesHistoricoTab.tsx` | 675 | Extrair sub-componentes |
| `NovoLoteDialog.tsx` | 577 | Extrair form logic |
| `EmbrioesDialogs.tsx` | 552 | Separar dialogs |

**Meta:** Componentes <= 400 linhas.

---

### 4.5 Modernizar SectionErrorBoundary

**Arquivo:** `src/components/shared/SectionErrorBoundary.tsx`

Substituir class component por hook `react-error-boundary`:
```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Algo deu errado:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Tentar novamente</button>
    </div>
  );
}
```

---

## Checklist de Verificação Pré-Deleção

Antes de deletar arquivos, verificar:

- [ ] Nenhum link externo referencia as rotas antigas
- [ ] Navigation/Sidebar não linkam para páginas deletadas
- [ ] Redirects em App.tsx funcionam
- [ ] Nenhum componente importa dos arquivos deletados
- [ ] Build passa sem erros após deleção
- [ ] Git history preservado (commits documentam mudanças)

---

## Estimativa de Impacto

| Categoria | Linhas Removidas | Arquivos | Tempo |
|-----------|------------------|----------|-------|
| Páginas obsoletas | ~2.716 | 5 | 15min |
| Componentes UI | ~800 | 12 | 10min |
| Hooks duplicados | ~150 | 1 | 5min |
| Componentes shared | ~465 | 2 | 5min |
| Funções duplicadas | ~100 | 3 | 20min |
| **TOTAL** | **~4.231** | **23** | **~1h** |

---

## Benefícios Esperados

1. **Redução de bundle:** ~15-20KB (minificado)
2. **Melhor manutenibilidade:** Menos código = menos bugs
3. **Developer experience:** Imports mais claros e consistentes
4. **Performance:** Menos código para parsear/compilar
5. **Qualidade:** TypeScript mais estrito catch bugs mais cedo

---

## Notas de Implementação

### Ordem de Execução Recomendada

1. **Primeiro:** Corrigir import quebrado (HubProtectedRoute)
2. **Segundo:** Deletar páginas obsoletas (maior impacto)
3. **Terceiro:** Deletar componentes UI não utilizados
4. **Quarto:** Consolidar hooks e funções duplicadas
5. **Quinto:** Criar index files
6. **Sexto:** Padronizar nomenclatura

### Testes Após Cada Mudança

```bash
# Verificar build
npm run build

# Verificar tipos
npx tsc --noEmit

# Rodar aplicação
npm run dev
```

---

## Arquivos de Referência

### Padrões Aprovados (usar como referência)
- `src/pages/relatorios/RelatoriosServicos.tsx` - Design premium
- `src/components/shared/StatusBadge.tsx` - Sistema de badges
- `src/hooks/lotesFiv/index.ts` - Estrutura de hooks

### Documentação
- `CLAUDE.md` - Design tokens e padrões
- `docs/db/` - Scripts SQL

---

**Documento gerado por análise automatizada do codebase.**
