# Diagnóstico: Receptora "teste duplo" não aparece no menu TE

## Problema Reportado
- Protocolo na fazenda Bucaina está como **SINCRONIZADO**
- Protocolo tem apenas 1 receptora chamada **"teste duplo"**
- No histórico do protocolo **não tem histórico de TE**
- A receptora está como **CONFIRMADA**
- Mas no menu TE a receptora **não aparece** para ser usada

## Análise do Código

O menu TE filtra receptoras através de várias etapas:

### 1. Verificação de Fazenda Atual
- Usa a view `vw_receptoras_fazenda_atual` para verificar se a receptora está na fazenda selecionada
- **Possível problema**: A receptora pode não estar registrada corretamente na fazenda Bucaina

### 2. Verificação de Status na View
- Usa a view `v_protocolo_receptoras_status` com filtro `fase_ciclo = 'SINCRONIZADA'`
- **Possível problema**: A view pode não estar retornando a receptora como SINCRONIZADA mesmo que o protocolo esteja sincronizado

### 3. Filtro de Receptoras INAPTAS
- Mesmo que a view mostre como SINCRONIZADA, receptoras com status INAPTA em `protocolo_receptoras` são filtradas
- **Possível problema**: A receptora pode estar marcada como INAPTA mesmo que apareça como CONFIRMADA

### 4. Filtro de Transferências Já Realizadas
- Receptoras que já receberam embriões na sessão atual são filtradas (dependendo do switch "permitir duplas")
- **Possível problema**: Pode haver uma transferência registrada que não aparece no histórico

## Logs de Debug Adicionados

Adicionei logs de debug no código que vão aparecer no console do navegador quando você:
1. Abrir o menu TE
2. Selecionar a fazenda Bucaina

Os logs vão mostrar:
- ✅ Se a receptora foi encontrada na fazenda
- ✅ Se a receptora aparece na view `v_protocolo_receptoras_status` com fase_ciclo SINCRONIZADA
- ✅ Qual o status da receptora em `protocolo_receptoras`
- ✅ Se a receptora passou por todos os filtros
- ❌ Onde exatamente a receptora está sendo filtrada

## Como Usar os Logs

1. Abra o navegador e vá para o menu TE
2. Abra o Console do Desenvolvedor (F12 → Console)
3. Selecione a fazenda Bucaina
4. Procure por mensagens que começam com:
   - 🔍 DEBUG: (informações de diagnóstico)
   - ✅ DEBUG: (receptora passou no filtro)
   - ❌ DEBUG: (receptora foi filtrada)

## Script SQL de Investigação

Criei o arquivo `investigar_receptora_teste_duplo.sql` com queries para investigar o problema diretamente no banco de dados.

Execute as queries na seguinte ordem:
1. Verificar se a receptora existe e está na fazenda Bucaina
2. Verificar protocolos na fazenda Bucaina
3. Verificar receptoras vinculadas ao protocolo
4. Verificar o que a view retorna
5. Verificar fazenda atual da receptora
6. Verificar histórico de TE
7. Verificar tentativas de TE
8. Verificar diagnóstico de gestação
9. Diagnóstico completo (mostra tudo de uma vez)

## Possíveis Soluções

### Solução 1: Receptora não está na view como SINCRONIZADA
**Causa**: A view `v_protocolo_receptoras_status` pode ter condições que não estão sendo atendidas (ex: falta de `data_te_prevista` ou `data_limite_te`)

**Solução**: Verificar a definição da view e garantir que todas as condições estão sendo atendidas

### Solução 2: Receptora está marcada como INAPTA
**Causa**: O status em `protocolo_receptoras` pode estar como INAPTA mesmo que apareça como CONFIRMADA na interface

**Solução**: Atualizar o status em `protocolo_receptoras` para CONFIRMADA

### Solução 3: Receptora não está na fazenda correta
**Causa**: A view `vw_receptoras_fazenda_atual` pode não estar retornando a receptora como estando na fazenda Bucaina

**Solução**: Verificar o histórico de fazendas da receptora e garantir que está na fazenda correta

### Solução 4: Há transferência registrada que não aparece no histórico
**Causa**: Pode haver uma transferência registrada na tabela `transferencias_embrioes` que não está sendo exibida no histórico

**Solução**: Verificar diretamente na tabela `transferencias_embrioes` se há registros para essa receptora

## Próximos Passos

1. Execute o script SQL `investigar_receptora_teste_duplo.sql` para obter informações detalhadas
2. Use os logs de debug no navegador para identificar onde a receptora está sendo filtrada
3. Com base nos resultados, aplique a solução apropriada
