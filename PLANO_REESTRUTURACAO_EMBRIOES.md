# Plano de Reestruturação: Sistema de Embriões/Estoque

## 📋 OBJETIVO

Reestruturar o sistema de embriões para que:
1. Os embriões sejam criados **automaticamente** a partir dos lotes FIV (quando informam quantidade no D7-D8)
2. No menu "Embriões/Estoque", os embriões possam ser:
   - Classificados
   - Destinados para fazendas (onde serão transferidos)
   - Congelados
   - Descartados
   - Ter histórico completo (fresco e congelado)

---

## 🔍 ANÁLISE DO SISTEMA ATUAL

### Estrutura Atual

1. **Lotes FIV** (`lote_fiv_acasalamentos`)
   - Campo `quantidade_embrioes` é preenchido no D7-D8
   - Os embriões são informados por acasalamento

2. **Tabela `embrioes`** (atual)
   - Criada manualmente
   - Campos: `id`, `lote_fiv_id`, `identificacao`, `classificacao`, `tipo_embriao`, `status_atual`, `data_envase`, `data_congelamento`, `data_saida_laboratorio`, `data_descarte`, `localizacao_atual`

3. **Menu Embriões/Estoque** (atual)
   - Lista embriões criados manualmente
   - Permite congelar
   - Permite transferir

---

## 🎯 MUDANÇAS NECESSÁRIAS

### 1. Criação Automática de Embriões

**Quando**: Após informar `quantidade_embrioes` em um acasalamento (D7-D8)

**Como**: 
- Criar embriões automaticamente baseado na quantidade informada
- Cada embrião deve ter referência ao `lote_fiv_acasalamento_id`
- Status inicial: `FRESCO` ou `PENDENTE_CLASSIFICACAO`

**Considerações**:
- Pode ser feito via trigger no banco OU via código quando salvar quantidade
- Preferência: Via código (mais controle)

### 2. Nova Estrutura de Dados

**Campos adicionais necessários**:
- `lote_fiv_acasalamento_id` - Referência ao acasalamento que gerou o embrião
- `fazenda_destino_id` - Fazenda onde o embrião será transferido
- `status_atual` - Pode incluir: `PENDENTE_CLASSIFICACAO`, `FRESCO`, `CONGELADO`, `DESCARTADO`, `TRANSFERIDO`
- `classificacao` - Já existe, mas precisa ser obrigatório antes de destinar
- `data_classificacao` - Data em que foi classificado
- Histórico de status (tabela separada ou campo JSON)

### 3. Funcionalidades do Menu Embriões/Estoque

#### Listagem
- Mostrar embriões gerados dos lotes FIV
- Filtrar por: Status, Classificação, Fazenda Destino, Lote FIV
- Mostrar informações: Identificação, Lote FIV, Acasalamento, Classificação, Status, Fazenda Destino

#### Classificação
- Campo para classificar o embrião (obrigatório antes de destinar)
- Data de classificação

#### Destinar para Fazenda
- Selecionar fazenda destino
- Salvar fazenda_destino_id
- Validar que embrião está classificado

#### Congelar
- Já existe, mas precisa ser melhorado
- Adicionar data_congelamento
- Adicionar localizacao_atual (botijão)
- Criar registro no histórico

#### Descartar
- Novo: Adicionar funcionalidade de descartar
- Campo data_descarte (já existe)
- Status: DESCARTADO
- Criar registro no histórico

#### Histórico
- Tabela de histórico de embriões: `historico_embrioes`
- Campos: `id`, `embriao_id`, `status_anterior`, `status_novo`, `fazenda_id`, `data_mudanca`, `usuario_id`, `observacoes`
- Ou usar campo JSON na tabela embrioes (mais simples inicialmente)

---

## 📐 ESTRUTURA DE DADOS PROPOSTA

### Tabela `embrioes` (atualizada)

