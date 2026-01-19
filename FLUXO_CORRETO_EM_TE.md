# Fluxo Correto: EM_TE e Finalização do Passo 2

## ✅ Fluxo Confirmado

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
│    Status: PASSO2_FECHADO                                   │
│    passo2_data: Preenchido                                  │
│    Receptoras APTA → SINCRONIZADA                           │
│    Receptoras INAPTA → VAZIA                                │
│    ✅ Agora receptoras SINCRONIZADA podem receber TE        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Realizar TE (receptora SINCRONIZADA)                     │
│    Trigger: trg_te_realizada_after_insert                   │
│    Status: EM_TE ← AUTOMÁTICO (de PASSO2_FECHADO)           │
│    Receptoras: ≥1 UTILIZADA                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Protocolo completa ciclo                                 │
│    Status: Permanece EM_TE ou muda para outro status?       │
│    (Precisa verificar no trigger/função)                    │
└─────────────────────────────────────────────────────────────┘
```

## Conclusão

**O protocolo precisa estar PASSO2_FECHADO para que as receptoras APTA virem SINCRONIZADA e possam receber TE.**

**Quando a primeira TE é realizada:**
- O trigger `trg_te_realizada_after_insert` atualiza o status do protocolo para `EM_TE`
- Isso acontece mesmo que o protocolo esteja `PASSO2_FECHADO`

## Questão Pendente

**O trigger muda de `PASSO2_FECHADO` → `EM_TE` quando há TEs realizadas?**

Precisamos ver a definição do trigger para confirmar.
