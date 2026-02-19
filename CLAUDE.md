# PassaGene - Instruções

## REGRA PRINCIPAL
**NUNCA efetue mudanças no código sem aprovação prévia do usuário.**

---

## Contexto
Sistema de gestão de FIV (Fertilização In Vitro) para gado bovino.
Stack: Vite + React 19 + TypeScript + Tailwind + Supabase + TanStack Query + shadcn/ui

---

## Design
**Toda referência visual/UI está em `DESIGN-SYSTEM.md`** — fonte única de verdade. Não duplicar aqui.

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
- Rotas e tabelas: `DOCS.md`
- Design e UI: `DESIGN-SYSTEM.md`
