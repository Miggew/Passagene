# 📊 Análise Completa dos Status de Protocolos de Sincronização

## 🔍 Status Identificados no Código

### Status Tratados Explicitamente no Código:

1. **`ABERTO`**
   - **Onde aparece:** `FazendaDetail.tsx`, `ProtocoloDetail.tsx`
   - **Significado:** Protocolo no 1º passo (sincronização) ainda em andamento
   - **Uso no código:** Filtro por protocolos abertos em `FazendaDetail.tsx` linha 99
   - **Transição:** Criado com este status ou `PASSO1_ABERTO` → pode ser finalizado para `PASSO1_FECHADO`

2. **`PASSO1_ABERTO`**
   - **Onde aparece:** `ProtocoloDetail.tsx` linha 1040
   - **Significado:** Variante de `ABERTO`, protocolo no 1º passo em andamento
   - **Transição:** Pode ser finalizado para `PASSO1_FECHADO`

3. **`PASSO1_FECHADO`**
   - **Onde aparece:** `Protocolos.tsx`, `ProtocoloDetail.tsx`, `ProtocoloPasso2.tsx`, múltiplos arquivos SQL
   - **Significado:** 1º passo (sincronização) concluído, aguardando início do 2º passo
   - **Uso no código:** 
     - Filtro "Aguardando 2º Passo" busca por este status
     - Permite iniciar o 2º passo
   - **Transição:** Quando o 2º passo é iniciado, permanece neste status durante o 2º passo → ao finalizar 2º passo muda para `PASSO2_FECHADO`

4. **`PRIMEIRO_PASSO_FECHADO`**
   - **Onde aparece:** `Protocolos.tsx` linha 201, `ProtocoloPasso2.tsx` linha 140
   - **Significado:** Variante legada de `PASSO1_FECHADO`
   - **Uso no código:** Tratado como sinônimo de `PASSO1_FECHADO` em vários lugares
   - **Observação:** Status legado, provavelmente de versões antigas do sistema

5. **`PASSO2_FECHADO`**
   - **Onde aparece:** Em praticamente todos os arquivos relacionados a protocolos
   - **Significado:** Protocolo completamente finalizado - tanto 1º quanto 2º passo concluídos
   - **Uso no código:**
     - Identifica protocolos fechados permanentemente
     - Filtro "Fechados" busca por este status
     - Bloqueia edições no protocolo
     - Permite visualizar relatório final
   - **Transição:** Estado final - não há transição após este status

### Status Observados na Interface (mas não no código):

6. **`EM_TE`** ⚠️
   - **Onde aparece:** Na interface do usuário (coluna Status do histórico)
   - **Onde NÃO aparece no código:** Não encontrado em nenhum lugar do código TypeScript/React
   - **Hipótese:** Pode ser definido por:
     - Trigger ou função no banco de dados (não encontrado nos SQLs analisados)
     - View do banco que calcula status dinamicamente
     - Atualização manual direta no banco
     - Status legado de versões anteriores
   - **Possível Significado:** Protocolo onde receptoras já receberam Transferência de Embriões (TE), mas o protocolo ainda não foi fechado
   - **Possível Lógica:** 
     - Protocolo está em `PASSO1_FECHADO` ou similar
     - Já tem `passo2_data` preenchido (2º passo iniciado)
     - Receptoras do protocolo têm `status = 'UTILIZADA'` em `protocolo_receptoras`
     - Mas protocolo ainda não foi finalizado para `PASSO2_FECHADO`

---

## 📋 Status de Receptoras no Protocolo (`protocolo_receptoras.status`)

Estes são diferentes do status do protocolo em si:

1. **`INICIADA`**
   - Receptora iniciou o protocolo (foi adicionada)
   - Está em sincronização
   - Aparece no Passo 2 como pendente

2. **`APTA`**
   - Receptora aprovada no 2º passo
   - Segue para Transferência de Embriões (TE)
   - Confirmada pelo técnico no Passo 2

3. **`INAPTA`**
   - Receptora descartada no 2º passo
   - Não foi aprovada para TE
   - Tem motivo_inapta preenchido

4. **`UTILIZADA`**
   - Receptora já recebeu Transferência de Embriões (TE)
   - Status atualizado quando a sessão de TE é encerrada
   - Aparece em `TransferenciaEmbrioes.tsx` linha 1246

---

## 🔄 Fluxo de Status do Protocolo

```
[CRIAÇÃO]
    ↓
ABERTO ou PASSO1_ABERTO
    ↓
[Finalizar 1º Passo]
    ↓
PASSO1_FECHADO ou PRIMEIRO_PASSO_FECHADO
    ↓
[Iniciar 2º Passo] (preenche passo2_data e passo2_tecnico_responsavel)
    ↓
[Durante 2º Passo] (receptoras são avaliadas: APTA/INAPTA)
    ↓
[Após TE ser realizada] (receptoras.status = 'UTILIZADA')
    ↓
??? [Possível status intermediário EM_TE?] ???
    ↓
[Finalizar 2º Passo]
    ↓
PASSO2_FECHADO (estado final)
```

---

## ❓ Análise do Status `EM_TE`

### Evidências:

