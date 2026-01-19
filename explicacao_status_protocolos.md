# Explicação dos Status de Protocolos

## Fluxo de Status dos Protocolos

### 1. **PASSO1_FECHADO** / **PRIMEIRO_PASSO_FECHADO**
- **Quando:** Após finalizar o 1º passo do protocolo
- **Significado:** Protocolo criado, receptoras selecionadas, aguardando início do 2º passo
- **Campos:** `passo2_data = NULL`, `passo2_tecnico_responsavel = NULL`

### 2. **PASSO1_FECHADO** (com `passo2_data` preenchido)
- **Quando:** 2º passo foi iniciado (data e técnico preenchidos), mas ainda NÃO houve TEs realizadas
- **Significado:** Protocolo no 2º passo, mas nenhuma receptora foi ainda utilizada (status = UTILIZADA)
- **Campos:** `passo2_data IS NOT NULL`, `passo2_tecnico_responsavel IS NOT NULL`
- **Receptoras:** Todas ainda estão com status `APTA`, `INICIADA` ou `INAPTA` (nenhuma `UTILIZADA`)

### 3. **EM_TE**
- **Quando:** Há pelo menos uma receptora com status `UTILIZADA` (TE realizada)
- **Significado:** Protocolo no 2º passo E já houve pelo menos uma Transferência de Embrião realizada
- **Campos:** `passo2_data IS NOT NULL`, `passo2_tecnico_responsavel IS NOT NULL`
- **Receptoras:** Pelo menos uma com status `UTILIZADA`

### 4. **PASSO2_FECHADO**
- **Quando:** Protocolo finalizado (2º passo concluído)
- **Significado:** Todas as receptoras foram avaliadas (utilizadas ou descartadas), protocolo completo
- **Campos:** Todos os campos preenchidos conforme necessário

## Resumo

| Status | passo2_data | Receptoras UTILIZADAS | Significado |
|--------|-------------|----------------------|-------------|
| `PASSO1_FECHADO` | `NULL` | 0 | Aguardando início do 2º passo |
| `PASSO1_FECHADO` | Preenchido | 0 | 2º passo iniciado, mas nenhuma TE realizada |
| `EM_TE` | Preenchido | ≥ 1 | 2º passo iniciado E pelo menos uma TE realizada |
| `PASSO2_FECHADO` | Preenchido | - | Protocolo finalizado |

## Questão levantada

O usuário questionou se `EM_TE` é realmente o status correto para "início do 2º passo".

**Resposta:** Não. `EM_TE` não é o status para "início do 2º passo", mas sim para "protocolo com TEs realizadas".

**Status correto para "início do 2º passo":** `PASSO1_FECHADO` com `passo2_data` preenchido (mas sem receptoras UTILIZADAS ainda).

## Query para Verificar

Execute `verificar_status_pos_inicio_2_passo.sql` para verificar protocolos com `passo2_data` preenchido mas ainda com status `PASSO1_FECHADO` (sem receptoras UTILIZADAS).
