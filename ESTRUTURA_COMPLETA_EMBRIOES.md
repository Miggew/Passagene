# Estrutura Completa: Sistema de Embriões com Vídeos/Imagens

## 📋 DECISÕES CONFIRMADAS

1. ✅ **Criação**: Criar N embriões diferentes quando `quantidade_embrioes = N`
2. ✅ **Status Inicial**: `FRESCO` (podem ser congelados depois)
3. ✅ **Histórico**: Tabela separada `historico_embrioes`
4. ✅ **Vídeos/Imagens**: Sistema para anexar vídeos (30s) dos embriões de um mesmo acasalamento
5. ✅ **Classificação**: Obrigatória antes de destinar
6. ⚠️ **Destino**: Precisa definir melhor (veja proposta abaixo)

---

## 🎬 SISTEMA DE VÍDEOS/IMAGENS

### Proposta: Estrutura Elegante e Simples

**Conceito**: Um vídeo mostra múltiplos embriões do mesmo acasalamento (ex: 6 embriões). Cada embrião individual referencia esse vídeo para análise de IA.

### Estrutura Proposta

#### Tabela `acasalamento_embrioes_media`

```sql
CREATE TABLE acasalamento_embrioes_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_fiv_acasalamento_id UUID NOT NULL REFERENCES lote_fiv_acasalamentos(id) ON DELETE CASCADE,
  tipo_media TEXT NOT NULL, -- 'VIDEO', 'IMAGEM'
  arquivo_url TEXT NOT NULL, -- URL do arquivo no Supabase Storage
  arquivo_path TEXT NOT NULL, -- Caminho no storage (ex: 'embrioes/acasalamentos/{acasalamento_id}/{arquivo}')
  duracao_segundos INTEGER, -- Para vídeos
  descricao TEXT,
  data_gravacao TIMESTAMP, -- Data/hora em que foi gravado
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_acasalamento_media FOREIGN KEY (lote_fiv_acasalamento_id) 
    REFERENCES lote_fiv_acasalamentos(id) ON DELETE CASCADE
);

CREATE INDEX idx_acasalamento_media_acasalamento ON acasalamento_embrioes_media(lote_fiv_acasalamento_id);
```

#### Campo na tabela `embrioes`

```sql
-- Adicionar campo para referenciar a mídia
ALTER TABLE embrioes ADD COLUMN acasalamento_media_id UUID 
  REFERENCES acasalamento_embrioes_media(id);
```

### Fluxo de Uso

1. **Criar vídeo/imagem**: No momento de classificar os embriões, fazer upload do vídeo (30s) dos embriões do acasalamento
2. **Associar aos embriões**: Quando criar os embriões automaticamente, associar todos ao mesmo `acasalamento_media_id`
3. **Análise IA**: Cada embrião individual referencia o vídeo completo para análise

### Armazenamento (Supabase Storage)

**Estrutura de pastas sugerida**:
```
embrioes/
  acasalamentos/
    {acasalamento_id}/
      video_principal.mp4 (ou .mov, etc)
      thumbnails/
        frame_1.jpg
        frame_2.jpg
        ...
```

### Benefícios desta Abordagem

✅ **Eficiente**: Um vídeo para múltiplos embriões (evita duplicação)  
✅ **Flexível**: Permite múltiplos vídeos/imagens por acasalamento  
✅ **Escalável**: Cada embrião referencia o vídeo para IA  
✅ **Simples**: Upload único, associação automática  
✅ **Organizado**: Estrutura clara no storage  

---

## 🏢 SISTEMA DE DESTINO vs TRANSFERÊNCIA

### Problema Identificado

- **Destino**: Fazenda planejada para receber o pacote de embriões
- **Transferência Real**: Pode ser diferente do destino (logística, sobras, etc)

### Proposta: Dois Níveis

#### 1. **Destino do Pacote** (Fazenda Planejada)
- Campo: `fazenda_destino_id` na tabela `embrioes`
- Quando: Definido na classificação/destinação
- Propósito: Planejamento e organização logística
- Não bloqueia: Embrião pode ser transferido para outra fazenda

#### 2. **Transferência Real** (Onde Foi Transferido)
- Já existe na tabela `transferencias_embrioes`
- Campo: `fazenda_id` (onde realmente foi transferido)
- Pode ser diferente do `fazenda_destino_id`

### Fluxo Proposto

```
1. Classificar embrião
2. Destinar para fazenda X (fazenda_destino_id = X)
3. Veterinário pega embriões destinados para fazenda X
4. Se sobrar: Pode transferir para fazenda Y (transferencias_embrioes.fazenda_id = Y)
5. Ambos os dados ficam salvos (destino planejado + transferência real)
```

### Vantagens

✅ **Rastreabilidade**: Sabe-se o planejado vs o real  
✅ **Logística**: Organiza embriões por destino planejado  
✅ **Flexibilidade**: Permite mudanças por logística  
✅ **Relatórios**: Pode comparar planejado vs realizado  

