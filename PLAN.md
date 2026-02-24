# Plano de Refatoração — Qualidade, Acessibilidade & Robustez

## Contexto
Continuação da refatoração interrompida. 36 arquivos já têm mudanças unstaged (aria-label, loading="lazy", imports, error handling em Escritório, console.log cleanup). Este plano cobre o que **falta fazer**.

---

## Fase 1 — Imports não usados (30 imports em 20 arquivos)

Remoção segura de imports que o bundler já ignora mas poluem o código.

| Arquivo | Imports a remover |
|---------|-------------------|
| `components/aspiracoes/AspiracaoDoadoras.tsx` | `Search`, `Clock` |
| `components/embryoscore/LoteScoreDashboard.tsx` | `Activity` |
| `components/home/HomeDashboardClienteAI.tsx` | `Sparkles` |
| `components/home/HomeDashboardOperacional.tsx` | `UserCheck` |
| `components/home/widgets/NewsWidget.tsx` | `Newspaper`, `AlertCircle` |
| `components/layout/MobileNav.tsx` | `Building2`, `TestTube`, `FileBarChart`, `Dna`, `getBottomBarHubCode` |
| `components/lotes/LoteDetailView.tsx` | `Lock`, `X`, `supabase` |
| `components/transferencia/TransferenciaSessao.tsx` | `Package` |
| `components/home/widgets/AITeaserWidget.tsx` | `LoadingInline` |
| `components/protocolos/ProtocoloPasso2.tsx` | `supabase` |
| `pages/Doadoras.tsx` | `Search`, type `SortOrder` |
| `pages/DosesSemen.tsx` | `Filter` |
| `pages/DoadoraDetail.tsx` | `DataTable` |
| `pages/LotesFIV.tsx` | `DoseSemen`, `AcasalamentoComNomes`, `LotesHistoricoTab` |
| `pages/ProtocoloRelatorioFechado.tsx` | `Column` |
| `pages/TransferenciaEmbrioes.tsx` | `DataTable` |
| `pages/relatorios/RelatoriosHome.tsx` | `Users` |
| `pages/relatorios/RelatoriosMaterial.tsx` | `EmbryoIcon` |

---

## Fase 2 — Acessibilidade: aria-label restantes (4 botões)

| Arquivo | Linha | Ação |
|---------|-------|------|
| `components/layout/Header.tsx` | ~47 | `aria-label={isDark ? 'Modo claro' : 'Modo escuro'}` |
| `pages/relatorios/RelatoriosProducao.tsx` | ~549 | `aria-label="Limpar filtros"` |
| `pages/relatorios/RelatoriosMaterial.tsx` | ~487 | `aria-label="Limpar filtros"` |
| `components/embryoscore/VideoUploadButton.tsx` | ~131 | `aria-label="Enviar arquivo de vídeo"` |

---

## Fase 3 — Console.log cleanup (debug logs restantes)

Remover/substituir `console.log`/`console.warn` de debug que não são erros reais:

| Arquivo | Descrição |
|---------|-----------|
| `pages/LotesFIV.tsx` | ~6 console.warn de EmbryoScore debug |
| `components/home/HomeDashboardAdmin.tsx` | console.error sem toast |
| `components/home/HomeDashboardOperacional.tsx` | console.error sem toast |

> **Nota:** `console.error` em catch blocks são aceitáveis. Só remover os `.log`/`.warn` de debug.

---

## Fase 4 — Error handling em queries Supabase (WRITES prioritários)

**Prioridade ALTA — WRITES sem error handling (risco de corrupção silenciosa):**

| Arquivo | Tabela(s) | Tipo |
|---------|-----------|------|
| `pages/LotesFIV.tsx` | `lote_fiv_acasalamentos` (3 writes) | update |
| `pages/Bancada.tsx` | `embrioes` (1 write) | update |
| `hooks/useEmbryoReview.ts` | `embryo_scores`, `embryo_references` (2 writes) | update/delete |
| `hooks/useTransferenciaHandlers.ts` | `protocolos_sincronizacao`, `receptoras`, `embrioes` (3 writes) | update |
| `hooks/aspiracoes/usePacoteAspiracaoData.ts` | `pacotes_aspiracao` (1 write) | update |
| `hooks/useTransferenciaEmbrioesData.ts` | `transferencias_sessoes` (3 writes) | insert/delete |
| `hooks/embrioes/useEmbrioesActions.ts` | `pacotes_aspiracao_fazendas_destino` (1 delete) | delete |

**Padrão a aplicar:**
```typescript
const { error } = await supabase.from('tabela').update({...}).eq('id', id);
if (error) { toast.error('Erro ao atualizar tabela'); throw error; }
```

> **Nota:** READS sem error handling (~80+) são de risco menor — produzem dados vazios mas não corrompem. Podem ser tratados numa segunda etapa.

---

## Fase 5 — Key props com index (anti-pattern React)

Verificar se há outros `key={i}` ou `key={index}` em listas que deveriam usar IDs estáveis. (EscritorioP2 já foi corrigido no diff atual.)

---

## Resumo de Escopo

| Fase | Arquivos | Risco | Impacto |
|------|----------|-------|---------|
| 1. Imports | ~20 | Zero | Código limpo |
| 2. aria-label | 4 | Zero | Acessibilidade |
| 3. Console.log | ~3 | Zero | Menos ruído |
| 4. Error handling (writes) | ~7 | Baixo | Robustez crítica |
| 5. Key props | A verificar | Zero | Performance React |

**Total estimado: ~34 arquivos**
**Não inclui:** `as any` casts, tsconfig strict, CORS em Edge Functions (escopo maior, requer sessão dedicada).
