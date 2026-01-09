# 🔧 Guia de Resolução: Protocolos Problemáticos

Este guia ajuda você a resolver os protocolos inconsistentes identificados pela auditoria.

---

## 📊 Situação Atual

De acordo com a auditoria:
- **Total de Protocolos:** 5
- **Protocolos sem Receptoras:** 1 ⚠️
- **Protocolos com Passo 2 sem Receptoras:** 1 🚨

---

## 🔍 Passo 1: Identificar Protocolos Problemáticos

Execute o script `identificar_protocolos_problematicos.sql` no Supabase SQL Editor para ver os detalhes:

1. Acesse: https://supabase.com/dashboard
2. Vá em **SQL Editor**
3. Cole e execute o script `identificar_protocolos_problematicos.sql`
4. Anote os **IDs** dos protocolos problemáticos

---

## 🤔 Passo 2: Decidir Ação para Cada Protocolo

### Cenário A: Protocolo sem Receptoras + SEM Passo 2

**Características:**
- Status: `PASSO1_FECHADO` ou `ABERTO`
- `passo2_data` está NULL
- Criado recentemente (últimos 7 dias)

**Ação Recomendada:** ✅ **DELETAR** (é seguro deletar)

**Motivo:** Protocolo criado mas receptoras não foram vinculadas corretamente. Não tem valor histórico.

---

### Cenário B: Protocolo sem Receptoras + COM Passo 2

**Características:**
- Status: `PASSO2_FECHADO` ou outro
- `passo2_data` está preenchido
- `passo2_tecnico_responsavel` está preenchido

**Ação Recomendada:** ⚠️ **ANALISAR ANTES DE DELETAR**

**Motivo:** Este é o caso mais crítico. Pode ter sido um erro durante a criação ou as receptoras foram deletadas acidentalmente.

**Opções:**
1. **Se foi criado recentemente por engano:** DELETAR
2. **Se tem histórico importante:** MANTER mas documentar
3. **Se você não tem certeza:** MANTER por enquanto

---

### Cenário C: Protocolo Antigo sem Receptoras

**Características:**
- Criado há mais de 30 dias
- Sem receptoras desde a criação

**Ação Recomendada:** ✅ **DELETAR** (provavelmente teste ou erro antigo)

---

## 🛠️ Passo 3: Executar Limpeza (SE APLICÁVEL)

### ⚠️ IMPORTANTE: BACKUP ANTES DE DELETAR

Antes de deletar qualquer protocolo, execute esta query para salvar os dados:

```sql
-- BACKUP dos protocolos que serão deletados
SELECT * FROM protocolos_sincronizacao 
WHERE id IN (
    -- Cole aqui os IDs dos protocolos que você quer deletar
    'id-1-aqui',
    'id-2-aqui'
);
```

**Copie o resultado e salve em um arquivo de texto como backup!**

---

### Opção 1: Deletar Protocolo Específico (Recomendado)

**Mais seguro** - deleta apenas protocolos que você identificou manualmente:

```sql
BEGIN;

-- Substitua '<PROTOCOLO_ID>' pelo ID real do protocolo que você quer deletar
DELETE FROM protocolos_sincronizacao
WHERE id = '<PROTOCOLO_ID>'
AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr 
    WHERE pr.protocolo_id = protocolos_sincronizacao.id
);

-- Verificar se deletou
SELECT COUNT(*) as deletados
FROM protocolos_sincronizacao
WHERE id = '<PROTOCOLO_ID>';

COMMIT;
-- Se algo deu errado, execute: ROLLBACK;
```

**Passos:**
1. Execute a query com `BEGIN;`
2. Substitua `<PROTOCOLO_ID>` pelo ID real
3. Verifique se deletou corretamente
4. Se estiver tudo OK, execute `COMMIT;`
5. Se algo deu errado, execute `ROLLBACK;` para reverter

---

### Opção 2: Deletar Protocolos Recentes sem Receptoras (Automático)

**Mais rápido** - deleta automaticamente protocolos criados nos últimos 7 dias sem receptoras:

```sql
BEGIN;

-- Deletar protocolos sem receptoras criados nos últimos 7 dias
DELETE FROM protocolos_sincronizacao
WHERE id IN (
    SELECT p.id
    FROM protocolos_sincronizacao p
    WHERE p.created_at >= NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
        SELECT 1 FROM protocolo_receptoras pr 
        WHERE pr.protocolo_id = p.id
    )
);

-- Verificar quantos foram deletados
SELECT COUNT(*) as protocolos_deletados
FROM protocolos_sincronizacao
WHERE created_at >= NOW() - INTERVAL '7 days'
AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr 
    WHERE pr.protocolo_id = protocolos_sincronizacao.id
);
-- Resultado esperado: 0 (nenhum protocolo sem receptoras restante)

COMMIT;
-- Se algo deu errado, execute: ROLLBACK;
```

---

### Opção 3: Deletar Protocolo com Passo 2 sem Receptoras (Cuidado!)

**Use apenas se tiver certeza de que foi um erro:**

```sql
BEGIN;

-- ⚠️ ATENÇÃO: Deletar protocolo com Passo 2 sem receptoras
-- ⚠️ Execute apenas se tiver certeza de que foi criado por engano
DELETE FROM protocolos_sincronizacao
WHERE id IN (
    SELECT p.id
    FROM protocolos_sincronizacao p
    WHERE p.passo2_data IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM protocolo_receptoras pr 
        WHERE pr.protocolo_id = p.id
    )
);

-- Verificar
SELECT COUNT(*) as protocolos_criticos_restantes
FROM protocolos_sincronizacao
WHERE passo2_data IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr 
    WHERE pr.protocolo_id = protocolos_sincronizacao.id
);
-- Resultado esperado: 0

COMMIT;
```

---

## ✅ Passo 4: Verificar Resultado

Após a limpeza, execute novamente a auditoria:

```sql
-- Executar auditoria novamente
SELECT 
    'Total de Protocolos' as metrica,
    COUNT(*)::text as valor
FROM protocolos_sincronizacao
UNION ALL
SELECT 
    'Protocolos sem Receptoras' as metrica,
    COUNT(*)::text as valor
FROM (
    SELECT p.id
    FROM protocolos_sincronizacao p
    LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
    GROUP BY p.id
    HAVING COUNT(pr.id) = 0
) as protocolos_sem_receptoras
UNION ALL
SELECT 
    'Protocolos com Passo 2 sem Receptoras' as metrica,
    COUNT(*)::text as valor
FROM (
    SELECT p.id
    FROM protocolos_sincronizacao p
    LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
    WHERE p.passo2_data IS NOT NULL
    GROUP BY p.id
    HAVING COUNT(pr.id) = 0
) as protocolos_criticos;
```

**Resultado Esperado após limpeza:**
- Protocolos sem Receptoras: **0**
- Protocolos com Passo 2 sem Receptoras: **0**

---

## 📋 Checklist de Execução

Siga esta ordem:

1. [ ] Execute `identificar_protocolos_problematicos.sql` para ver detalhes
2. [ ] Anote os IDs dos protocolos problemáticos
3. [ ] Decida a ação para cada protocolo (deletar ou manter)
4. [ ] **FAÇA BACKUP** dos protocolos que serão deletados
5. [ ] Execute a limpeza escolhida (Opção 1, 2 ou 3)
6. [ ] Verifique resultado com a auditoria novamente
7. [ ] Confirme que agora tem **0 protocolos problemáticos**

---

## ⚠️ Se Algo Der Errado

Se você executou um DELETE e percebeu que deletou algo errado:

1. **Execute imediatamente:** `ROLLBACK;` (se ainda estiver em transação)
2. **Se já fez COMMIT:** Use o backup que você salvou para restaurar manualmente

---

## 🎯 Recomendação Final

Para sua situação específica (1 protocolo sem receptoras + 1 protocolo crítico):

1. **Execute primeiro** `identificar_protocolos_problematicos.sql`
2. **Revise os detalhes** de cada protocolo
3. **Use a Opção 1** (deletar protocolo específico) - é mais seguro
4. **Delete um por vez** e verifique após cada deleção

Isso garante que você não deleta nada importante por engano.

---

## ❓ Dúvidas?

Se tiver dúvidas sobre algum protocolo específico, compartilhe os detalhes (ID, data de criação, status, etc.) e posso ajudar a decidir a melhor ação.
