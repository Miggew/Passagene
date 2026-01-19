# 📋 Resumo Completo: Status dos Protocolos de Sincronização

## 🎯 Status Existentes no Sistema

### 1. **PASSO1_FECHADO** / **PRIMEIRO_PASSO_FECHADO**
- **Quando é definido:** Após finalizar o 1º passo do protocolo
- **Significado:** Protocolo criado, receptoras selecionadas, 1º passo concluído
- **Campos do protocolo:**
  - `status = 'PASSO1_FECHADO'` ou `'PRIMEIRO_PASSO_FECHADO'`
  - `passo2_data = NULL`
  - `passo2_tecnico_responsavel = NULL`
- **Status das receptoras:** Todas com `status = 'INICIADA'` na tabela `protocolo_receptoras`
- **Próximo passo:** Aguardando início do 2º passo
- **Ações possíveis:**
  - ✅ Iniciar 2º Passo (preencher `passo2_data` e `passo2_tecnico_responsavel`)
  - ✅ Ver relatório
  - ✅ Gerenciar receptoras (adicionar/remover)

---

### 2. **PASSO1_FECHADO** ⚠️ (Estado temporário em memória)
- **Quando:** Usuário navegou para a tela do Passo 2, mas ainda não finalizou
- **Significado:** Protocolo sendo avaliado no 2º passo (dados apenas em memória)
- **Campos do protocolo NO BANCO:**
  - `status = 'PASSO1_FECHADO'` (ainda)
  - `passo2_data = NULL` ⚠️ (ainda não salvo)
  - `passo2_tecnico_responsavel = NULL` ⚠️ (ainda não salvo)
- **Campos na INTERFACE:**
  - `passo2_data` e `passo2_tecnico_responsavel` preenchidos em memória (estado local React)
  - Dados ficam apenas na tela até finalizar
- **Status das receptoras NO BANCO:**
  - Todas ainda `INICIADA` (se não foram avaliadas antes)
  - Ou `APTA`/`INAPTA` (se já foram avaliadas em sessão anterior)
- **Importante:** 
  - ❌ **NÃO é um status no banco de dados**
  - ✅ É apenas um estado temporário na interface
  - ✅ Se usuário sair sem finalizar, nada é salvo
  - ✅ Só quando "Finalizar 2º Passo" é clicado, tudo é salvo de uma vez
- **Próximo passo:** Finalizar 2º Passo (salva tudo: data, técnico, status, receptoras)
- **Ações possíveis:**
  - ✅ Avaliar receptoras (APTA/INAPTA) - salva no banco imediatamente
  - ✅ Finalizar 2º Passo (salva TUDO: `passo2_data`, `passo2_tecnico_responsavel`, `status = PASSO2_FECHADO`)
  - ✅ Cancelar/Sair (não salva `passo2_data` nem `passo2_tecnico_responsavel`)

---

### 3. **PASSO2_FECHADO**
- **Quando é definido:** Quando o 2º passo é finalizado (todas as receptoras avaliadas)
- **Significado:** Passo 2 concluído, receptoras prontas para receber TE
- **Campos do protocolo:**
  - `status = 'PASSO2_FECHADO'` ✅
  - `passo2_data IS NOT NULL` ✅
  - `passo2_tecnico_responsavel IS NOT NULL` ✅
  - `data_retirada` preenchida
- **Status das receptoras após finalizar:**
  - `APTA` → Status da receptora muda para `SINCRONIZADA`
  - `INAPTA` → Status da receptora muda para `VAZIA`
  - Receptoras `SINCRONIZADA` podem receber TE
- **Próximo passo:** Realizar Transferências de Embrião (TE)
- **Ações possíveis:**
  - ✅ Realizar TE (receptoras `SINCRONIZADA` podem receber embriões)
  - ✅ Ver relatório
  - ⚠️ **CONDIÇÃO PARA TE:** Protocolo DEVE estar `PASSO2_FECHADO` para realizar TE

