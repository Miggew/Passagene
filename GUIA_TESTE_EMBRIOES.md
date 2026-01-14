# 🔍 Guia: Verificar Por Que Embriões Não Aparecem

## 📋 Checklist de Verificação

### 1. Migration SQL foi executada?
- [ ] Abra o Supabase Dashboard
- [ ] Vá em "SQL Editor"
- [ ] Verifique se a tabela `embrioes` tem os campos:
  - `lote_fiv_acasalamento_id`
  - `fazenda_destino_id`
  - `data_classificacao`
- [ ] Se não tiver, execute: `migrations_embrioes_sistema_completo.sql`

### 2. Embriões foram criados?
- [ ] No Supabase, vá em "Table Editor" → `embrioes`
- [ ] Verifique se há registros na tabela
- [ ] Se não houver, os embriões ainda não foram criados

### 3. Como criar embriões automaticamente?
Para criar embriões, você precisa:

1. **Ir em "Lotes FIV"** (menu lateral)
2. **Selecionar um lote que esteja no D7 ou D8**
3. **Clicar no lote para ver detalhes**
4. **Na tabela de acasalamentos, informar a quantidade de embriões**
5. **Clicar em "Salvar"**

Os embriões serão criados automaticamente!

### 4. Verificação no Banco de Dados

Execute este SQL no Supabase para verificar:

```sql
-- Ver quantos embriões existem
SELECT COUNT(*) as total_embrioes FROM embrioes;

-- Ver embriões criados recentemente
SELECT 
  id,
  lote_fiv_id,
  lote_fiv_acasalamento_id,
  status_atual,
  created_at
FROM embrioes
ORDER BY created_at DESC
LIMIT 10;

-- Ver se há acasalamentos com quantidade_embrioes
SELECT 
  id,
  lote_fiv_id,
  quantidade_embrioes,
  created_at
FROM lote_fiv_acasalamentos
WHERE quantidade_embrioes IS NOT NULL
ORDER BY created_at DESC;
```

### 5. Problemas Comuns

#### Problema: Tabela embrioes está vazia
**Solução**: Os embriões precisam ser criados através do processo automático em Lotes FIV

#### Problema: Erro ao carregar página de Embriões
**Solução**: 
- Abra o console do navegador (F12)
- Verifique se há erros
- Verifique se a migration SQL foi executada

#### Problema: Embriões criados mas não aparecem
**Solução**:
- Verifique se o campo `lote_fiv_id` está preenchido nos embriões
- Verifique se há erros no console do navegador
