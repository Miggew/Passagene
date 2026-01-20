# 🔧 Corrigir Erro ao Salvar Dose de Sêmen (400 Bad Request)

## ⚠️ Problema
Erro 400 ao tentar salvar uma dose de sêmen. Isso geralmente indica que a tabela `doses_semen` não foi migrada para usar `touro_id` ou há uma constraint violada.

---

## ✅ Solução: Verificar e Corrigir

### **Passo 1: Verificar Estrutura da Tabela**

Execute este SQL no Supabase para verificar a estrutura:

```sql
-- Ver todas as colunas da tabela doses_semen
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'doses_semen'
ORDER BY ordinal_position;
```

**Verificar:**
- ✅ Existe coluna `touro_id`?
- ✅ Existe coluna `cliente_id`?
- ✅ Existe coluna `tipo_semen`?
- ✅ Existe coluna `quantidade`?

---

### **Passo 2: Verificar se a Tabela Touros Existe**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'touros';
```

**Deve retornar:** `touros`

**Se não retornar nada:** Execute o script `criar_tabela_touros.sql` primeiro!

---

### **Passo 3: Verificar se há Touros Cadastrados**

```sql
SELECT COUNT(*) as total_touros FROM touros;
```

**Se retornar 0:** Você precisa cadastrar pelo menos um touro antes de criar doses!

---

### **Passo 4: Migrar Tabela doses_semen**

Se a coluna `touro_id` **NÃO existe**, execute o script de migração:

**Arquivo:** `migrar_doses_semen_para_touros_limpo.sql`

Ou execute diretamente:

```sql
-- Se você ZEROU o banco de dados (sem dados existentes):
ALTER TABLE public.doses_semen 
ADD COLUMN IF NOT EXISTS touro_id UUID NOT NULL REFERENCES public.touros(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_doses_semen_touro_id ON public.doses_semen(touro_id);

-- Remover campos obsoletos (se existirem)
ALTER TABLE public.doses_semen 
DROP COLUMN IF EXISTS nome,
DROP COLUMN IF EXISTS raca;
```

---

### **Passo 5: Se houver dados existentes**

Se você tem doses antigas sem `touro_id`, você precisa:

1. **Opção A: Remover doses antigas**
   ```sql
   DELETE FROM doses_semen WHERE touro_id IS NULL;
   ```

2. **Opção B: Vincular doses antigas a um touro** (antes de tornar obrigatório)
   ```sql
   -- Primeiro, adicionar touro_id permitindo NULL
   ALTER TABLE public.doses_semen 
   ADD COLUMN IF NOT EXISTS touro_id UUID REFERENCES public.touros(id);
   
   -- Atualizar doses existentes (substitua 'ID_DO_TOURO' pelo ID real)
   UPDATE doses_semen 
   SET touro_id = 'ID_DO_TOURO' 
   WHERE touro_id IS NULL;
   
   -- Depois, tornar obrigatório
   ALTER TABLE public.doses_semen 
   ALTER COLUMN touro_id SET NOT NULL;
   ```

---

## 🔍 Verificação Rápida

Execute este script completo para verificar tudo:

**Arquivo:** `verificar_e_corrigir_doses_semen.sql`

Ele vai:
1. ✅ Verificar estrutura da tabela
2. ✅ Verificar se `touro_id` existe
3. ✅ Verificar se tabela `touros` existe
4. ✅ Verificar se há touros cadastrados
5. ✅ Corrigir automaticamente se possível

---

## ✅ Ordem Correta de Execução dos Scripts

Se você **ZEROU o banco**, execute nesta ordem:

1. **`criar_tabela_touros.sql`** - Criar tabela de touros
2. **`migrar_doses_semen_para_touros_limpo.sql`** - Adicionar `touro_id` em `doses_semen`
3. **Cadastrar touros** - Via interface do sistema
4. **Cadastrar doses de sêmen** - Agora deve funcionar!

---

## 🆘 Se ainda não funcionar

1. **Verificar console do navegador:**
   - Abra DevTools (F12)
   - Veja a aba "Console" ou "Network"
   - Copie a mensagem de erro completa

2. **Verificar dados sendo enviados:**
   - No código, verifique se `touro_id` está sendo enviado corretamente
   - Verifique se o `touro_id` existe na tabela `touros`

3. **Verificar constraints:**
   ```sql
   -- Ver constraints da tabela doses_semen
   SELECT 
       conname AS constraint_name,
       contype AS constraint_type,
       pg_get_constraintdef(oid) AS constraint_definition
   FROM pg_constraint
   WHERE conrelid = 'public.doses_semen'::regclass;
   ```

---

## 📝 Resumo

**Erro 400 geralmente significa:**
- ❌ Campo `touro_id` não existe na tabela `doses_semen`
- ❌ Tabela `touros` não existe
- ❌ Não há touros cadastrados
- ❌ Foreign key violada (touro_id não existe na tabela touros)
- ❌ Constraint NOT NULL violada

**Solução:**
1. Execute `criar_tabela_touros.sql`
2. Execute `migrar_doses_semen_para_touros_limpo.sql`
3. Cadastre pelo menos um touro
4. Tente criar a dose novamente

---

Execute o script `verificar_e_corrigir_doses_semen.sql` para diagnóstico completo!
