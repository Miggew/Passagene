# Investigação: Relação entre EM_TE e TEs Realizadas

## Contexto
O status `EM_TE` parece estar relacionado à realização de Transferências de Embriões (TEs) no protocolo. Quando uma TE é realizada, a receptora é marcada como `UTILIZADA` em `protocolo_receptoras`.

## Hipótese
O status `EM_TE` é definido quando há pelo menos uma receptora com status `UTILIZADA` (TE realizada) no protocolo.

## Queries para Executar

Execute as queries do arquivo `investigar_em_te_relacao_te.sql` no Supabase SQL Editor, uma por uma:

### Query 1: Verificar views que calculam EM_TE
- Busca views que mencionam `EM_TE` na definição
- Pode revelar como o status é calculado

### Query 2: Verificar triggers que atualizam EM_TE
- Busca triggers que atualizam status para `EM_TE` quando receptora vira `UTILIZADA`
- Pode revelar a lógica automática de atualização

### Query 3: Protocolos EM_TE vs Receptoras UTILIZADA
- Verifica se TODOS os protocolos `EM_TE` têm pelo menos uma receptora `UTILIZADA`
- Confirma a hipótese principal

### Query 4: Protocolos PASSO1_FECHADO com passo2_data mas SEM receptoras UTILIZADA
- Identifica protocolos que iniciaram o 2º passo mas ainda não têm TEs realizadas
- Esses protocolos ainda têm status `PASSO1_FECHADO` (correto)

### Query 5: Verificar funções que calculam/atualizam EM_TE
- Busca funções que mencionam `EM_TE` ou `UTILIZADA`
- Pode revelar funções que atualizam o status

### Query 6: Verificar tabela transferencias_embrioes
- Verifica se existe uma tabela específica para registrar TEs
- Pode revelar onde as TEs são registradas

### Query 7: Comparar protocolos EM_TE vs PASSO1_FECHADO
- Compara estatísticas entre protocolos `EM_TE` e `PASSO1_FECHADO` com `passo2_data`
- Mostra a diferença entre os dois grupos

## Resultados Esperados

### Se a hipótese estiver correta:
- Query 3: Todos os protocolos `EM_TE` devem ter `receptoras_utilizadas > 0`
- Query 4: Protocolos `PASSO1_FECHADO` com `passo2_data` mas sem receptoras `UTILIZADA` devem existir
- Query 2 ou 5: Deve haver um trigger ou função que atualiza o status para `EM_TE` quando há receptoras `UTILIZADA`

## Conclusão Provisória

Com base no código encontrado:
- Quando uma TE é realizada, `protocolo_receptoras.status` é atualizado para `UTILIZADA` (TransferenciaEmbrioes.tsx, linha 1246)
- O status `EM_TE` só aparece quando há pelo menos uma receptora `UTILIZADA`
- Portanto, `EM_TE` = Protocolo com pelo menos uma TE realizada

## Próximos Passos

1. Executar as queries para confirmar
2. Se confirmado, atualizar documentação e código para refletir essa lógica
3. Se houver trigger/função, verificar se está funcionando corretamente
4. Se não houver, pode ser que o status seja calculado por uma view ou definido manualmente
