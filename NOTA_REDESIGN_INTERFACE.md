# Nota: Redesign da Interface de Embriões

## Status Atual

A interface atual de Embriões (`src/pages/Embrioes.tsx`) tem código legado que precisa ser atualizado:
- Usa interface `LoteFIV` local com campos obsoletos (`data_fecundacao`, `aspiracao_id`)
- Permite criação manual de embriões (agora é automática via lotes FIV)
- Não carrega informações do acasalamento (doadora, touro)

## Próxima Implementação

A interface será redesenhada em etapas:
1. **Versão inicial**: Remover criação manual, simplificar listagem
2. **Versão melhorada**: Carregar dados do acasalamento, mostrar informações
3. **Versão completa**: Classificação, destinação, descartar, histórico

**Nota**: Por enquanto, a criação automática de embriões está funcionando perfeitamente. A interface pode ser melhorada gradualmente.
