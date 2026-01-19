# 📚 Documentação Completa: Status de Protocolos de Sincronização

## 📋 Lista Completa de Status

### 1. `ABERTO` / `PASSO1_ABERTO` ✅
- **Significado:** Protocolo no 1º passo (sincronização) em andamento
- **Características:**
  - Criado recentemente
  - Receptoras sendo adicionadas
  - Pode ser editado
- **Transição:** Finaliza para → `PASSO1_FECHADO`
- **Uso:** Status inicial ao criar protocolo

### 2. `PASSO1_FECHADO` ✅
- **Significado:** 1º passo (sincronização) concluído, aguardando 2º passo
- **Características:**
  - `passo2_data` = NULL (ainda não iniciou 2º passo)
  - Receptoras sincronizadas
  - Pode iniciar 2º passo
- **Transição:** Ao iniciar 2º passo → permanece `PASSO1_FECHADO` (durante 2º passo)
- **Uso:** Status intermediário após finalizar 1º passo

### 3. `PRIMEIRO_PASSO_FECHADO` ⚠️ (Legado)
- **Significado:** Variante legada de `PASSO1_FECHADO`
- **Características:** Mesmas de `PASSO1_FECHADO`
- **Recomendação:** Unificar com `PASSO1_FECHADO` em futura migração

### 4. `EM_TE` ⭐ **STATUS CRÍTICO - 66.67% dos protocolos**
- **Significado:** Protocolo com Transferências de Embriões já realizadas, mas ainda em andamento
- **Características:**
  - `passo2_data` preenchido (2º passo iniciado)
  - **Pelo menos uma receptora marcada como `UTILIZADA`** (TE realizada)
  - Protocolo ainda não foi finalizado
  - Pode ter receptoras ainda pendentes ou todas já utilizadas
- **Transição:** Ao finalizar protocolo → `PASSO2_FECHADO`
- **Quando é definido:**
  - Quando uma receptora é marcada como `UTILIZADA` na Transferência de Embriões
  - E o protocolo tem `passo2_data` preenchido
  - E ainda não foi fechado para `PASSO2_FECHADO`
- **Uso:** Status intermediário durante e após TEs, até finalizar protocolo

### 5. `PASSO2_FECHADO` ✅
- **Significado:** Protocolo completamente finalizado
- **Características:**
  - `passo2_data` preenchido
  - `data_retirada` preenchido
  - Todas as receptoras foram avaliadas no 2º passo
  - **Não tem receptoras `UTILIZADA`** (ou foram descartadas ou protocolo fechado sem TE)
  - Não pode mais editar
- **Transição:** Estado final - não há transição
- **Uso:** Status final após finalizar protocolo

---

## 🔄 Fluxo Completo de Status

```
[CRIAÇÃO]
    ↓
ABERTO / PASSO1_ABERTO
    ↓
[Finalizar 1º Passo]
    ↓
PASSO1_FECHADO / PRIMEIRO_PASSO_FECHADO
    ↓
[Iniciar 2º Passo] (preenche passo2_data e passo2_tecnico_responsavel)
    ↓
[Durante 2º Passo] (receptoras sendo avaliadas: APTA/INAPTA)
    ↓
[Primeira TE realizada] (primeira receptora marcada como UTILIZADA)
    ↓
EM_TE ⭐ (Status intermediário)
    ↓
[Continuar TEs] (mais receptoras podem ser servidas)
    ↓
[Finalizar Protocolo]
    ↓
PASSO2_FECHADO (Estado final)
```

---

## 📊 Estatísticas dos Status (Baseado em Dados Reais)

| Status | Quantidade | Percentual | Significado |
|--------|-----------|------------|-------------|
| `EM_TE` | 10 | 66.67% | Protocolos com TEs realizadas |
| `PASSO2_FECHADO` | 4 | 26.67% | Protocolos finalizados |
| `PASSO1_FECHADO` | 1 | 6.67% | Aguardando 2º passo |

**Total:** 15 protocolos

---

## ✅ Status Funcionais vs Redundantes

### Status Funcionais (Manter):
- ✅ `ABERTO`
- ✅ `PASSO1_FECHADO`
- ✅ `EM_TE` ⭐
- ✅ `PASSO2_FECHADO`

### Status Redundantes/Legados (Considerar Unificar):
- ⚠️ `PASSO1_ABERTO` → Unificar com `ABERTO`
- ⚠️ `PRIMEIRO_PASSO_FECHADO` → Unificar com `PASSO1_FECHADO`

---

## 🎯 Recomendações Finais

1. **Adicionar `EM_TE` ao código TypeScript** como status válido
2. **Incluir `EM_TE` nos filtros** da página de Protocolos
3. **Documentar oficialmente** o significado de `EM_TE`
4. **Considerar unificar** status redundantes em futura migração
