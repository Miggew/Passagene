# 📋 Plano de Remoção de `fazenda_atual_id`

## 🎯 Objetivo
Remover completamente a dependência de `fazenda_atual_id` do sistema, usando apenas `receptora_fazenda_historico` como fonte da verdade.

---

## ✅ Passo a Passo

### 1. Verificar Dados Atuais
```sql
-- Executar: verificar_campos_nao_utilizados.sql
-- Verificar se há dados em fazenda_atual_id
```

**Resultado esperado**: Se `registros_com_valor = 0`, pode prosseguir.

---

### 2. Atualizar RPC `mover_receptora_fazenda`
```sql
-- Executar: fix_rpc_mover_receptora_fazenda_sem_fazenda_atual_id.sql
```

**Mudanças**:
- ✅ Removida atualização de `fazenda_atual_id` (linha 62)
- ✅ Removida atualização de `fazenda_atual_id` (linhas 125-129)
- ✅ Substituída verificação de brinco duplicado para usar histórico (linha 75)

---

### 3. Remover Campo do Banco de Dados
```sql
-- Executar: remover_fazenda_atual_id.sql
```

**O que faz**:
- Verifica se há dados
- Verifica se histórico está funcionando
- Remove constraint de foreign key
- Remove índice
- Remove coluna

---

### 4. Remover Referências no Código TypeScript

#### Arquivo: `src/lib/types.ts`
```typescript
// REMOVER:
fazenda_atual_id?: string;  // Linha 46
```

#### Arquivo: `src/lib/types.ts` (ReceptoraComStatus)
```typescript
// REMOVER ou MANTER apenas se usado em views:
fazenda_atual_id?: string;  // Linha 226
```

**Nota**: Se `ReceptoraComStatus` for usado apenas para views que não retornam `fazenda_atual_id`, pode manter por compatibilidade, mas não será preenchido.

---

### 5. Testar Funcionalidades

#### Teste 1: Mover Receptora entre Fazendas
- [ ] Criar receptora na Fazenda A
- [ ] Mover para Fazenda B
- [ ] Verificar histórico atualizado
- [ ] Verificar que não há erro

#### Teste 2: Mover Receptora em Protocolo Ativo
- [ ] Criar protocolo na Fazenda A
- [ ] Adicionar receptora ao protocolo
- [ ] Mover receptora para Fazenda B
- [ ] Verificar que protocolo foi criado na Fazenda B
- [ ] Verificar que receptora está no novo protocolo

#### Teste 3: Verificar Validação de Brinco Duplicado
- [ ] Criar Receptora A (brinco "123") na Fazenda A
- [ ] Criar Receptora B (brinco "123") na Fazenda B
- [ ] Tentar mover Receptora A para Fazenda B
- [ ] Verificar que erro é lançado corretamente

---

## ⚠️ Pontos de Atenção

### 1. Views que Podem Usar `fazenda_atual_id`
Verificar se há views que referenciam `fazenda_atual_id`:
```sql
SELECT table_name, view_definition 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND view_definition ILIKE '%fazenda_atual_id%';
```

Se encontrar, atualizar para usar `vw_receptoras_fazenda_atual` ou `receptora_fazenda_historico`.

### 2. Código Frontend
Verificar se há código que lê `fazenda_atual_id` diretamente:
```bash
# Buscar no código
grep -r "fazenda_atual_id" src/
```

### 3. Migrations Antigas
As migrations antigas podem ter referências a `fazenda_atual_id`, mas isso não é problema se o campo não existir mais.

---

## 📊 Checklist Final

- [ ] Executar `verificar_campos_nao_utilizados.sql`
- [ ] Executar `fix_rpc_mover_receptora_fazenda_sem_fazenda_atual_id.sql`
- [ ] Executar `remover_fazenda_atual_id.sql`
- [ ] Remover referências em `src/lib/types.ts`
- [ ] Testar mover receptora entre fazendas
- [ ] Testar mover receptora em protocolo ativo
- [ ] Verificar validação de brinco duplicado
- [ ] Verificar se há views que precisam ser atualizadas
- [ ] Verificar se há código frontend que precisa ser atualizado

---

## 🎯 Resultado Esperado

Após completar todos os passos:
- ✅ `fazenda_atual_id` não existe mais no banco
- ✅ RPC usa apenas histórico
- ✅ Código TypeScript não referencia mais o campo
- ✅ Todas as funcionalidades continuam funcionando

---

**Status**: ⏳ Aguardando execução dos scripts
