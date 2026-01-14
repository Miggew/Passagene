# Análise: Sistema de Lotes FIV e Aspirações

## Data: $(date)

## 1. CORREÇÃO SQL PARA D7

### Descoberta Importante
**São 8 dias desde a aspiração (D0) até o D7**, não 7 dias como pode parecer intuitivamente.

### Solução
Para colocar um lote no D7, é necessário subtrair **8 dias** da data atual:
```sql
UPDATE pacotes_aspiracao
SET data_aspiracao = (CURRENT_DATE - INTERVAL '8 days')::DATE
```

### Observação
O cálculo no código TypeScript usa:
```typescript
const diffTime = hoje.getTime() - dataAspiracaoLote.getTime();
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
const diaAtual = Math.max(0, diffDays);
```

Quando a diferença é 8 dias, o sistema mostra D7 corretamente.

### SQL Corrigido
Ver arquivo: `mudar_lote_d0_para_d7.sql`

---

## 2. CAMPOS NÃO UTILIZADOS / OBSOLETOS

### 2.1 Tabela `lotes_fiv`

#### Campos OBSOLETOS (não utilizados no código atual):

1. **`aspiracao_id`** ❌
   - Status: Tornado nullable em `fix_lotes_fiv_constraints.sql`
   - Uso no código: NÃO ENCONTRADO
   - Observação: Foi substituído por `pacote_aspiracao_id` na reestruturação
   - **RECOMENDAÇÃO**: Pode ser removido após confirmar que não há dados

2. **`dose_semen_id`** ❌
   - Status: Tornado nullable em `fix_lotes_fiv_constraints.sql`
   - Uso no código: NÃO ENCONTRADO na tabela `lotes_fiv`
   - Observação: As doses de sêmen agora estão na tabela `lote_fiv_acasalamentos`
   - **RECOMENDAÇÃO**: Pode ser removido após confirmar que não há dados

3. **`data_fecundacao`** ⚠️ PARCIALMENTE USADO
   - Status: Tornado nullable
   - Uso no código: 
     - Usado APENAS em `src/pages/Embrioes.tsx` (interface local, não usa a tabela real)
     - A interface local em `Embrioes.tsx` define `data_fecundacao` mas o tipo `LoteFIV` em `types.ts` NÃO tem esse campo
     - O campo não é usado no código TypeScript principal
   - Observação: Parece ser um campo legado
   - **RECOMENDAÇÃO**: Verificar se há dados antes de remover. Se não houver uso, considerar remover.

4. **`data_abertura_backup`** ❌
   - Status: Criado apenas em `simular_7_dias_lote_fiv.sql` (script de teste)
   - Uso no código: Nenhum
   - **RECOMENDAÇÃO**: Remover se existir (foi criado apenas para testes)

#### Campos ATIVOS (utilizados):

- `id` ✅
- `pacote_aspiracao_id` ✅ (substituiu `aspiracao_id`)
- `data_abertura` ✅
- `status` ✅
- `observacoes` ✅
- `doses_selecionadas` ✅ (array JSON)
- `created_at` ✅
- `updated_at` ✅

### 2.2 Tabela `pacotes_aspiracao`

Todos os campos parecem estar em uso ativo. Nenhum campo obsoleto identificado.

### 2.3 Interface TypeScript `LoteFIV` em `Embrioes.tsx`

**PROBLEMA IDENTIFICADO**: A interface `LoteFIV` em `src/pages/Embrioes.tsx` (linha 41-45) é DIFERENTE da interface em `src/lib/types.ts`:

```typescript
// Embrioes.tsx (LOCAL - INCORRETO)
interface LoteFIV {
  id: string;
  data_fecundacao?: string;  // ❌ Campo que não existe na tabela real
  aspiracao_id: string;       // ❌ Campo obsoleto
}

// types.ts (CORRETO)
export interface LoteFIV {
  id: string;
  pacote_aspiracao_id: string;  // ✅ Correto
  data_abertura: string;         // ✅ Correto
  status: 'ABERTO' | 'FECHADO';
  observacoes?: string;
  // ...
}
```

**RECOMENDAÇÃO**: Corrigir `Embrioes.tsx` para usar a interface correta de `types.ts`.

---

## 3. SCRIPTS SQL DESNECESSÁRIOS / OBSOLETOS

### 3.1 Scripts de Teste/Simulação (podem ser arquivados):

- `simular_7_dias_lote_especifico.sql` - Script de teste específico
- `simular_7_dias_lote_fiv.sql` - Script de teste genérico
- `simular_dias_lote_fiv.sql` - Script de teste
- `mudar_lote_d0_para_d7.sql` - Script específico para um lote (manter se útil)

**RECOMENDAÇÃO**: Manter em pasta `scripts/testes/` ou arquivar se não for mais necessário.

### 3.2 Scripts de Migração (já executados, manter para histórico):

- `fix_lotes_fiv_constraints.sql` - Já executado
- `fix_data_fecundacao_nullable.sql` - Já executado
- `reestruturar_lotes_fiv.sql` - Já executado
- `remover_trigger_data_fecundacao.sql` - Já executado

