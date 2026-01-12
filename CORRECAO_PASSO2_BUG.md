# 🐛 Correção do Bug: Passo 2 Não Abre

## Problema Reportado

**Sintoma:** Passo 2 não abre mais, aparece mensagem "protocolo inconsistente - não possui receptoras vinculadas", mesmo quando o protocolo TEM receptoras vinculadas.

## 🔍 Causa Identificada

A query estava usando `select()` explícito tentando buscar campos (`ciclando_classificacao`, `qualidade_semaforo`) que podem não existir ainda se a migration SQL não foi executada. Isso pode estar causando falha na query ou retorno vazio.

## ✅ Correções Implementadas

### 1. Query Simplificada

**Antes:**
```typescript
.select('id, protocolo_id, receptora_id, status, motivo_inapta, observacoes, ciclando_classificacao, qualidade_semaforo, data_inclusao, data_retirada')
```

**Depois:**
```typescript
.select('*')
```

### 2. Tratamento Opcional de Campos Novos

Os campos `ciclando_classificacao` e `qualidade_semaforo` são tratados opcionalmente usando verificação `'campo' in pr` antes de acessar.

### 3. Logs de Debug Adicionados

Adicionados logs detalhados no console para identificar o problema:
- Protocolo ID
- Quantidade de receptoras retornadas
- Dados da primeira receptora
- Erros detalhados (código, mensagem, detalhes)

### 4. Validação de ID

Adicionada validação para garantir que o ID do protocolo existe antes de fazer a query.

## 📝 Verificações Necessárias

### 1. Executar Migration SQL

**IMPORTANTE:** Execute a migration `migrations_add_classificacoes_receptoras.sql` no Supabase antes de testar novamente.

Se a migration não foi executada:
- Os campos novos não existem na tabela
- A query funciona, mas os campos retornam `undefined`
- Isso não deveria quebrar a query, mas pode causar problemas

### 2. Verificar no Console

Ao abrir o Passo 2, verifique no console do navegador (F12):
- Logs de debug começando com `=== DEBUG loadReceptoras ===`
- Quantidade de receptoras retornadas
- Erros (se houver)

### 3. Verificar no Banco

Execute esta query no Supabase para verificar se há receptoras:

```sql
SELECT 
    pr.id,
    pr.protocolo_id,
    pr.receptora_id,
    pr.status,
    r.identificacao,
    r.nome
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '<ID_DO_PROTOCOLO_PROBLEMÁTICO>';
```

## 🔧 Se o Problema Persistir

1. **Verificar logs no console** - Veja exatamente o que está sendo retornado
2. **Verificar ID do protocolo** - Confirme que o ID está correto na URL
3. **Verificar permissões RLS** - Pode haver problema de Row Level Security no Supabase
4. **Testar query direto no Supabase** - Execute a query SQL acima para confirmar dados

## 📁 Arquivo Alterado

- `src/pages/ProtocoloPasso2.tsx`
  - Simplificada query para `select('*')`
  - Adicionados logs de debug
  - Melhorado tratamento de erros
  - Campos novos tratados opcionalmente

---

**Status:** ✅ Corrigido - Aguardando Teste