```sql
CREATE TABLE embrioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_fiv_id UUID NOT NULL REFERENCES lotes_fiv(id),
  lote_fiv_acasalamento_id UUID REFERENCES lote_fiv_acasalamentos(id), -- NOVO
  identificacao TEXT,
  classificacao TEXT, -- Obrigatório antes de destinar
  tipo_embriao TEXT,
  status_atual TEXT NOT NULL, -- PENDENTE_CLASSIFICACAO, FRESCO, CONGELADO, DESCARTADO, TRANSFERIDO
  fazenda_destino_id UUID REFERENCES fazendas(id), -- NOVO
  data_classificacao DATE, -- NOVO
  data_envase DATE,
  data_congelamento DATE,
  data_saida_laboratorio DATE,
  data_descarte DATE,
  localizacao_atual TEXT, -- Botijão para congelados
  historico JSONB, -- NOVO: Histórico de mudanças
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela `historico_embrioes` (opcional, mais robusto)

```sql
CREATE TABLE historico_embrioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embriao_id UUID NOT NULL REFERENCES embrioes(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  fazenda_id UUID REFERENCES fazendas(id),
  data_mudanca TIMESTAMP DEFAULT NOW(),
  usuario_id UUID, -- Se tiver sistema de usuários
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 FLUXO PROPOSTO

### 1. Criação de Embriões (Lotes FIV)

```
Lote FIV → D7-D8 → Informar quantidade_embrioes → Criar embriões automaticamente
```

**Exemplo**: Se quantidade_embrioes = 5, criar 5 embriões com status `PENDENTE_CLASSIFICACAO`

### 2. Menu Embriões/Estoque

```
Listar Embriões → Classificar → Destinar para Fazenda → [Congelar OU Transferir OU Descartar]
```

**Status possíveis**:
- `PENDENTE_CLASSIFICACAO` - Acabou de ser criado
- `FRESCO` - Classificado, destinado, pronto para transferir
- `CONGELADO` - Foi congelado
- `TRANSFERIDO` - Foi transferido
- `DESCARTADO` - Foi descartado

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Estrutura de Dados
- [ ] Adicionar campos `lote_fiv_acasalamento_id` e `fazenda_destino_id` na tabela `embrioes`
- [ ] Adicionar campo `data_classificacao`
- [ ] Adicionar campo `historico` (JSONB) ou criar tabela `historico_embrioes`
- [ ] Atualizar tipos TypeScript

### Fase 2: Criação Automática
- [ ] Criar função para gerar embriões a partir de `quantidade_embrioes`
- [ ] Integrar com salvamento de quantidade_embrioes em LotesFIV
- [ ] Testar criação automática

### Fase 3: Menu Embriões/Estoque
- [ ] Redesenhar interface para listar embriões dos lotes FIV
- [ ] Adicionar funcionalidade de classificar
- [ ] Adicionar funcionalidade de destinar para fazenda
- [ ] Melhorar funcionalidade de congelar
- [ ] Adicionar funcionalidade de descartar
- [ ] Adicionar visualização de histórico

### Fase 4: Histórico
- [ ] Implementar registro de histórico
- [ ] Criar visualização de histórico
- [ ] Testar histórico para congelados e frescos

---

## 💡 SUGESTÕES

1. **Identificação automática**: Gerar identificação automática se não fornecida (ex: "E-{lote_id}-{sequencia}")

2. **Validações**:
   - Não permitir destinar sem classificar
   - Não permitir transferir sem destinar
   - Não permitir congelar/descartar se já transferido

3. **Filtros úteis**:
   - Por status
   - Por classificação
   - Por fazenda destino
   - Por lote FIV
   - Por data de criação

4. **Relatórios**:
   - Estoque de embriões frescos
   - Estoque de embriões congelados
   - Embriões descartados
   - Taxa de produção por lote

---

## 📝 PRÓXIMOS PASSOS

1. Confirmar com usuário a estrutura proposta
2. Criar migrations SQL
3. Atualizar tipos TypeScript
4. Implementar criação automática
5. Redesenhar interface Embriões/Estoque
6. Implementar funcionalidades (classificar, destinar, congelar, descartar)
7. Implementar histórico
8. Testes
