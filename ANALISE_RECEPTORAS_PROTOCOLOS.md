# 📊 Análise Completa: Receptoras e Protocolos

## 🎯 Objetivo
Revisar todo o processo envolvendo receptoras e protocolos, identificar código desnecessário, campos não utilizados no BD e possíveis melhorias.

---

## 📋 1. FLUXO COMPLETO DO PROCESSO

### 1.1. Ciclo de Vida de uma Receptora

```
1. CRIAÇÃO
   └─> Receptora criada (identificação, nome)
   └─> Vinculada a uma fazenda via receptora_fazenda_historico

2. STATUS DINÂMICO
   └─> Calculado por calcularStatusReceptora()
   └─> Prioridade:
       a) v_tentativas_te_status (mais recente)
       b) protocolo_receptoras (protocolos ativos)
       c) VAZIA (padrão)

3. PROTOCOLO DE SINCRONIZAÇÃO
   └─> 1º Passo: Protocolo criado → Receptoras adicionadas
   └─> Status receptoras: INICIADA
   └─> Finalização 1º passo: Status protocolo → PASSO1_FECHADO
   
   └─> 2º Passo: Revisão e classificação
       ├─> Classificação: N ou CL
       ├─> Qualidade: 1, 2 ou 3
       └─> Resultado: APTA ou INAPTA (com motivo)
   
   └─> Finalização 2º passo: Status protocolo → PASSO2_FECHADO

4. TRANSFERÊNCIA DE EMBRIÃO
   └─> Receptora APTA recebe embrião
   └─> Status receptora → SERVIDA

5. DIAGNÓSTICO DE GESTAÇÃO
   └─> Resultado: PRENHE, VAZIA, RETOQUE, etc.
```

### 1.2. Mudança de Fazenda

```
1. MOVER RECEPTORA
   └─> RPC: mover_receptora_fazenda()
   └─> Atualiza receptora_fazenda_historico
   └─> Se receptora está em protocolo ativo:
       ├─> Remove do protocolo original
       ├─> Cria/atualiza protocolo na nova fazenda
       └─> Mantém status da receptora no protocolo
```

---

## 🔍 2. CÓDIGO REDUNDANTE E DESNECESSÁRIO

### 2.1. Campos Não Utilizados no Banco de Dados

#### ❌ `receptoras.fazenda_atual_id`
- **Status**: Campo legado, não deve ser usado
- **Motivo**: Fazenda atual é determinada via `receptora_fazenda_historico` (data_fim IS NULL)
- **Ação**: Campo pode ser removido após verificar que não há dependências
- **Verificação necessária**: 
  ```sql
  SELECT COUNT(*) FROM receptoras WHERE fazenda_atual_id IS NOT NULL;
  ```

#### ⚠️ `protocolo_receptoras.evento_fazenda_id`
- **Status**: Apenas para auditoria, não usado na lógica
- **Uso atual**: Armazenado ao adicionar receptora ao protocolo
- **Recomendação**: Manter para auditoria, mas não usar em lógica de negócio
- **Verificação**: Já está sendo usado corretamente (apenas auditoria)

#### ⚠️ `transferencias_embrioes.evento_fazenda_id`
- **Status**: Apenas para auditoria, não usado na lógica
- **Recomendação**: Manter para auditoria

### 2.2. Código Redundante

#### ✅ Já Otimizado: `calcularStatusReceptoras()`
- **Status**: Já implementado com batch queries
- **Antes**: N×3 queries (uma por receptora)
- **Agora**: 3 queries total (independente do número de receptoras)

#### ⚠️ Possível Redundância: Validação de Status
- **Localização**: `ProtocoloDetail.tsx` e `ProtocoloFormWizard.tsx`
- **Problema**: Ambos chamam `calcularStatusReceptora()` individualmente
- **Recomendação**: Usar `calcularStatusReceptoras()` em batch quando possível

#### ✅ Já Resolvido: Queries N+1
- **Status**: Maioria já otimizada
- **Exemplo**: `ProtocoloDetail.loadReceptoras()` usa batch query

