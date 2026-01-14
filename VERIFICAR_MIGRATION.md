# ⚠️ VERIFICAÇÃO URGENTE: Migration SQL

## O Erro 400 Indica que a Migration Pode Não Ter Sido Executada

O erro 400 acontece porque estamos tentando inserir o campo `lote_fiv_acasalamento_id`, mas ele pode não existir na tabela `embrioes`.

## Verificação no Supabase

Execute este SQL no Supabase SQL Editor:

```sql
-- Verificar se o campo lote_fiv_acasalamento_id existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'embrioes'
AND column_name = 'lote_fiv_acasalamento_id';
```

### Se NÃO retornar nenhuma linha:
**A migration NÃO foi executada!**

**Solução**: Execute o arquivo `migrations_embrioes_sistema_completo.sql` no Supabase SQL Editor.

### Se retornar a linha com o campo:
O campo existe, então o problema é outro. Veja o próximo passo.

## Verificar Erro Completo

1. Abra o console do navegador (F12)
2. Vá na aba **Network**
3. Tente salvar a quantidade novamente
4. Clique no request POST que falhou (status 400)
5. Vá na aba **Response** ou **Preview**
6. **Copie a mensagem de erro completa**

A mensagem vai indicar exatamente qual é o problema!

## Solução Rápida

Se a migration não foi executada:

1. Abra o Supabase Dashboard
2. Vá em "SQL Editor"
3. Copie todo o conteúdo do arquivo `migrations_embrioes_sistema_completo.sql`
4. Cole no SQL Editor
5. Clique em "Run"
6. Aguarde a execução
7. Tente criar os embriões novamente
