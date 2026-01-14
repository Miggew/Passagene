# Resumo: Correções, Eliminações e Sugestões - Sistema Lotes FIV

## 📋 ÍNDICE
1. [Correções Necessárias](#1-correções-necessárias)
2. [Campos Obsoletos no Banco de Dados](#2-campos-obsoletos-no-banco-de-dados)
3. [Código Desnecessário/Problemas](#3-código-desnecessárioproblemas)
4. [Scripts SQL Desnecessários](#4-scripts-sql-desnecessários)
5. [Sugestões de Melhoria](#5-sugestões-de-melhoria)
6. [Ações Recomendadas por Prioridade](#6-ações-recomendadas-por-prioridade)

---

## 1. CORREÇÕES NECESSÁRIAS

### 1.1 ✅ SQL para D7 (JÁ CORRIGIDO)
- **Arquivo**: `mudar_lote_d0_para_d7.sql`
- **Correção**: Usar 8 dias em vez de 7
- **Status**: ✅ Implementado

### 1.2 ⚠️ Interface Incorreta em Embrioes.tsx (CORRIGIR)

**Arquivo**: `src/pages/Embrioes.tsx` (linhas 41-45)

**Problema**: Interface local `LoteFIV` está incorreta e não corresponde à tabela real.

```typescript
// ❌ INCORRETO (atual)
interface LoteFIV {
  id: string;
  data_fecundacao?: string;  // Campo que não existe na tabela
  aspiracao_id: string;       // Campo obsoleto
}
```

**Correção Necessária**:
```typescript
// ✅ CORRETO
import { LoteFIV } from '@/lib/types';
// Remover a interface local
```

**Impacto**: 
- O código pode estar usando campos que não existem no banco
- Pode causar erros em runtime
- Dificulta manutenção

---

## 2. CAMPOS OBSOLETOS NO BANCO DE DADOS

### 2.1 Tabela `lotes_fiv` - Campos para REMOVER

#### Campo 1: `aspiracao_id` ❌
- **Status**: Tornado nullable (não utilizado)
- **Uso no código**: NÃO ENCONTRADO
- **Motivo**: Substituído por `pacote_aspiracao_id` na reestruturação
- **Ação**: Remover após confirmar que não há dados

#### Campo 2: `dose_semen_id` ❌
- **Status**: Tornado nullable (não utilizado)
- **Uso no código**: NÃO ENCONTRADO na tabela `lotes_fiv`
- **Motivo**: As doses de sêmen agora estão na tabela `lote_fiv_acasalamentos`
- **Ação**: Remover após confirmar que não há dados

#### Campo 3: `data_fecundacao` ⚠️
- **Status**: Tornado nullable
- **Uso no código**: 
  - Usado apenas em `Embrioes.tsx` (interface local incorreta)
  - Não existe no tipo `LoteFIV` em `types.ts`
  - Não é usado no código TypeScript principal
- **Motivo**: Campo legado
- **Ação**: Verificar se há dados, depois remover

#### Campo 4: `data_abertura_backup` ❌
- **Status**: Criado apenas em script de teste
- **Uso no código**: NENHUM
- **Arquivo**: `simular_7_dias_lote_fiv.sql`
- **Ação**: Remover se existir (foi criado apenas para testes)

### 2.2 SQL para Verificar Campos Obsoletos

Execute este SQL antes de remover:

```sql
-- Verificar campos obsoletos em lotes_fiv
SELECT 
  COUNT(*) as total_lotes,
  COUNT(aspiracao_id) as com_aspiracao_id,
  COUNT(dose_semen_id) as com_dose_semen_id,
  COUNT(data_fecundacao) as com_data_fecundacao
FROM lotes_fiv;

-- Verificar se data_abertura_backup existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'lotes_fiv'
        AND column_name = 'data_abertura_backup'
    ) THEN 'EXISTE - Pode ser removido'
    ELSE 'NÃO EXISTE - OK'
  END AS status_data_abertura_backup;
```

**Arquivo criado**: `verificar_campos_obsoletos_lotes_fiv.sql`

### 2.3 SQL para Remover Campos (APÓS VERIFICAÇÃO)

```sql
-- IMPORTANTE: Execute a verificação primeiro!
-- Fazer backup antes de executar

-- 1. Remover aspiracao_id
ALTER TABLE lotes_fiv DROP COLUMN IF EXISTS aspiracao_id;

-- 2. Remover dose_semen_id
ALTER TABLE lotes_fiv DROP COLUMN IF EXISTS dose_semen_id;

-- 3. Remover data_fecundacao (se não houver dados)
ALTER TABLE lotes_fiv DROP COLUMN IF EXISTS data_fecundacao;

-- 4. Remover data_abertura_backup (campo de teste)
ALTER TABLE lotes_fiv DROP COLUMN IF EXISTS data_abertura_backup;
```

---

## 3. CÓDIGO DESNECESSÁRIO/PROBLEMAS

### 3.1 Interface Duplicada/Incorreta

**Arquivo**: `src/pages/Embrioes.tsx`

**Problema**: Interface local `LoteFIV` (linhas 41-45) não corresponde à tabela real.

**Correção**:
1. Remover a interface local (linhas 41-45)
2. Adicionar import: `import { LoteFIV } from '@/lib/types';`
3. Verificar e corrigir uso de `data_fecundacao` no código (usar `data_abertura` ou buscar do pacote)

**Arquivos para verificar**:
- `src/pages/Embrioes.tsx` (linhas 41-45, 83-85, 104, 274-275, 281-286, 405-406)

### 3.2 Código Morto Potencial

Verificar referências aos campos obsoletos:
- `lotes_fiv.aspiracao_id` (não deve existir)
- `lotes_fiv.dose_semen_id` (não deve existir)
- `lotes_fiv.data_fecundacao` (apenas em Embrioes.tsx, onde está incorreto)

---

## 4. SCRIPTS SQL DESNECESSÁRIOS

### 4.1 Scripts de Teste/Simulação (Pode Arquivar)

Estes scripts podem ser movidos para uma pasta `scripts/testes/` ou removidos:

- `simular_7_dias_lote_especifico.sql` - Script de teste específico
- `simular_7_dias_lote_fiv.sql` - Script de teste genérico
- `simular_dias_lote_fiv.sql` - Script de teste
- `teste_ambos_valores_d7.sql` - Script de diagnóstico (pode manter para referência)

### 4.2 Scripts de Migração (Manter para Histórico)

Estes scripts já foram executados, mas devem ser mantidos para histórico:

- `fix_lotes_fiv_constraints.sql` - Já executado
- `fix_data_fecundacao_nullable.sql` - Já executado
- `reestruturar_lotes_fiv.sql` - Já executado
- `remover_trigger_data_fecundacao.sql` - Já executado

**Recomendação**: Documentar como "já executado" ou mover para pasta `scripts/historico/`

---

## 5. SUGESTÕES DE MELHORIA

### 5.1 Estrutura de Dados

1. **Remover Campos Obsoletos**
   - Executar script de verificação
   - Se vazios, remover colunas (fazer backup antes)

2. **Corrigir Interface em Embrioes.tsx**
   - Remover interface local
   - Importar de `@/lib/types`
   - Corrigir uso de campos

3. **Consistência de Nomes**
   - O campo `data_abertura` no lote representa a data de fecundação (D1)
   - Considerar documentar melhor ou renomear para clareza

### 5.2 Cálculo de Dias (D0-D7)

1. **Centralizar Lógica de Cálculo**
   - Criar função utilitária em `src/lib/utils.ts`
   - Atualmente está duplicada em `LotesFIV.tsx`
   - Função sugerida:
   ```typescript
   export function calcularDiaAtual(dataAspiracao: string | Date): number {
     const hoje = new Date();
     hoje.setHours(0, 0, 0, 0);
     const dataAsp = typeof dataAspiracao === 'string' 
       ? new Date(dataAspiracao.split('T')[0] + 'T00:00:00')
       : dataAspiracao;
     dataAsp.setHours(0, 0, 0, 0);
     const diffTime = hoje.getTime() - dataAsp.getTime();
     const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
     return Math.max(0, diffDays);
   }
   ```

2. **Documentar Claramente**
   - D0 = data da aspiração do pacote
   - D1 = data_abertura do lote (aspiração + 1 dia)
   - **D7 = aspiração + 8 dias** (descoberta importante!)

3. **Validação**
   - Validar que `data_abertura` = `data_aspiracao` + 1 dia
   - Adicionar constraint se necessário

### 5.3 Performance

1. **Índices**
   - Verificar índices em `pacote_aspiracao_id` em `lotes_fiv`
   - Verificar índices em `data_aspiracao` em `pacotes_aspiracao`
   - Esses campos são usados frequentemente em JOINs

2. **Queries**
   - Revisar queries com múltiplos JOINs
   - Considerar views materializadas para relatórios

### 5.4 Validações e Constraints

1. **Constraints**
   - Garantir que `data_abertura >= data_aspiracao` do pacote
   - Validar que `status` só pode ser 'ABERTO' ou 'FECHADO'

2. **Validações de Negócio**
   - Lote só pode ser fechado após D7
   - Quantidade de embriões só pode ser inserida no D7-D8

### 5.5 Organização

1. **Scripts SQL**
   - Criar estrutura: `scripts/testes/`, `scripts/historico/`, `scripts/migrations/`
   - Documentar propósito de cada script

2. **Documentação**
   - Criar diagrama ER
   - Documentar regras de negócio
   - Documentar cálculos (D0-D7)

---

## 6. AÇÕES RECOMENDADAS POR PRIORIDADE

### 🔴 ALTA PRIORIDADE

1. ✅ **Corrigir SQL para D7** - FEITO
   - Arquivo: `mudar_lote_d0_para_d7.sql`
   - Status: ✅ Implementado (8 dias)

2. ⚠️ **Corrigir interface em Embrioes.tsx**
   - Arquivo: `src/pages/Embrioes.tsx`
   - Ação: Remover interface local, importar de `@/lib/types`
   - Impacto: Alto (pode causar erros)

3. ⚠️ **Verificar campos obsoletos no BD**
   - Executar: `verificar_campos_obsoletos_lotes_fiv.sql`
   - Se vazios, remover campos
   - Impacto: Médio (limpeza)

### 🟡 MÉDIA PRIORIDADE

4. **Criar função utilitária para cálculo de dias**
   - Centralizar lógica em `src/lib/utils.ts`
   - Reduzir duplicação de código

5. **Adicionar índices se necessário**
   - Verificar performance de queries
   - Adicionar índices em campos usados em JOINs

6. **Organizar scripts SQL**
   - Criar estrutura de pastas
   - Documentar scripts

### 🟢 BAIXA PRIORIDADE

7. **Criar documentação completa**
   - Diagrama ER
   - Regras de negócio
   - Documentação de campos

8. **Adicionar validações adicionais**
   - Constraints
   - Validações de negócio

9. **Criar diagramas**
   - Diagrama ER
   - Fluxogramas

---

## 7. ARQUIVOS CRIADOS PARA AJUDAR

1. ✅ `mudar_lote_d0_para_d7.sql` - SQL corrigido (8 dias)
2. ✅ `verificar_campos_obsoletos_lotes_fiv.sql` - Verificar campos antes de remover
3. ✅ `diagnostico_dia_lote_fiv.sql` - Diagnóstico de cálculo de dias
4. ✅ `teste_ambos_valores_d7.sql` - Teste comparativo
5. ✅ `ANALISE_LOTES_FIV_ASPIRACOES.md` - Análise completa
6. ✅ `RESUMO_CORRECOES_LOTES_FIV.md` - Este documento

---

## 8. PRÓXIMOS PASSOS SUGERIDOS

1. **Revisar este documento**
2. **Executar verificação de campos obsoletos**
3. **Corrigir interface em Embrioes.tsx**
4. **Fazer backup do banco de dados**
5. **Remover campos obsoletos (se vazios)**
6. **Organizar scripts SQL**
7. **Implementar melhorias de média/baixa prioridade conforme necessário**

---

**Data de criação**: 2024
**Última atualização**: Após confirmação do cálculo D7 (8 dias)