---

### 4. **EM_TE**
- **Quando é definido:** **AUTOMATICAMENTE** pelo trigger `trg_te_realizada_after_insert` quando a primeira TE é realizada
- **Significado:** Protocolo com Transferências de Embrião em andamento
- **Campos do protocolo:**
  - `status = 'EM_TE'` ✅ (atualizado automaticamente pelo trigger)
  - `passo2_data IS NOT NULL` ✅
  - `passo2_tecnico_responsavel IS NOT NULL` ✅
- **Trigger automático:**
  ```sql
  -- Quando uma TE é inserida com status_te = 'REALIZADA':
  1. Atualiza protocolo_receptoras.status = 'UTILIZADA' (receptora que recebeu TE)
  2. Atualiza embrioes.status_atual = 'TRANSFERIDO'
  3. Atualiza protocolos_sincronizacao.status = 'EM_TE'
     CONDIÇÃO: where status <> 'FECHADO'
  ```
- **Status das receptoras:**
  - Pelo menos 1 receptora com `status = 'UTILIZADA'` na tabela `protocolo_receptoras`
  - Outras receptoras podem ainda estar `SINCRONIZADA` (aguardando TE)
- **Próximo passo:** Continuar realizando TEs ou aguardar diagnóstico
- **Ações possíveis:**
  - ✅ Realizar mais TEs
  - ✅ Ver relatório
  - ⚠️ Não pode mais finalizar/cancelar passo 2

---

### 5. **ABERTO** / **PASSO1_ABERTO** ❌ **REMOVIDO**
- **Status:** ❌ **NÃO EXISTE MAIS NO CÓDIGO**
- **Motivo:** Removido porque não faz sentido - protocolos são criados já com `PASSO1_FECHADO`
- **Observação:** Referências removidas de `Protocolos.tsx`, `FazendaDetail.tsx` e `ProtocoloDetail.tsx`

---

## 🔄 Fluxo Completo de Status

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CRIAÇÃO DO PROTOCOLO                                     │
│    ───────────────────────────────────────────────────────  │
│    Status: PASSO1_FECHADO                                  │
│    passo2_data: NULL                                       │
│    Receptoras: Todas INICIADA                              │
│    ✅ Protocolo criado, receptoras selecionadas            │
└─────────────────────────────────────────────────────────────┘
                        ↓
                        │ [Ação: Iniciar 2º Passo]
                        │ Preencher passo2_data e passo2_tecnico_responsavel
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 2º PASSO EM AVALIAÇÃO (estado temporário em memória)    │
│    ───────────────────────────────────────────────────────  │
│    NO BANCO:                                                │
│    Status: PASSO1_FECHADO (ainda)                          │
│    passo2_data: NULL ⚠️ (não salvo ainda)                 │
│    passo2_tecnico_responsavel: NULL ⚠️ (não salvo ainda)  │
│                                                             │
│    NA INTERFACE:                                            │
│    passo2_data: Preenchido ✅ (em memória)                 │
│    passo2_tecnico_responsavel: Preenchido ✅ (em memória)  │
│    Receptoras: INICIADA, APTA, INAPTA                      │
│    ✅ Receptoras sendo avaliadas (mudanças salvas imediatamente) │
│    ⚠️ Dados do passo 2 ficam apenas em memória até finalizar │
└─────────────────────────────────────────────────────────────┘
                        ↓
                        │ [Ação: Finalizar 2º Passo]
                        │ Todas receptoras avaliadas (APTA/INAPTA)
                        │ Salva TUDO de uma vez:
                        │ - passo2_data
                        │ - passo2_tecnico_responsavel
                        │ - status = PASSO2_FECHADO
                        │ - Receptoras APTA → SINCRONIZADA
                        │ - Receptoras INAPTA → VAZIA
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 2º PASSO FINALIZADO                                     │
│    ───────────────────────────────────────────────────────  │
│    Status: PASSO2_FECHADO ✅                               │
│    passo2_data: Preenchido ✅                              │
│    passo2_tecnico_responsavel: Preenchido ✅               │
│    Receptoras: SINCRONIZADA (prontas para TE)              │
│    ✅ CONDIÇÃO PARA REALIZAR TE                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
                        │ [Ação: Realizar TE]
                        │ Transferir embrião para receptora SINCRONIZADA
                        │ Trigger: trg_te_realizada_after_insert
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. TE REALIZADA                                            │
│    ───────────────────────────────────────────────────────  │
│    Status: EM_TE ✅ (AUTOMÁTICO pelo trigger)              │
│    passo2_data: Preenchido ✅                              │
│    Receptoras: ≥1 UTILIZADA                                │
│    ✅ Protocolo com TEs em andamento                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
                        │ [Ação: Continuar realizando TEs ou aguardar diagnóstico]
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. PROTOCOLO EM ANDAMENTO                                  │
│    ───────────────────────────────────────────────────────  │
│    Status: EM_TE                                           │
│    ✅ TEs realizadas, aguardando diagnóstico de gestação   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Tabela Comparativa

