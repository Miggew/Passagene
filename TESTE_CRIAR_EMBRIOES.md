# 🧪 Como Testar a Criação Automática de Embriões

## Passo a Passo para Criar Embriões

### 1. Pré-requisitos
- [ ] Migration SQL executada (`migrations_embrioes_sistema_completo.sql`)
- [ ] App rodando (`pnpm dev`)
- [ ] Ter um lote FIV com acasalamentos

### 2. Processo de Criação

1. **Acesse "Lotes FIV"** (menu lateral)
2. **Clique em um lote** para ver detalhes
3. **Verifique se o lote está no D7 ou D8**:
   - O sistema só permite informar quantidade_embrioes no D7 ou D8
4. **Na tabela de acasalamentos**, encontre a coluna "Quantidade Embriões"
5. **Digite um número** (ex: 5) no campo
6. **Clique em "Salvar"** (botão ao lado)
7. **Aguarde a mensagem de sucesso**: "X embrião(ões) criado(s) automaticamente"

### 3. Verificação

Após salvar, os embriões devem:
- ✅ Ser criados no banco de dados
- ✅ Aparecer na página "Embriões/Estoque"
- ✅ Ter status `FRESCO`
- ✅ Ter `lote_fiv_id` e `lote_fiv_acasalamento_id` preenchidos

### 4. Verificação no Banco

```sql
-- Ver últimos embriões criados
SELECT 
  e.id,
  e.lote_fiv_id,
  e.lote_fiv_acasalamento_id,
  e.status_atual,
  e.created_at,
  a.quantidade_embrioes
FROM embrioes e
LEFT JOIN lote_fiv_acasalamentos a ON e.lote_fiv_acasalamento_id = a.id
ORDER BY e.created_at DESC
LIMIT 10;
```

### 5. Se Não Funcionar

**Verifique no console do navegador (F12):**
- Há erros?
- A requisição foi feita?
- Qual a resposta do servidor?

**Verifique no Supabase:**
- Os campos `lote_fiv_acasalamento_id` existem na tabela `embrioes`?
- Há políticas RLS permitindo INSERT na tabela `embrioes`?
