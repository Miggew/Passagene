# Plano de Redesign - Interface Embriões/Estoque

## Estrutura da Nova Interface

### 1. Visão Geral
- Listar embriões agrupados por acasalamento (lote_fiv_acasalamento_id)
- Mostrar informações do acasalamento: doadora + touro
- Exibir vídeos associados ao acasalamento
- Permitir ações em lote ou individual

### 2. Estrutura de Dados a Carregar

```
Embriões → Acasalamento → Lote FIV → Pacote Aspiração
         → Doadora (via Aspiração)
         → Touro (via Dose Sêmen)
         → Fazenda Destino
         → Mídia (vídeos/imagens)
         → Histórico
```

### 3. Funcionalidades

#### 3.1 Listagem
- Agrupar por acasalamento
- Mostrar: doadora, touro, quantidade de embriões, status geral
- Cards expansíveis para ver detalhes dos embriões

#### 3.2 Classificação (Individual)
- Campo obrigatório
- Opções: EX (Excelente), BL (Blastocisto), etc (verificar valores reais)
- Gerar identificação automaticamente após classificação

#### 3.3 Destinação (Individual ou em Lote)
- Selecionar fazenda destino
- Pode ser alterado depois

#### 3.4 Upload de Vídeos
- Por acasalamento (não por embrião individual)
- Upload de múltiplos vídeos
- Exibir vídeos associados

#### 3.5 Congelar
- Individual
- Requer: data_congelamento, localizacao_atual

#### 3.6 Descartar
- Individual
- Requer: data_descarte, motivo (observações)

#### 3.7 Histórico
- Mostrar histórico de eventos
- Modal/dialog com timeline

### 4. Interface Visual

```
┌─────────────────────────────────────────────┐
│  Embriões / Estoque                         │
│  [Filtros: Status, Fazenda Destino, Data]  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📦 Acasalamento: ABC123 × PIETRO            │
│    6 embriões • 4 FRESCO • 2 CONGELADO     │
│    [▶️ Vídeo] [Expandir ▼]                  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ID | Classificação | Status | Ações │   │
│  │ 1  | EX           | FRESCO  | [...] │   │
│  │ 2  | BL           | FRESCO  | [...] │   │
│  │ ...                                 │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 5. Ordem de Implementação

1. ✅ Carregar dados (embriões com joins)
2. ⏭️ Agrupar por acasalamento
3. ⏭️ Interface de listagem (cards)
4. ⏭️ Classificação
5. ⏭️ Destinação
6. ⏭️ Congelar
7. ⏭️ Descartar
8. ⏭️ Upload de vídeos
9. ⏭️ Histórico
