# 🔍 Diagnóstico: Validação de Brinco Único por Fazenda

## Problemas Identificados

### 1. **RPC `mover_receptora_fazenda` usa campo obsoleto**
- **Problema**: A RPC ainda usa `fazenda_atual_id` (campo obsoleto) na linha 75
- **Impacto**: A validação de conflito não funciona porque o campo não reflete a realidade
- **Solução**: Atualizar RPC para usar `vw_receptoras_fazenda_atual` (view correta)
- **Arquivo**: `fix_rpc_mover_receptora_fazenda_com_protocolo_grupo_v2.sql`

### 2. **RPC bloqueia mesmo com renomeação do frontend**
- **Problema**: A RPC tem validação de conflito (linhas 66-80) que lança exceção
- **Impacto**: Mesmo quando o frontend renomeia a receptora ANTES de chamar a RPC, ela ainda bloqueia
- **Solução**: Remover a validação da RPC (frontend já trata isso)
- **Arquivo**: `atualizar_rpc_mover_receptora_fazenda.sql` (criado)

### 3. **Funcionalidade de renomeação automática existe mas pode não estar funcionando**
- **Localização**: `src/pages/Receptoras.tsx` linhas 431-645
- **Funcionalidade**: 
  - Detecta conflito de brinco quando seleciona fazenda destino
  - Gera novo brinco com sufixo `-MOV` + data (ex: `BRINCO123-MOV1801`)
  - Renomeia a receptora ANTES de chamar a RPC
  - Registra no histórico de renomeações
- **Status**: Implementado, mas pode estar falhando devido à RPC obsoleta

### 4. **Validação de criação pode não estar sendo executada**
- **Localização**: `src/pages/ProtocoloFormWizard.tsx` linhas 383-436
- **Localização**: `src/pages/Receptoras.tsx` linhas 221-274
- **Status**: Implementado, mas usuário reporta que ainda consegue criar duplicatas
- **Possível causa**: Race condition ou view não retornando dados corretos

## Soluções Aplicadas

### 1. Script SQL criado: `atualizar_rpc_mover_receptora_fazenda.sql`
- ✅ Remove validação de conflito de brinco (frontend já trata)
- ✅ Usa `vw_receptoras_fazenda_atual` ao invés de `fazenda_atual_id`
- ✅ Remove atualização de `fazenda_atual_id` (campo obsoleto)
- ✅ Atualiza status para usar FECHADO/SINCRONIZADO ao invés de PASSO2_FECHADO

### 2. Validação de criação mantida e melhorada
- ✅ Usa view `vw_receptoras_fazenda_atual` (fonte de verdade)
- ✅ Verifica brinco ANTES de criar receptora
- ✅ Verifica nome ANTES de criar receptora
- ✅ Logs adicionados para debug

## Próximos Passos

1. **Executar** `atualizar_rpc_mover_receptora_fazenda.sql` no banco de dados
2. **Testar** criação de receptora com brinco duplicado (deve bloquear)
3. **Testar** movimentação de receptora com brinco duplicado (deve renomear automaticamente)
4. **Verificar logs** no console se ainda houver problemas
