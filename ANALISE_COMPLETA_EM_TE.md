# Análise Completa: Status EM_TE

## ✅ Confirmado: Fluxo Correto

### Trigger `trg_te_realizada_after_insert`

```sql
-- Quando uma TE é inserida com status_te = 'REALIZADA':
1. Atualiza protocolo_receptoras.status = 'UTILIZADA'
2. Atualiza embrioes.status_atual = 'TRANSFERIDO'
3. Atualiza protocolos_sincronizacao.status = 'EM_TE'
   CONDIÇÃO: where status <> 'FECHADO'
```

**Importante:** O trigger muda para `EM_TE` **mesmo que o protocolo esteja `PASSO2_FECHADO`**, desde que não esteja `FECHADO`.

## Fluxo Completo e Correto

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Criação                                                   │
│    Status: PASSO1_FECHADO                                   │
│    passo2_data: NULL                                        │
│    Receptoras: INICIADA                                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Iniciar 2º Passo                                         │
│    Status: PASSO1_FECHADO                                   │
│    passo2_data: Preenchido                                  │
│    Receptoras: INICIADA, APTA, INAPTA                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Finalizar Passo 2                                        │
│    Status: PASSO2_FECHADO ✅ (CONDIÇÃO PARA TE)             │
│    passo2_data: Preenchido                                  │
│    Receptoras APTA → SINCRONIZADA                           │
│    Receptoras INAPTA → VAZIA                                │
│    ✅ Agora receptoras SINCRONIZADA podem receber TE        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Realizar TE (receptora SINCRONIZADA)                     │
│    Trigger: trg_te_realizada_after_insert                   │
│    Status: EM_TE ← AUTOMÁTICO                               │
│    (muda de PASSO2_FECHADO → EM_TE)                         │
│    Receptoras: ≥1 UTILIZADA                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Protocolo finalizado (quando todas TEs concluídas)       │
│    Status: Permanece EM_TE ou volta para PASSO2_FECHADO?    │
│    (Precisa verificar no código do app)                     │
└─────────────────────────────────────────────────────────────┘
```

## Conclusões

### 1. Condição para Realizar TE
✅ **O protocolo precisa estar `PASSO2_FECHADO`** (Passo 2 finalizado)
- Isso significa que todas as receptoras foram avaliadas (APTA/INAPTA)
- Receptoras APTA viram SINCRONIZADA
- Receptoras SINCRONIZADA podem receber TE

### 2. Quando EM_TE é Definido
✅ **Automaticamente pelo trigger quando a primeira TE é realizada**
- Trigger executa após inserir TE com `status_te = 'REALIZADA'`
- Muda status de `PASSO2_FECHADO` → `EM_TE`
- Condição: protocolo não pode estar `FECHADO` (status diferente do `PASSO2_FECHADO`)

### 3. Status EM_TE Significa
✅ **Protocolo com Transferências de Embrião em andamento**
- Pelo menos uma receptora foi marcada como `UTILIZADA` (TE realizada)
- Protocolo ainda está ativo (não totalmente fechado)
- Pode haver mais TEs a serem realizadas

## Função `fechar_protocolo`

Esta função parece ser de um sistema antigo:
- Usa `pacote_producao_id` (não existe mais no código atual)
- Fecha protocolo com status `'FECHADO'` (não `PASSO2_FECHADO`)
- Marca receptoras `APTA` não utilizadas como `NAO_UTILIZADA`
- **Provavelmente não é mais usada** (o código atual usa `PASSO2_FECHADO`)

## Próximos Passos

1. ✅ **Verificar no código se há lugar que muda `EM_TE` de volta para `PASSO2_FECHADO`**
2. ✅ **Documentar que `PASSO2_FECHADO` é pré-requisito para TE**
3. ✅ **Atualizar filtros/UI para refletir esse fluxo correto**