### Campos na Tabela `embrioes`

```sql
fazenda_destino_id UUID REFERENCES fazendas(id), -- Fazenda planejada
-- Transferência real fica em transferencias_embrioes.fazenda_id
```

---

## 📐 ESTRUTURA COMPLETA DE DADOS

### Tabela `embrioes` (atualizada)

```sql
CREATE TABLE embrioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_fiv_id UUID NOT NULL REFERENCES lotes_fiv(id),
  lote_fiv_acasalamento_id UUID NOT NULL REFERENCES lote_fiv_acasalamentos(id),
  acasalamento_media_id UUID REFERENCES acasalamento_embrioes_media(id), -- NOVO: Vídeo/imagem
  
  identificacao TEXT, -- Pode ser gerada automaticamente
  classificacao TEXT NOT NULL, -- OBRIGATÓRIO
  tipo_embriao TEXT,
  
  status_atual TEXT NOT NULL DEFAULT 'FRESCO', -- FRESCO, CONGELADO, TRANSFERIDO, DESCARTADO
  
  -- Destino e Classificação
  fazenda_destino_id UUID REFERENCES fazendas(id), -- Fazenda planejada
  data_classificacao DATE NOT NULL, -- OBRIGATÓRIO
  
  -- Datas
  data_envase DATE,
  data_congelamento DATE,
  data_saida_laboratorio DATE,
  data_descarte DATE,
  
  -- Localização
  localizacao_atual TEXT, -- Botijão para congelados
  
  -- Outros
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_embriao_lote FOREIGN KEY (lote_fiv_id) REFERENCES lotes_fiv(id),
  CONSTRAINT fk_embriao_acasalamento FOREIGN KEY (lote_fiv_acasalamento_id) 
    REFERENCES lote_fiv_acasalamentos(id),
  CONSTRAINT check_status CHECK (status_atual IN ('FRESCO', 'CONGELADO', 'TRANSFERIDO', 'DESCARTADO'))
);

CREATE INDEX idx_embrioes_acasalamento ON embrioes(lote_fiv_acasalamento_id);
CREATE INDEX idx_embrioes_fazenda_destino ON embrioes(fazenda_destino_id);
CREATE INDEX idx_embrioes_status ON embrioes(status_atual);
```

### Tabela `acasalamento_embrioes_media` (NOVA)

```sql
CREATE TABLE acasalamento_embrioes_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_fiv_acasalamento_id UUID NOT NULL REFERENCES lote_fiv_acasalamentos(id) ON DELETE CASCADE,
  
  tipo_media TEXT NOT NULL, -- 'VIDEO', 'IMAGEM'
  arquivo_url TEXT NOT NULL, -- URL pública do Supabase Storage
  arquivo_path TEXT NOT NULL, -- Caminho no storage
  arquivo_nome TEXT NOT NULL, -- Nome original do arquivo
  arquivo_tamanho BIGINT, -- Tamanho em bytes
  mime_type TEXT, -- video/mp4, image/jpeg, etc
  
  duracao_segundos INTEGER, -- Para vídeos (ex: 30)
  largura INTEGER, -- Para vídeos/imagens
  altura INTEGER, -- Para vídeos/imagens
  
  descricao TEXT,
  data_gravacao TIMESTAMP, -- Data/hora em que foi gravado
  observacoes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_acasalamento_media FOREIGN KEY (lote_fiv_acasalamento_id) 
    REFERENCES lote_fiv_acasalamentos(id) ON DELETE CASCADE,
  CONSTRAINT check_tipo_media CHECK (tipo_media IN ('VIDEO', 'IMAGEM'))
);

CREATE INDEX idx_acasalamento_media_acasalamento ON acasalamento_embrioes_media(lote_fiv_acasalamento_id);
```

### Tabela `historico_embrioes` (NOVA)

```sql
CREATE TABLE historico_embrioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embriao_id UUID NOT NULL REFERENCES embrioes(id) ON DELETE CASCADE,
  
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  
  -- Dados relacionados à mudança
  fazenda_id UUID REFERENCES fazendas(id), -- Fazenda relacionada (destino, congelamento, etc)
  data_mudanca TIMESTAMP DEFAULT NOW(),
  
  -- Detalhes
  tipo_operacao TEXT, -- 'CLASSIFICACAO', 'DESTINACAO', 'CONGELAMENTO', 'DESCARTE', 'TRANSFERENCIA'
  observacoes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_historico_embriao FOREIGN KEY (embriao_id) REFERENCES embrioes(id) ON DELETE CASCADE
);

CREATE INDEX idx_historico_embriao ON historico_embrioes(embriao_id);
CREATE INDEX idx_historico_data ON historico_embrioes(data_mudanca);
```

---

## 🔄 FLUXO COMPLETO

### 1. Criação Automática (Lotes FIV - D7-D8)

