# 🔍 Diagnóstico do Erro 400 ao Criar Embriões

## Problema Relatado

- Alguns embriões foram salvos mas não apareceram
- Campo de quantidade voltou para 0
- Ao tentar salvar novamente, erro 400 (Bad Request)

## Possíveis Causas

### 1. Migration SQL não executada completamente
Se a migration `migrations_embrioes_sistema_completo.sql` não foi executada, o campo `lote_fiv_acasalamento_id` pode não existir na tabela `embrioes`.

**Verificação:**
```sql
-- Verificar se o campo existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'embrioes'
AND column_name = 'lote_fiv_acasalamento_id';
```

### 2. Campos obrigatórios faltando
A tabela `embrioes` pode ter campos NOT NULL que não estão sendo preenchidos.

**Verificação:**
```sql
-- Verificar constraints da tabela
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'embrioes'::regclass
ORDER BY contype, conname;
```

### 3. Violação de constraint
Pode haver uma constraint que está sendo violada (ex: foreign key, check constraint).

**Verificação:**
- Abra o console do navegador (F12)
- Veja a mensagem de erro completa no Network tab
- Clique no request que falhou e veja a resposta completa

### 4. RLS (Row Level Security)
As políticas RLS podem estar bloqueando a inserção.

**Verificação:**
```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'embrioes';
```

## Solução Imediata

1. **Abra o console do navegador (F12)**
2. **Vá na aba Network**
3. **Tente salvar novamente**
4. **Clique no request POST que falhou**
5. **Veja a aba "Response" ou "Preview"** para ver a mensagem de erro completa
6. **Copie a mensagem de erro completa**

A mensagem de erro vai indicar exatamente qual é o problema!

## Correção Implementada

Adicionei melhor tratamento de erro no código para mostrar a mensagem completa do servidor. Agora o erro será exibido com mais detalhes.