| Status | passo2_data (BANCO) | Receptoras UTILIZADAS | Receptoras Status | Significado | Ações Disponíveis |
|--------|---------------------|----------------------|-------------------|-------------|-------------------|
| `PASSO1_FECHADO` | `NULL` | 0 | `INICIADA` | Aguardando 2º passo | Iniciar 2º Passo, Ver Relatório |
| `PASSO1_FECHADO` ⚠️ | `NULL` (em memória: preenchido) | 0 | `INICIADA`, `APTA`, `INAPTA` | 2º passo em avaliação (dados não salvos) | Finalizar 2º Passo, Cancelar |
| `PASSO2_FECHADO` | Preenchido ✅ | 0 | `SINCRONIZADA`, `VAZIA` | 2º passo finalizado (pronto para TE) | **Realizar TE** ✅ |
| `EM_TE` | Preenchido ✅ | ≥ 1 | `UTILIZADA`, `SINCRONIZADA` | TEs em andamento | Realizar mais TEs, Ver Relatório |

**⚠️ Nota:** O estado "PASSO1_FECHADO com passo2_data em memória" **NÃO existe no banco de dados**. Os dados `passo2_data` e `passo2_tecnico_responsavel` só são salvos quando o 2º passo é finalizado.

---

## ⚠️ Condições Importantes

### 1. Condição para Realizar TE
✅ **O protocolo DEVE estar `PASSO2_FECHADO`** para realizar Transferência de Embrião
- Receptoras `APTA` viram `SINCRONIZADA` quando o passo 2 é finalizado
- Apenas receptoras `SINCRONIZADA` podem receber TE
- O trigger muda automaticamente para `EM_TE` quando a primeira TE é realizada

### 2. Trigger Automático `trg_te_realizada_after_insert`
✅ **Executado automaticamente quando uma TE é inserida com `status_te = 'REALIZADA'`**
- Atualiza `protocolo_receptoras.status = 'UTILIZADA'` (receptora que recebeu TE)
- Atualiza `embrioes.status_atual = 'TRANSFERIDO'`
- Atualiza `protocolos_sincronizacao.status = 'EM_TE'` (se protocolo não estiver `FECHADO`)

### 3. Status `EM_TE` é Automático
✅ **Não é definido manualmente no código**
- O código nunca atualiza para `EM_TE` explicitamente
- Apenas o trigger do banco de dados atualiza para `EM_TE`
- O código deve apenas reconhecer e tratar `EM_TE` quando aparece

---

## 🔍 Verificações no Código

### Onde cada status é usado/definido:

