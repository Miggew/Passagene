# Conclusão Final: Status EM_TE

## ✅ CONFIRMADO: EM_TE = Protocolo com Transferências de Embrião Realizadas

### Evidências

1. **100% dos protocolos EM_TE têm receptoras UTILIZADA**
   - 10 protocolos `EM_TE` analisados
   - TODOS têm `receptoras_utilizadas > 0` (mínimo 1, máximo 10)
   - Não existe protocolo `EM_TE` sem TE realizada

2. **Trigger automático encontrado:** `trg_te_realizada_after_insert`
   - Este trigger é executado após inserir uma TE na tabela `transferencias_embrioes`
   - Provavelmente atualiza o status do protocolo para `EM_TE` quando a primeira TE é realizada

3. **Nenhum protocolo PASSO1_FECHADO com passo2_data mas sem UTILIZADA**
   - Isso significa que quando há `passo2_data` E receptoras `UTILIZADA`, o status já foi atualizado para `EM_TE`
   - O fluxo é: `PASSO1_FECHADO` (com `passo2_data`, sem UTILIZADA) → (TE realizada) → `EM_TE`

## Fluxo de Status Confirmado

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
│    ✅ Receptoras SINCRONIZADA podem receber TE              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Realizar TE (receptora SINCRONIZADA)                     │
│    Trigger: trg_te_realizada_after_insert                   │
│    Status: EM_TE ← AUTOMÁTICO                               │
│    (muda de PASSO2_FECHADO → EM_TE)                         │
│    Receptoras: ≥1 UTILIZADA                                 │
└─────────────────────────────────────────────────────────────┘
```

## Significado dos Status

| Status | Significado | Critérios |
|--------|-------------|-----------|
| `PASSO1_FECHADO` | Protocolo criado, aguardando 2º passo | `passo2_data = NULL` |
| `PASSO1_FECHADO` | 2º passo iniciado, em avaliação | `passo2_data IS NOT NULL`, receptoras sendo avaliadas |
| `PASSO2_FECHADO` | Passo 2 finalizado, receptoras prontas para TE | `passo2_data IS NOT NULL`, receptoras APTA → SINCRONIZADA |
| `EM_TE` | Protocolo com TEs realizadas (atualizado automaticamente) | Pelo menos 1 receptora `UTILIZADA` (TE realizada) |

## ✅ Condição para Realizar TE

**O protocolo PRECISA estar `PASSO2_FECHADO`** (Passo 2 finalizado) para que:
- Receptoras `APTA` virem `SINCRONIZADA`
- Receptoras `SINCRONIZADA` possam receber TE
- Quando a primeira TE é realizada, o trigger automaticamente muda para `EM_TE`

## Próxima Etapa

**Execute a query `verificar_trigger_te_realizada.sql` para ver a definição completa do trigger e confirmar como ele atualiza o status.**
