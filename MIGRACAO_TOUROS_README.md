# Migração: Sistema de Touros e Doses de Sêmen

## Visão Geral

Esta migração transforma a estrutura de doses de sêmen de um sistema onde cada dose era independente para um sistema onde:
- **Touros** são cadastrados em um catálogo geral (tabela `touros`)
- **Doses de sêmen** dos clientes referenciam touros do catálogo
- As informações do touro (nome, raça, dados genéticos) são compartilhadas entre todas as doses

## Arquivos da Migração

1. **criar_tabela_touros.sql** - Cria a tabela `touros` com todos os campos genéticos
2. **migrar_doses_semen_para_touros_limpo.sql** - ⭐ **USE ESTE se zerar o BD antes** (estrutura limpa)
3. **migrar_doses_semen_para_touros.sql** - Use apenas se tiver dados existentes para migrar
4. **rollback_migracao_touros.sql** - Script para reverter a migração se necessário
5. **ZERAR_BD_E_MIGRAR.md** - ⭐ **Guia completo para zerar BD e migrar**

## Passo a Passo da Migração

### 1. Fazer Backup
```sql
-- IMPORTANTE: Sempre faça backup antes de migrações!
-- No Supabase: Settings > Database > Backups
```

### 2. Criar Tabela de Touros
Execute o arquivo `criar_tabela_touros.sql`:
```sql
-- Isso cria a tabela touros com todos os campos necessários
-- Índices e triggers são criados automaticamente
```

### 3. Migrar Doses de Sêmen
Execute o arquivo `migrar_doses_semen_para_touros.sql`:
```sql
-- Isso:
-- 1. Adiciona campo touro_id (nullable inicialmente)
-- 2. Cria touros baseados em doses existentes
-- 3. Atualiza doses para referenciar os touros criados
```

### 4. Verificar Migração
```sql
-- Verificar se todas as doses têm touro_id
SELECT 
    COUNT(*) as total_doses,
    COUNT(touro_id) as doses_com_touro,
    COUNT(*) - COUNT(touro_id) as doses_sem_touro
FROM public.doses_semen;

-- Verificar touros criados
SELECT id, registro, nome, raca, created_at 
FROM public.touros 
ORDER BY created_at DESC;

-- Verificar relação doses-touros
SELECT 
    d.id as dose_id,
    t.nome as touro_nome,
    t.registro as touro_registro,
    c.nome as cliente_nome,
    d.quantidade
FROM public.doses_semen d
JOIN public.touros t ON d.touro_id = t.id
LEFT JOIN public.clientes c ON d.cliente_id = c.id
LIMIT 20;
```

### 5. Completar Migração (Opcional)
Após verificar que tudo está funcionando, você pode:

#### a) Remover campos obsoletos
No arquivo `migrar_doses_semen_para_touros.sql`, descomente:
```sql
ALTER TABLE public.doses_semen 
DROP COLUMN IF EXISTS nome,
DROP COLUMN IF EXISTS raca;
```

#### b) Tornar touro_id obrigatório
Descomente:
```sql
ALTER TABLE public.doses_semen 
ALTER COLUMN touro_id SET NOT NULL;
```

## Estrutura Final

### Tabela `touros`
- Campos de identificação (registro, nome, raça)
- Dados genéticos (NM$, TPI, PTAT, etc.)
- Dados de produção
- Pedigree
- Links e mídia

### Tabela `doses_semen`
- `touro_id` (FK para touros) - **NOVO**
- `cliente_id` (FK para clientes)
- `tipo_semen` (CONVENCIONAL/SEXADO)
- `quantidade`
- ~~`nome`~~ - **REMOVIDO** (vem do touro)
- ~~`raca`~~ - **REMOVIDO** (vem do touro)

## Benefícios da Nova Estrutura

1. **Consistência**: Todas as doses do mesmo touro compartilham as mesmas informações
2. **Manutenibilidade**: Atualizar dados de um touro atualiza todas as doses relacionadas
3. **Catálogo Centralizado**: Facilita buscar e comparar touros
4. **Dados Genéticos**: Permite armazenar e exibir informações genéticas completas
5. **Escalabilidade**: Facilita adicionar novos campos genéticos sem duplicar dados

## Rollback

Se precisar reverter a migração, execute `rollback_migracao_touros.sql`.

**ATENÇÃO**: O rollback restaura a estrutura antiga, mas os dados de touros criados automaticamente durante a migração precisarão ser tratados manualmente.

## Checklist Pós-Migração

- [ ] Tabela `touros` criada
- [ ] Campo `touro_id` adicionado em `doses_semen`
- [ ] Todas as doses existentes têm `touro_id` preenchido
- [ ] Aplicação frontend funcionando corretamente
- [ ] Testar criação de nova dose
- [ ] Testar criação de novo touro
- [ ] Testar relacionamento dose-touro
- [ ] Verificar que informações do touro aparecem nas doses

## Notas Importantes

1. **Dados Existentes**: O script de migração cria touros automaticamente baseado nos nomes existentes em `doses_semen`. Revise os touros criados e ajuste se necessário.

2. **Registros**: Os registros dos touros migrados são gerados automaticamente com prefixo "MIGRADO-". Atualize-os manualmente com os registros corretos.

3. **Foreign Keys**: A foreign key de `doses_semen.touro_id` usa `ON DELETE RESTRICT`, impedindo deletar um touro que tenha doses associadas.

4. **RLS (Row Level Security)**: Se você usa RLS no Supabase, precisará atualizar as políticas para incluir a tabela `touros`.

## Suporte

Em caso de problemas:
1. Verifique os logs do banco de dados
2. Execute os scripts de verificação acima
3. Use o script de rollback se necessário
4. Entre em contato com a equipe de desenvolvimento