1. **PASSO1_FECHADO:**
   - Criado em: `ProtocoloFormWizard.tsx` (ao finalizar 1º passo)
   - Usado em: `Protocolos.tsx`, `ProtocoloDetail.tsx`, `FazendaDetail.tsx`
   - Filtros: "Aguardando 2º Passo"
   - **Importante:** Após unificação do Passo 2, protocolos podem estar `PASSO1_FECHADO` mesmo durante avaliação do 2º passo (dados ficam apenas em memória)

2. **PASSO1_FECHADO** (durante avaliação do 2º passo):
   - **Estado temporário em memória** (não existe no banco)
   - Dados `passo2_data` e `passo2_tecnico_responsavel` ficam apenas no estado React
   - Se usuário sair sem finalizar, nada é salvo
   - Receptoras podem ser avaliadas (mudanças salvas imediatamente no banco)

3. **PASSO2_FECHADO:**
   - Definido em: `ProtocoloPasso2.tsx` (função `handleFinalizarPasso2`)
   - **Salva TUDO de uma vez:** `passo2_data`, `passo2_tecnico_responsavel`, `status = PASSO2_FECHADO`
   - Usado em: `Protocolos.tsx`, `ProtocoloRelatorioFechado.tsx`
   - Filtros: "Fechados"
   - **CONDIÇÃO OBRIGATÓRIA** para realizar TE

4. **EM_TE:**
   - Definido em: **Banco de dados** (trigger `trg_te_realizada_after_insert`)
   - Usado em: `Protocolos.tsx`, `FazendaDetail.tsx`
   - **NUNCA** definido no código TypeScript/React

5. **ABERTO/PASSO1_ABERTO:**
   - ❌ **REMOVIDO** - Não existe mais no código

---

## 📝 Status das Receptoras no Protocolo

### Na tabela `protocolo_receptoras`:

| Status | Quando | Significado |
|--------|--------|-------------|
| `INICIADA` | Criado no 1º passo | Receptora no protocolo, aguardando avaliação no 2º passo |
| `APTA` | Aprovada no 2º passo | Receptora apta para receber TE |
| `INAPTA` | Descartada no 2º passo | Receptora descartada do protocolo |
| `UTILIZADA` | TE realizada | Receptora recebeu embrião (atualizado pelo trigger) |
| `NAO_UTILIZADA` | Sistema antigo | ❌ Não usado mais (estava na função `fechar_protocolo`) |

---

## 🎯 Resumo Executivo

1. **PASSO1_FECHADO** = Protocolo criado, aguardando 2º passo
   - `passo2_data = NULL`
   - `passo2_tecnico_responsavel = NULL`
   
2. **PASSO1_FECHADO** ⚠️ (estado temporário) = 2º passo em avaliação
   - **NÃO existe no banco de dados**
   - Dados `passo2_data` e `passo2_tecnico_responsavel` ficam apenas em memória
   - Se usuário sair sem finalizar, nada é salvo
   - Receptoras podem ser avaliadas (mudanças salvas imediatamente)
   
3. **PASSO2_FECHADO** = 2º passo finalizado, **PRONTO PARA TE** ✅
   - `passo2_data` e `passo2_tecnico_responsavel` salvos no banco
   - Todas receptoras avaliadas (APTA → SINCRONIZADA, INAPTA → VAZIA)
   
4. **EM_TE** = TE(s) realizada(s), atualizado **AUTOMATICAMENTE** pelo trigger
   - Pelo menos 1 receptora com status `UTILIZADA`
   
5. **ABERTO/PASSO1_ABERTO** = ❌ **REMOVIDO**

**Fluxo crítico:** 
- Não existe estado intermediário no banco durante avaliação do 2º passo
- Dados do passo 2 só são salvos quando **finalizado** (status = `PASSO2_FECHADO`)
- `PASSO2_FECHADO` é **CONDIÇÃO OBRIGATÓRIA** para realizar TE
- Após a primeira TE, o trigger muda automaticamente para `EM_TE`