```
Lote FIV → Informar quantidade_embrioes = 5
  ↓
Criar 5 embriões automaticamente:
  - status_atual = 'FRESCO'
  - lote_fiv_acasalamento_id = {id do acasalamento}
  - classificacao = NULL (será preenchido depois)
  - identificacao = gerar automaticamente ou deixar vazio
```

### 2. Classificação e Destinação (Menu Embriões/Estoque)

```
Listar embriões FRESCO
  ↓
Para cada embrião ou grupo de embriões do mesmo acasalamento:
  1. Fazer upload do vídeo (30s) do acasalamento
  2. Classificar cada embrião (obrigatório)
  3. Destinar para fazenda (fazenda_destino_id)
  4. Salvar data_classificacao
  5. Registrar no histórico
```

### 3. Operações (Congelar, Descartar, Transferir)

```
Embrião FRESCO → [Congelar | Descartar | Transferir]
  ↓
Congelar:
  - status_atual = 'CONGELADO'
  - data_congelamento = hoje
  - localizacao_atual = botijão
  - Registrar no histórico

Descartar:
  - status_atual = 'DESCARTADO'
  - data_descarte = hoje
  - Registrar no histórico

Transferir:
  - status_atual = 'TRANSFERIDO'
  - Criar registro em transferencias_embrioes
  - Registrar no histórico
```

---

## 🎨 INTERFACE PROPOSTA (Menu Embriões/Estoque)

### Listagem

**Colunas**:
- Identificação
- Lote FIV
- Acasalamento (Doadora + Sêmen)
- Classificação ⚠️ (obrigatório)
- Status
- Fazenda Destino
- Vídeo/Imagem (ícone se tiver)
- Ações (Classificar, Destinar, Congelar, Descartar, Ver Histórico)

**Filtros**:
- Status (FRESCO, CONGELADO, TRANSFERIDO, DESCARTADO)
- Fazenda Destino
- Lote FIV
- Com/Sem classificação
- Com/Sem vídeo

### Dialog de Classificação/Destinação

**Para grupo de embriões do mesmo acasalamento**:
1. Upload de vídeo (30s) - uma vez para todos
2. Tabela com embriões do acasalamento:
   - Identificação
   - Classificação (input obrigatório)
   - Fazenda Destino (select - opcional na classificação, obrigatório depois)
3. Botão "Salvar Classificação"

### Dialog de Congelamento

- Data de congelamento
- Localização (botijão)
- Observações

### Dialog de Descarte

- Data de descarte
- Motivo (observações)
- Confirmar descarte

### Visualização de Histórico

- Timeline com todas as mudanças
- Status anterior → Status novo
- Data/hora
- Fazenda relacionada
- Observações

---

## 🤖 INTEGRAÇÃO COM IA (Futuro)

### Dados Disponíveis para IA

1. **Vídeo/Imagem**: `acasalamento_embrioes_media.arquivo_url`
2. **Dados do Embrião**: Classificação, tipo, etc
3. **Dados do Processo**: 
   - Doadora (dados completos)
   - Sêmen (dados completos)
   - Lote FIV (processo completo)
   - Transferência (receptora, fazenda, etc)
   - Diagnóstico de gestação (resultado final)

### Estrutura de Dados para IA

```json
{
  "embriao": {
    "id": "...",
    "classificacao": "...",
    "video_url": "...",
    "lote_fiv_acasalamento": {
      "doadora": {...},
      "semen": {...},
      "processo_fiv": {...}
    },
    "transferencia": {
      "receptora": {...},
      "fazenda": {...},
      "data_te": "..."
    },
    "diagnostico_gestacao": {
      "resultado": "...",
      "data": "..."
    }
  }
}
```

---

## ✅ PRÓXIMOS PASSOS

1. ✅ Confirmar estrutura proposta
2. ⏭️ Criar migrations SQL
3. ⏭️ Configurar Supabase Storage (bucket para vídeos)
4. ⏭️ Atualizar tipos TypeScript
5. ⏭️ Implementar criação automática
6. ⏭️ Redesenhar interface Embriões/Estoque
7. ⏭️ Implementar upload de vídeos
8. ⏭️ Implementar classificação/destinação
9. ⏭️ Implementar congelar/descartar
10. ⏭️ Implementar histórico

---

## 💡 PERGUNTAS PARA REFINAR

1. **Identificação**: Gerar automaticamente (ex: "E-{lote_id}-{sequencia}") ou deixar manual?
2. **Vídeo obrigatório**: O vídeo é obrigatório na classificação ou opcional?
3. **Múltiplos vídeos**: Pode ter múltiplos vídeos por acasalamento (ex: vídeo inicial + vídeo depois)?
4. **Formato de vídeo**: Há preferência de formato? (mp4, mov, etc)
5. **Tamanho máximo**: Qual tamanho máximo aceitável para vídeos?
