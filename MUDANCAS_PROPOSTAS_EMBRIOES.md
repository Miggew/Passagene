# 🎯 Mudanças Propostas para o Menu Embriões/Estoque

## ✅ O QUE JÁ ESTÁ FUNCIONANDO

- ✅ Criação automática de embriões (quando salva quantidade_embrioes)
- ✅ Estrutura de banco de dados completa
- ✅ Listagem básica de embriões

---

## 📋 MUDANÇAS NECESSÁRIAS (Baseado no que você pediu)

### 1. **Remover Criação Manual** ❌
- **Atual**: Botão "Novo Embrião" que permite criar manualmente
- **Proposto**: Remover esse botão (embriões são criados automaticamente via lotes FIV)

### 2. **Mostrar Informações do Acasalamento** 📊
- **Atual**: Mostra apenas lote (data fecundação)
- **Proposto**: Mostrar também:
  - Doadora (registro)
  - Touro (nome da dose)
  - Informações do acasalamento

### 3. **Classificação de Embriões** 🏷️
- **Atual**: Campo existe mas não é obrigatório/funcional
- **Proposto**: 
  - Tornar classificação obrigatória
  - Permitir editar classificação na lista
  - Gerar identificação automaticamente quando classificar
  - Valores: EX (Excelente), BL (Blastocisto), etc (verificar valores reais)

### 4. **Destinação para Fazenda** 🏠
- **Atual**: Não existe
- **Proposto**: 
  - Campo para selecionar fazenda destino
  - Validar que embrião está classificado antes de destinar
  - Mostrar fazenda destino na listagem

### 5. **Descartar Embriões** 🗑️
- **Atual**: Não existe
- **Proposto**: 
  - Botão "Descartar" para cada embrião
  - Dialog para confirmar e informar motivo
  - Atualizar status para 'DESCARTADO'
  - Registrar no histórico

### 6. **Melhorar Congelar** ❄️
- **Atual**: Já existe, mas pode melhorar
- **Proposto**: 
  - Manter funcionalidade atual
  - Adicionar registro no histórico
  - Melhorar interface

### 7. **Sistema de Vídeos** 🎥
- **Atual**: Estrutura existe no banco, mas não implementado
- **Proposto**: 
  - Upload de vídeos por acasalamento (não por embrião individual)
  - Permitir múltiplos vídeos
  - Formato: MP4, máximo 500MB
  - Exibir vídeos associados

### 8. **Histórico de Embriões** 📜
- **Atual**: Tabela existe, mas não é visualizada
- **Proposto**: 
  - Mostrar histórico de eventos
  - Modal/dialog com timeline
  - Registrar todas as mudanças (classificação, destinação, congelamento, descarte, transferência)

---

## 🎨 PROPOSTA DE INTERFACE

### Listagem Melhorada:
```
┌─────────────────────────────────────────────────────────┐
│ Embriões/Estoque                                        │
│ [Filtros: Status, Fazenda, Classificação]              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ID | Doadora | Touro | Classificação | Status | Ações  │
│ 1  | ABC123  | PIETRO| EX            | FRESCO | [...]  │
│ 2  | ABC123  | PIETRO| BL            | FRESCO | [...]  │
└─────────────────────────────────────────────────────────┘
```

### Ações Disponíveis:
- **Classificar**: Dialog para selecionar classificação
- **Destinar**: Dialog para selecionar fazenda destino
- **Congelar**: Dialog existente (melhorar)
- **Descartar**: Novo dialog
- **Ver Histórico**: Modal com timeline
- **Ver Vídeos**: Mostrar vídeos do acasalamento

---

## 📊 ORDEM DE PRIORIDADE

### Prioridade Alta (Essenciais):
1. ✅ Remover criação manual
2. ✅ Mostrar informações do acasalamento
3. ✅ Implementar classificação
4. ✅ Implementar destinação

### Prioridade Média:
5. Implementar descartar
6. Melhorar congelar (adicionar histórico)
7. Mostrar histórico

### Prioridade Baixa (Futuro):
8. Sistema de vídeos
9. Filtros avançados
10. Relatórios

---

## 🤔 DECISÕES NECESSÁRIAS

1. **Valores de Classificação**: Quais são os valores reais? (EX, BL, A, B, C, D?)
2. **Identificação**: Gerar automaticamente quando classificar ou manual?
3. **Vídeos**: Implementar agora ou deixar para depois?
4. **Filtros**: Quais filtros são mais importantes?

---

## ✅ PRÓXIMOS PASSOS SUGERIDOS

1. **Remover criação manual** (rápido)
2. **Melhorar listagem** (mostrar acasalamento)
3. **Implementar classificação** (essencial)
4. **Implementar destinação** (essencial)

Deseja que eu implemente essas mudanças? Qual a prioridade?