**RECOMENDAÇÃO**: Manter para histórico, mas documentar como "já executado".

---

## 4. CÓDIGO DESNECESSÁRIO / PROBLEMAS

### 4.1 Interface Duplicada/Incorreta

**Arquivo**: `src/pages/Embrioes.tsx`

**Problema**: Define interface local `LoteFIV` que não corresponde à tabela real.

**Impacto**: 
- Pode causar confusão
- O código pode estar usando campos que não existem
- Dificulta manutenção

**Correção Necessária**: 
```typescript
// REMOVER interface local
// IMPORTAR de types.ts
import { LoteFIV } from '@/lib/types';
```

### 4.2 Código Morto Potencial

Verificar se há código que referencia os campos obsoletos:
- `lotes_fiv.aspiracao_id`
- `lotes_fiv.dose_semen_id`
- `lotes_fiv.data_fecundacao` (exceto em Embrioes.tsx onde está incorreto)

---

## 5. SUGESTÕES DE MELHORIA

### 5.1 Estrutura de Dados

1. **Remover Campos Obsoletos**
   - Criar script para verificar se há dados nos campos obsoletos
   - Se vazios, remover colunas:
     - `lotes_fiv.aspiracao_id`
     - `lotes_fiv.dose_semen_id`
     - `lotes_fiv.data_fecundacao` (após verificar uso em Embrioes.tsx)

2. **Corrigir Interface em Embrioes.tsx**
   - Remover interface local `LoteFIV`
   - Importar de `@/lib/types`
   - Corrigir uso de `data_fecundacao` (usar `data_abertura` do pacote se necessário)

3. **Consistência de Nomes**
   - O campo `data_abertura` no lote representa a data de fecundação (D1)
   - Considerar renomear para `data_fecundacao` para clareza
   - OU documentar melhor que `data_abertura` = data de fecundação

### 5.2 Cálculo de Dias (D0-D7)

1. **Centralizar Lógica de Cálculo**
   - Criar função utilitária para calcular dia atual
   - Atualmente está duplicada em `LotesFIV.tsx`
   - Pode ser útil em outros lugares

2. **Melhorar Documentação**
   - Documentar claramente que D0 = data da aspiração do pacote
   - D1 = data_abertura do lote
   - D7 = data_abertura + 6 dias

3. **Validação**
   - Validar que `data_abertura` = `data_aspiracao` + 1 dia
   - Adicionar constraint ou trigger para garantir consistência

### 5.3 Performance

1. **Índices**
   - Verificar se há índices em `pacote_aspiracao_id` em `lotes_fiv`
   - Verificar se há índices em `data_aspiracao` em `pacotes_aspiracao`
   - Esses campos são usados frequentemente em JOINs

2. **Queries**
   - Revisar queries que fazem múltiplos JOINs
   - Considerar criar views materializadas para relatórios frequentes

### 5.4 Validações e Constraints

1. **Constraints**
   - Adicionar constraint para garantir que `data_abertura >= data_aspiracao` do pacote
   - Validar que `status` só pode ser 'ABERTO' ou 'FECHADO'

2. **Validações de Negócio**
   - Validar que lote só pode ser fechado após D7
   - Validar que quantidade de embriões só pode ser inserida no D7-D8

### 5.5 Testes

1. **Scripts de Teste**
   - Organizar scripts de teste em pasta separada
   - Documentar propósito de cada script
   - Considerar criar suite de testes automatizados

### 5.6 Documentação

1. **Diagrama ER**
   - Criar diagrama mostrando relacionamento entre:
     - `pacotes_aspiracao`
     - `lotes_fiv`
     - `lote_fiv_acasalamentos`
     - `aspiracoes_doadoras`

2. **Documentação de Campos**
   - Documentar propósito de cada campo
   - Documentar cálculos (D0-D7)
   - Documentar regras de negócio

---

## 6. AÇÕES RECOMENDADAS (PRIORIDADE)

### Alta Prioridade
1. ✅ Corrigir SQL para D7 (feito)
2. ⚠️ Corrigir interface em `Embrioes.tsx`
3. ⚠️ Verificar e remover campos obsoletos (após backup)

### Média Prioridade
4. Criar função utilitária para cálculo de dias
5. Adicionar índices se necessário
6. Organizar scripts SQL

### Baixa Prioridade
7. Criar documentação completa
8. Adicionar validações adicionais
9. Criar diagramas ER

---

## 7. SQL PARA VERIFICAÇÃO

```sql
-- Verificar campos obsoletos em lotes_fiv
SELECT 
  COUNT(*) as total_lotes,
  COUNT(aspiracao_id) as com_aspiracao_id,
  COUNT(dose_semen_id) as com_dose_semen_id,
  COUNT(data_fecundacao) as com_data_fecundacao
FROM lotes_fiv;

-- Se todos forem 0, os campos podem ser removidos
```
