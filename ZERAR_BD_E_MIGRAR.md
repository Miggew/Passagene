# Instruções: Zerar BD e Aplicar Migração de Touros

## Ordem Recomendada: Zerar ANTES da Migração

✅ **Recomendado**: Zerar o BD ANTES de aplicar as migrations  
❌ **Não recomendado**: Zerar DEPOIS da migração (trabalho desnecessário)

## Passo a Passo

### 1. ⚠️ Fazer Backup (Mesmo que vá zerar, é bom ter um backup)
No Supabase: Settings > Database > Backups > Create Backup

### 2. 🗑️ Zerar o Banco de Dados

**Opção A: Via SQL Editor no Supabase**
```sql
-- ATENÇÃO: Isso remove TODOS os dados!
-- Execute apenas se tiver certeza

-- TRUNCATE com CASCADE já respeita foreign keys automaticamente
-- Não é necessário desabilitar foreign keys!
-- O CASCADE remove os dados em ordem, respeitando as dependências

TRUNCATE TABLE 
    doses_semen,
    lotes_fiv_acasalamentos,
    embrioes,
    lotes_fiv,
    aspiracoes_doadoras,
    pacotes_aspiracao,
    protocolo_receptoras,
    protocolos_sincronizacao,
    receptoras,
    doadoras,
    fazendas,
    clientes
CASCADE;

-- Ou se quiser remover as tabelas completamente (mais radical):
-- DROP TABLE IF EXISTS doses_semen CASCADE;
-- ... (outras tabelas)
```

**Opção B: Via Supabase Dashboard**
1. Vá em SQL Editor
2. Execute o script acima ajustado para suas tabelas
3. Ou use a opção de "Reset Database" se disponível

### 3. 📋 Aplicar Migrações (Na Ordem)

#### a) Criar Tabela de Touros
```sql
-- Execute: criar_tabela_touros.sql
```
Isso cria a estrutura do catálogo de touros.

#### b) Configurar Doses de Sêmen
```sql
-- Execute: migrar_doses_semen_para_touros_limpo.sql
```
Este script:
- Adiciona campo `touro_id` (obrigatório)
- Remove campos `nome` e `raca` (agora vêm do touro)
- Cria índices necessários

### 4. ✅ Verificar

```sql
-- Verificar estrutura da tabela touros
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'touros'
ORDER BY ordinal_position;

-- Verificar estrutura da tabela doses_semen
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'doses_semen'
ORDER BY ordinal_position;

-- Verificar foreign key
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'doses_semen';
```

### 5. 🧪 Testar na Aplicação

1. Abrir a aplicação
2. Acessar o menu "Catálogo de Touros"
3. Cadastrar um touro de teste
4. Acessar "Doses de Sêmen"
5. Criar uma dose relacionada ao touro
6. Verificar que as informações do touro aparecem na dose

## Estrutura Final

### Tabela `touros`
✅ Campos de identificação e genéticos  
✅ Índices e triggers configurados

### Tabela `doses_semen`
✅ `touro_id` (UUID, NOT NULL, FK para touros)  
✅ `cliente_id` (UUID, FK para clientes)  
✅ `tipo_semen` (CONVENCIONAL/SEXADO)  
✅ `quantidade` (INTEGER)  
❌ `nome` - **REMOVIDO** (vem do touro)  
❌ `raca` - **REMOVIDO** (vem do touro)

## Vantagens de Zerar ANTES

1. ✅ **Estrutura limpa**: Sem campos obsoletos desde o início
2. ✅ **Sem migração de dados**: Não precisa converter dados existentes
3. ✅ **Menos erros**: Não há risco de dados inconsistentes
4. ✅ **Mais rápido**: Migração mais simples e direta
5. ✅ **Teste limpo**: Pode testar do zero

## Checklist Final

- [ ] Backup criado
- [ ] BD zerado (todas as tabelas limpas)
- [ ] Tabela `touros` criada
- [ ] Tabela `doses_semen` atualizada (touro_id adicionado, nome/raca removidos)
- [ ] Foreign key funcionando
- [ ] Índices criados
- [ ] Aplicação testada
- [ ] Cadastro de touro funcionando
- [ ] Cadastro de dose funcionando
- [ ] Relação touro-dose funcionando

## Observações Importantes

⚠️ **RLS (Row Level Security)**: Se você usa RLS, pode precisar:
- Criar políticas para a tabela `touros`
- Atualizar políticas existentes de `doses_semen`

⚠️ **Testes**: Após zerar e migrar, teste todos os fluxos:
- Cadastro de touros
- Cadastro de doses
- Seleção de doses em lotes FIV
- Visualização de doses nos detalhes do cliente

## Próximos Passos Após Migração

1. Cadastrar touros no catálogo
2. Cadastrar doses para os clientes
3. Testar criação de lotes FIV com as novas doses
4. Verificar que tudo está funcionando
