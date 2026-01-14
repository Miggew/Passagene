# Resumo das Mudanças de Prioridade Média - Sistema de Embriões

## ✅ O QUE PRECISA SER IMPLEMENTADO

### 1. **Descartar Embriões** 🗑️
- Adicionar botão "Descartar" (ícone Trash2) na tabela
- Dialog para confirmar e informar motivo/observações
- Atualizar status para 'DESCARTADO'
- Atualizar data_descarte
- Registrar no histórico (tipo_operacao: 'DESCARTE')

### 2. **Melhorar Congelar** ❄️
- Adicionar registro no histórico quando congelar (tipo_operacao: 'CONGELAMENTO')
- Registrar status_anterior e status_novo
- Incluir observações se necessário

### 3. **Registrar Histórico em Todas as Operações** 📜
- Classificação: tipo_operacao: 'CLASSIFICACAO'
- Destinação: tipo_operacao: 'DESTINACAO'
- Congelamento: tipo_operacao: 'CONGELAMENTO' (já implementado acima)
- Descarte: tipo_operacao: 'DESCARTE' (já implementado acima)

### 4. **Mostrar Histórico** 📜
- Criar modal/dialog com timeline
- Mostrar todos os eventos (classificação, destinação, congelamento, descarte, transferência)
- Usar Sheet component (similar ao ReceptoraHistorico)
- Ordenar por data (mais recente primeiro)

## 📋 ESTRUTURA DO HISTÓRICO

A tabela `historico_embrioes` tem os seguintes campos:
- id
- embriao_id
- status_anterior
- status_novo
- fazenda_id (para destinação)
- data_mudanca
- tipo_operacao: 'CLASSIFICACAO' | 'DESTINACAO' | 'CONGELAMENTO' | 'DESCARTE' | 'TRANSFERENCIA'
- observacoes
- created_at

## 🔧 IMPLEMENTAÇÃO

1. Adicionar imports: Trash2, Textarea, History, Sheet components
2. Adicionar estados: showDescartarDialog, descartarEmbriao, descartarData, showHistoricoDialog, historicoEmbriao
3. Criar função auxiliar `registrarHistorico` para registrar eventos
4. Criar função `handleDescartar` para descartar embrião
5. Atualizar `handleCongelar` para registrar histórico
6. Atualizar `handleClassificar` para registrar histórico
7. Atualizar `handleDestinar` para registrar histórico
8. Criar dialog de descartar
9. Criar modal de histórico (Sheet component)
10. Adicionar botões na tabela (Trash2 para descartar, History para histórico)
