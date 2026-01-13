# REESTRUTURAÇÃO DE LOTES FIV - RESUMO DAS MUDANÇAS

## MUDANÇAS NECESSÁRIAS:

### 1. Tabela lotes_fiv:
- Mudar de `aspiracao_id` para `pacote_aspiracao_id`
- Adicionar `data_abertura` (data do pacote + 1 dia)
- Adicionar `status` (ABERTO/FECHADO)
- Remover `dose_semen_id` (agora será na tabela de relacionamento)
- Manter estrutura para múltiplas fazendas destino

### 2. Nova tabela: lote_fiv_acasalamentos
- `id`
- `lote_fiv_id` (FK para lotes_fiv)
- `aspiracao_doadora_id` (FK para aspiracoes_doadoras)
- `dose_semen_id` (FK para doses_semen)
- `quantidade_fracionada` (DECIMAL, ex: 0.5, 1.0)
- `quantidade_embrioes` (INTEGER, preenchido no dia 7)
- `observacoes` (TEXT)

### 3. Nova tabela: lote_fiv_fazendas_destino (many-to-many)
- `lote_fiv_id` (FK)
- `fazenda_id` (FK)

## FLUXO:
1. Selecionar pacote de aspiração
2. Fazendas destino são pré-selecionadas do pacote
3. Data abertura = data pacote + 1 dia
4. Criar lote (status: ABERTO)
5. Mostrar doadoras do pacote
6. Para cada doadora, adicionar múltiplas doses de sêmen (com fração)
7. Contador de dias até dia 7
8. No dia 7, informar quantidade de embriões por acasalamento
9. Fechar lote
