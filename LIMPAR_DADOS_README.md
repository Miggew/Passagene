# Limpeza de Dados de Teste

## Objetivo

Remover **apenas os dados cadastrados**, mantendo toda a estrutura do banco:
- ✅ Tabelas permanecem
- ✅ Índices permanecem  
- ✅ Constraints permanecem
- ✅ Foreign keys permanecem
- ✅ Triggers permanecem
- ❌ Apenas os **dados** são removidos

## Por que esta solução?

### ✅ **TRUNCATE CASCADE** (Recomendado)
- **Muito rápido** - Remove dados em bloco
- **Respeita foreign keys automaticamente** - Não precisa desabilitar nada
- **Transacional** - Pode fazer ROLLBACK se necessário
- **Mantém estrutura** - Tabelas, índices, constraints intactos
- **Limpa sequências** - Reseta contadores automáticos

### ❌ **DELETE** (Não recomendado)
- Muito mais lento (remove linha por linha)
- Não reseta sequências
- Pode causar problemas com foreign keys
- Mais propenso a erros

## Como Usar

### 1. ⚠️ Backup (Opcional, mas recomendado)
Mesmo sendo dados de teste, é bom ter um backup:
- Supabase Dashboard > Settings > Database > Backups

### 2. 🧹 Executar Limpeza

**Via SQL Editor no Supabase:**
```sql
-- Execute o arquivo: limpar_dados_teste.sql
```

Ou copie e cole o conteúdo do arquivo diretamente no SQL Editor.

### 3. ✅ Verificar

O script inclui uma query de verificação no final que mostra quantos registros restam em cada tabela. Todas devem retornar **0**.

## O que o Script Faz

1. **Inicia uma transação** (`BEGIN`) - Permite rollback se algo der errado
2. **Trunca tabelas em ordem lógica** - Respeitando dependências
3. **Usa CASCADE** - Remove automaticamente dados dependentes
4. **Commita a transação** (`COMMIT`) - Confirma as mudanças
5. **Verifica resultado** - Query final mostra contagem por tabela

## Ordem de Limpeza

O script limpa na seguinte ordem (do mais dependente para o menos dependente):

1. **Dados transacionais** (embriões, transferências, diagnósticos)
2. **Lotes FIV** (acasalamentos e lotes)
3. **Aspirações** (aspirações e pacotes)
4. **Protocolos** (protocolos e receptoras em protocolos)
5. **Doses de sêmen**
6. **Touros** (se já existir a tabela)
7. **Doadoras**
8. **Receptoras**
9. **Fazendas**
10. **Clientes** (último, pois outras tabelas referenciam)

## Após Limpar os Dados

### 1. Aplicar Migrações (se necessário)
Se você ainda não aplicou a migração de touros:
```sql
-- Execute: criar_tabela_touros.sql
-- Execute: migrar_doses_semen_para_touros_limpo.sql
```

### 2. Testar a Aplicação
- Verificar que não há erros
- Testar cadastros básicos
- Verificar que as estruturas estão funcionando

## Vantagens desta Abordagem

✅ **Rápido** - TRUNCATE é muito mais rápido que DELETE  
✅ **Seguro** - CASCADE cuida de todas as dependências  
✅ **Limpo** - Reseta sequências e contadores  
✅ **Reversível** - Pode fazer ROLLBACK durante a transação  
✅ **Mantém estrutura** - Não precisa recriar tabelas  

## Troubleshooting

### Erro: "cannot truncate a table referenced in a foreign key"

Se isso acontecer, significa que há uma foreign key que o CASCADE não está tratando. Nesse caso:

1. Verifique a ordem das tabelas no script
2. Ou use esta alternativa mais agressiva:

```sql
-- Alternativa: Truncar todas as tabelas de uma vez
TRUNCATE TABLE 
    clientes, fazendas, doadoras, receptoras,
    protocolos_sincronizacao, protocolo_receptoras,
    pacotes_aspiracao, aspiracoes_doadoras,
    lotes_fiv, lotes_fiv_acasalamentos,
    embrioes, doses_semen, touros
CASCADE;
```

### Verificar Foreign Keys

```sql
-- Ver todas as foreign keys do banco
SELECT
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
ORDER BY tc.table_name;
```

## Checklist

- [ ] Backup criado (opcional)
- [ ] Script `limpar_dados_teste.sql` executado
- [ ] Query de verificação mostra 0 registros em todas as tabelas
- [ ] Aplicação ainda funciona (estrutura intacta)
- [ ] Pronto para aplicar migrations ou começar do zero