1. **Aparece na interface:** O usuário confirmou que vê "EM_TE" na coluna Status
2. **Não está no código TypeScript:** Nenhuma referência encontrada
3. **Não está nos SQLs analisados:** Não encontrado em migrations ou triggers

### Possíveis Origens:

1. **View do Banco de Dados:**
   - Pode existir uma view `v_protocolo_status` ou similar que calcula status dinamicamente
   - View pode ter lógica como:
     ```sql
     CASE 
       WHEN status = 'PASSO1_FECHADO' AND passo2_data IS NOT NULL 
            AND EXISTS (SELECT 1 FROM protocolo_receptoras WHERE protocolo_id = p.id AND status = 'UTILIZADA')
       THEN 'EM_TE'
       ELSE status
     END
     ```

2. **Trigger no Banco:**
   - Trigger pode atualizar status automaticamente quando:
     - Receptoras são marcadas como UTILIZADA
     - Ou quando passo2_data é preenchido

3. **Status Legado:**
   - Pode ter sido usado em versões anteriores
   - Mantido no banco mas removido do código novo

4. **Atualização Manual:**
   - Pode ter sido inserido manualmente no banco de dados

### O que Investigar:

1. Verificar views do banco: `v_protocolo_status`, `v_protocolo_receptoras_status`
2. Verificar triggers na tabela `protocolos_sincronizacao`
3. Verificar se há função RPC que atualiza status
4. Consultar histórico de migrations mais antigas
5. Verificar se há código que atualiza status diretamente no Supabase Dashboard

---

## 📊 Resumo dos Status para Filtros

### Filtro "Todos os protocolos"
- Retorna todos, sem filtro de status

### Filtro "Aguardando 2º Passo"
- Status: `PASSO1_FECHADO` ou `PRIMEIRO_PASSO_FECHADO`
- Não tem `passo2_data` preenchido OU
- Tem `passo2_data` mas ainda tem receptoras com `status IN ('INICIADA', 'APTA')` no protocolo

### Filtro "Fechados"
- Status: `PASSO2_FECHADO`
- Protocolo completamente finalizado

### Filtro "Em Andamento"
- Status: `ABERTO` ou `PASSO1_ABERTO`
- Protocolo no 1º passo ainda em andamento

### ⚠️ Filtro faltando: "EM_TE"
- Se este status realmente existe e tem significado, deveria ter um filtro específico
- Ou ser incluído em algum filtro existente (ex: "Em TE" ou "Pós-TE")

---

## 🔧 Recomendações

1. **Investigar origem de `EM_TE`:**
   - ✅ Script SQL criado: `investigar_status_protocolos.sql`
   - Execute as queries para verificar views, triggers e funções
   - Analise os resultados para descobrir a origem

2. **Documentar status oficialmente:**
   - Após investigação, definir se `EM_TE` é um status válido
   - Se sim, incluí-lo nos filtros e tratamento do código
   - Se não, criar migration para converter ou limpar

3. **Padronizar status:**
   - Decidir entre `PASSO1_FECHADO` e `PRIMEIRO_PASSO_FECHADO`
   - Decidir entre `ABERTO` e `PASSO1_ABERTO`
   - Criar migration para unificar variantes legadas

4. **Melhorar transições:**
   - Documentar quando cada status deve ser usado
   - Criar validações para transições inválidas
   - Adicionar logs de mudanças de status

---

## 📝 Como Usar o Script de Investigação

### Arquivo: `investigar_status_protocolos.sql`

1. **Acesse o Supabase Dashboard:**
   - Vá para SQL Editor
   - Cole e execute o script completo ou execute as partes individualmente

2. **Execute as partes na ordem:**
   - **PARTE 1**: Views relacionadas a protocolos
   - **PARTE 2**: Triggers na tabela protocolos_sincronizacao
   - **PARTE 3**: Valores reais de status no banco
   - **PARTE 4**: Relação entre status e estado do protocolo
   - **PARTE 5**: Constraints e CHECK constraints
   - **PARTE 6**: Atualizações automáticas de status
   - **PARTE 7**: Status de protocolo_receptoras
   - **PARTE 8**: Análise de status redundantes
   - **PARTE 9**: Query unificada de resumo

3. **Analise os resultados:**
   - Compare os status encontrados no banco com os do código
   - Identifique redundâncias
   - Descubra a origem do `EM_TE`
   - Documente status não reconhecidos

4. **Próximos passos após investigação:**
   - Criar migration para padronizar status
   - Atualizar código para tratar todos os status válidos
   - Remover ou converter status legados/obsoletos

---

## 📝 Status Observados vs Tratados

| Status | Aparece no Código | Aparece na Interface | Significado Confirmado |
|--------|------------------|---------------------|----------------------|
| `ABERTO` | ✅ | ✅ | ✅ |
| `PASSO1_ABERTO` | ✅ | ❓ | ✅ |
| `PASSO1_FECHADO` | ✅ | ✅ | ✅ |
| `PRIMEIRO_PASSO_FECHADO` | ✅ | ❓ | ✅ (legado) |
| `PASSO2_FECHADO` | ✅ | ✅ | ✅ |
| `EM_TE` | ❌ | ✅ | ❓ (não confirmado) |