---

## 🗄️ 3. ESTRUTURA DO BANCO DE DADOS

### 3.1. Tabelas Principais

#### `receptoras`
```sql
- id (PK)
- identificacao (único)
- nome (opcional)
- status_reprodutivo (não usado - legado?)
- fazenda_atual_id (LEGADO - não usar)
- created_at
```

**Recomendações**:
- ✅ Remover `fazenda_atual_id` após migração completa
- ⚠️ Verificar uso de `status_reprodutivo` (parece não ser usado)

#### `receptora_fazenda_historico`
```sql
- id (PK)
- receptora_id (FK)
- fazenda_id (FK)
- data_inicio (NOT NULL)
- data_fim (NULL = ativo)
- observacoes
- created_at, updated_at
```

**Status**: ✅ Estrutura correta
**Índices**: ✅ Já otimizado (idx_receptora_fazenda_ativo)

#### `protocolos_sincronizacao`
```sql
- id (PK)
- fazenda_id (FK)
- data_inicio
- data_retirada (opcional)
- responsavel_inicio (formato: "VET: nome | TEC: nome")
- responsavel_retirada (opcional)
- status (ABERTO, PASSO1_FECHADO, PASSO2_FECHADO)
- pacote_producao_id (não usado?)
- observacoes
- passo2_data
- passo2_tecnico_responsavel
- protocolo_origem_id (para rastreamento de protocolos espelho)
- created_at
```

**Recomendações**:
- ⚠️ Verificar uso de `pacote_producao_id` (parece não ser usado)
- ✅ `protocolo_origem_id` útil para rastreamento

#### `protocolo_receptoras`
```sql
- id (PK)
- protocolo_id (FK)
- receptora_id (FK)
- evento_fazenda_id (auditoria - opcional)
- data_inclusao
- data_retirada (opcional)
- status (INICIADA, APTA, INAPTA, UTILIZADA)
- motivo_inapta (opcional)
- observacoes (opcional)
- ciclando_classificacao (N, CL)
- qualidade_semaforo (1, 2, 3)
- created_at
```

**Status**: ✅ Estrutura completa e correta

### 3.2. Views Importantes

#### `vw_receptoras_fazenda_atual`
- **Uso**: Determinar fazenda atual da receptora
- **Status**: ✅ Funcionando corretamente

#### `v_protocolo_receptoras_status`
- **Uso**: Status efetivo das receptoras em protocolos
- **Status**: ✅ Funcionando corretamente

#### `v_tentativas_te_status`
- **Uso**: Status mais recente de tentativas de TE
- **Status**: ✅ Funcionando corretamente

---

## ⚡ 4. MELHORIAS DE PERFORMANCE

### 4.1. ✅ Já Implementadas

1. **Batch Queries para Status**
   - `calcularStatusReceptoras()` usa batch
   - Reduz de N×3 para 3 queries

2. **Batch Queries para Receptoras**
   - `ProtocoloDetail.loadReceptoras()` otimizado
   - Busca todas as receptoras de uma vez

3. **Índices no Banco**
   - `idx_receptora_fazenda_ativo` (único parcial)
   - Índices em `receptora_fazenda_historico`

### 4.2. 🔄 Possíveis Melhorias

#### 1. Cache de Status de Receptoras
- **Problema**: Status é recalculado toda vez
- **Solução**: Cache em memória (React Query ou similar)
- **Prioridade**: Média (só necessário se houver muitos acessos)

#### 2. RPC para Calcular Status em Lote
- **Problema**: Cálculo de status faz múltiplas queries
- **Solução**: Criar RPC no banco que calcula status de múltiplas receptoras
- **Prioridade**: Baixa (já otimizado no frontend)

#### 3. Otimizar Enriquecimento de Observações
- **Problema**: `enriquecerObservacoesMudancaFazenda()` busca histórico de uma receptora
- **Solução**: Se múltiplas receptoras, buscar histórico de todas de uma vez
- **Prioridade**: Baixa (só usado no relatório)

---

## 🧹 5. LIMPEZA RECOMENDADA

### 5.1. Campos para Remover (Após Verificação)

```sql
-- 1. Verificar se fazenda_atual_id ainda é usado
SELECT COUNT(*) FROM receptoras WHERE fazenda_atual_id IS NOT NULL;

-- 2. Se count = 0, remover coluna
ALTER TABLE receptoras DROP COLUMN IF EXISTS fazenda_atual_id;

-- 3. Verificar uso de status_reprodutivo
SELECT COUNT(*) FROM receptoras WHERE status_reprodutivo IS NOT NULL;

-- 4. Se não usado, considerar remover
ALTER TABLE receptoras DROP COLUMN IF EXISTS status_reprodutivo;

-- 5. Verificar uso de pacote_producao_id
SELECT COUNT(*) FROM protocolos_sincronizacao WHERE pacote_producao_id IS NOT NULL;

-- 6. Se não usado, considerar remover
ALTER TABLE protocolos_sincronizacao DROP COLUMN IF EXISTS pacote_producao_id;
```

### 5.2. Código para Limpar

#### Remover Referências a `fazenda_atual_id`
- **Arquivos**: Verificar se há algum uso restante
- **Ação**: Buscar por `fazenda_atual_id` e remover se encontrado

#### Simplificar Validações
- **Arquivo**: `ProtocoloDetail.tsx`
- **Ação**: Verificar se pode usar batch queries em mais lugares

---

## 📝 6. RECOMENDAÇÕES FINAIS

### 6.1. Prioridade Alta

1. ✅ **Verificar e remover `fazenda_atual_id`**
   - Verificar se há dados
   - Se vazio, remover coluna
   - Remover referências no código

2. ✅ **Documentar campos de auditoria**
   - `evento_fazenda_id` em `protocolo_receptoras`
   - `evento_fazenda_id` em `transferencias_embrioes`
   - Deixar claro que são apenas para auditoria

### 6.2. Prioridade Média

3. ⚠️ **Verificar campos não utilizados**
   - `status_reprodutivo` em `receptoras`
   - `pacote_producao_id` em `protocolos_sincronizacao`

4. ⚠️ **Otimizar validações de status**
   - Usar batch queries onde possível
   - Cache quando apropriado

### 6.3. Prioridade Baixa

5. 💡 **Melhorias futuras**
   - RPC para cálculo de status em lote
   - Cache de status de receptoras
   - Otimizar enriquecimento de observações

---

## ✅ 7. CHECKLIST DE VERIFICAÇÃO

### Banco de Dados
- [ ] Verificar se `fazenda_atual_id` tem dados
- [ ] Verificar se `status_reprodutivo` é usado
- [ ] Verificar se `pacote_producao_id` é usado
- [ ] Documentar campos de auditoria

### Código
- [ ] Buscar referências a `fazenda_atual_id`
- [ ] Verificar se há queries N+1 restantes
- [ ] Documentar campos de auditoria no código

### Performance
- [ ] Testar performance com muitas receptoras
- [ ] Verificar se batch queries estão sendo usadas
- [ ] Considerar cache se necessário

---

## 📊 8. RESUMO EXECUTIVO

### ✅ Pontos Positivos
1. Estrutura do BD bem organizada
2. Batch queries já implementadas
3. Views otimizadas
4. Histórico de fazendas funcionando corretamente

### ⚠️ Pontos de Atenção
1. Campos legados (`fazenda_atual_id`) ainda existem
2. Alguns campos podem não estar sendo usados
3. Validações podem ser otimizadas

### 🎯 Ações Recomendadas
1. **Imediato**: Verificar e limpar campos não utilizados
2. **Curto prazo**: Documentar campos de auditoria
3. **Longo prazo**: Considerar cache e otimizações adicionais

---

**Data da Análise**: 2026-01-12
**Versão**: 1.0
