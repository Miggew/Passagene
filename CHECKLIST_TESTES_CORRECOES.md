# ✅ Checklist de Testes Manuais - Correções de Bugs

Este checklist cobre todas as correções implementadas para garantir que os bugs foram resolvidos.

---

## 🔍 Pré-requisitos

- [ ] Aplicação rodando localmente (`pnpm dev`)
- [ ] Acesso ao Supabase Dashboard (SQL Editor)
- [ ] Banco de dados limpo ou com dados de teste conhecidos

---

## 1️⃣ TESTE: Status da Receptora após Aprovação no Passo 2

**Objetivo:** Verificar que receptoras aprovadas (APTA) no Passo 2 não aparecem como elegíveis para novo protocolo.

### Passos:

1. [ ] Criar uma receptora nova ou identificar uma receptora disponível
2. [ ] Criar um novo protocolo e adicionar essa receptora (Passo 1)
3. [ ] Finalizar o Passo 1
4. [ ] Iniciar o Passo 2 (preencher data e técnico)
5. [ ] No Passo 2, marcar a receptora como **"Confirmada (segue para TE)"** (status APTA)
6. [ ] Finalizar o Passo 2
7. [ ] Voltar para lista de protocolos
8. [ ] Criar um NOVO protocolo (mesma fazenda)
9. [ ] Tentar adicionar a mesma receptora no novo protocolo

### Resultado Esperado:

- [ ] ✅ A receptora **NÃO aparece** na lista de receptoras disponíveis
- [ ] ✅ Se aparecer, deve estar **desabilitada** ou com badge "Indisponível"
- [ ] ✅ O status calculado da receptora não deve ser "VAZIA" (deve ser "SINCRONIZADA" ou equivalente)

### Verificação no Banco:

```sql
-- Verificar status da receptora no protocolo
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_protocolo,
    p.status as status_protocolo_geral
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.receptora_id = '<ID_DA_RECEPTORA>'
ORDER BY p.created_at DESC;
```

- [ ] ✅ Receptora com status `APTA` em protocolo `PASSO2_FECHADO`

---

## 2️⃣ TESTE: Receptora Descartada Volta a Ficar Disponível

**Objetivo:** Verificar que receptoras descartadas (INAPTA) em protocolos fechados voltam a aparecer como elegíveis.

### Passos:

1. [ ] Criar um protocolo e adicionar uma receptora (Passo 1)
2. [ ] Finalizar Passo 1
3. [ ] Iniciar Passo 2
4. [ ] Marcar a receptora como **"Descartar"** (status INAPTA)
5. [ ] Finalizar Passo 2
6. [ ] Criar um NOVO protocolo (mesma fazenda)
7. [ ] Tentar adicionar a mesma receptora

### Resultado Esperado:

- [ ] ✅ A receptora **APARECE** na lista de receptoras disponíveis
- [ ] ✅ Pode ser adicionada ao novo protocolo
- [ ] ✅ Status calculado deve ser "VAZIA" ou elegível

### Verificação no Banco:

- [ ] ✅ Receptora com status `INAPTA` em protocolo `PASSO2_FECHADO`
- [ ] ✅ Status calculado deve permitir inclusão em novo protocolo

---

## 3️⃣ TESTE: Finalizar Passo 1 com Receptoras - Validação Atômica

**Objetivo:** Verificar que Finalizar Passo 1 cria protocolo E vínculos corretamente, sem permitir protocolos vazios.

### Passos:

1. [ ] Criar novo protocolo
2. [ ] Adicionar pelo menos 1 receptora
3. [ ] Clicar em **"Finalizar 1º Passo"**
4. [ ] Observar comportamento do botão (deve mostrar "Finalizando...")

### Resultado Esperado:

- [ ] ✅ Botão desabilita durante salvamento
- [ ] ✅ Toast de sucesso aparece: "Protocolo criado com sucesso"
- [ ] ✅ Navega para `/protocolos` após sucesso
- [ ] ✅ **Não é possível clicar múltiplas vezes** (multi-clique bloqueado)

### Verificação no Banco:

```sql
-- Verificar protocolo criado
SELECT 
    p.id,
    p.status,
    p.data_inicio,
    COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.created_at >= NOW() - INTERVAL '5 minutes'
GROUP BY p.id, p.status, p.data_inicio;
```

- [ ] ✅ Protocolo criado com status `PASSO1_FECHADO`
- [ ] ✅ Pelo menos 1 receptora vinculada (`receptoras_count >= 1`)
- [ ] ✅ Não há protocolos "zumbis" sem receptoras

### Teste de Multi-clique:

5. [ ] Tentar clicar rapidamente várias vezes no botão "Finalizar 1º Passo"
6. [ ] Observar console do navegador (F12)

### Resultado Esperado:

- [ ] ✅ Apenas **1 requisição** é enviada ao servidor
- [ ] ✅ Não há múltiplos protocolos criados
- [ ] ✅ Botão permanece desabilitado durante salvamento

---

## 4️⃣ TESTE: Passo 2 Bloqueado se Não Houver Receptoras

**Objetivo:** Verificar que não é possível acessar Passo 2 se o protocolo não tiver receptoras vinculadas.

### Cenário A: Tentar Iniciar Passo 2 sem Receptoras (Prevenção)

**Nota:** Este cenário deve ser testado com protocolo criado diretamente no banco (sem receptoras) ou usando dados corrompidos.

### Passos:

1. [ ] Identificar um protocolo sem receptoras (use auditoria SQL se necessário)
2. [ ] Tentar iniciar o Passo 2 deste protocolo na interface

### Resultado Esperado:

- [ ] ✅ Validação **antes** de iniciar Passo 2 detecta ausência de receptoras
- [ ] ✅ Toast de erro: "Este protocolo não possui receptoras vinculadas"
- [ ] ✅ Passo 2 **NÃO inicia** (modal fecha sem navegar)

### Verificação no Banco:

```sql
-- Identificar protocolos sem receptoras (para teste)
SELECT p.id, p.status, COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO')
GROUP BY p.id, p.status
HAVING COUNT(pr.id) = 0
LIMIT 1;
```

### Cenário B: Passo 2 Acessado Diretamente via URL (Proteção)

### Passos:

1. [ ] Criar protocolo sem receptoras (direto no banco ou usar protocolo existente)
2. [ ] Copiar ID do protocolo
3. [ ] Acessar diretamente: `http://localhost:5173/#/protocolos/<ID>/passo2`

### Resultado Esperado:

- [ ] ✅ Tela do Passo 2 **bloqueia** com mensagem de erro
- [ ] ✅ Card vermelho exibido: "⚠️ Protocolo Inconsistente"
- [ ] ✅ Mensagem: "Este protocolo não possui receptoras vinculadas"
- [ ] ✅ Botão "Voltar para Protocolos" disponível
- [ ] ✅ **Não é possível interagir** com o Passo 2 normalmente

---

## 5️⃣ TESTE: Passo 2 com Receptoras - Funcionamento Normal

**Objetivo:** Verificar que Passo 2 funciona corretamente quando há receptoras vinculadas.

### Passos:

1. [ ] Criar protocolo com pelo menos 2 receptoras
2. [ ] Finalizar Passo 1
3. [ ] Iniciar Passo 2 (preencher data e técnico)
4. [ ] Verificar que tela do Passo 2 carrega

### Resultado Esperado:

- [ ] ✅ Tela carrega normalmente
- [ ] ✅ Lista de receptoras exibida (pelo menos 2 receptoras)
- [ ] ✅ Status inicial: "Aguardando Revisão" (INICIADA)
- [ ] ✅ Pode marcar receptoras como Confirmada ou Descartar

### Teste de Ações no Passo 2:

5. [ ] Marcar primeira receptora como **"Confirmada"**
6. [ ] Marcar segunda receptora como **"Descartar"** (com motivo opcional)
7. [ ] Verificar que status atualiza corretamente
8. [ ] Tentar finalizar Passo 2

### Resultado Esperado:

- [ ] ✅ Status das receptoras atualiza em tempo real
- [ ] ✅ Badges corretos (Confirmada = verde, Descartada = vermelho)
- [ ] ✅ Pode finalizar após todas serem revisadas
- [ ] ✅ Botão "Finalizar 2º Passo" desabilita durante salvamento

---

## 6️⃣ TESTE: Multi-clique em Ações Críticas

**Objetivo:** Verificar que ações críticas não podem ser executadas múltiplas vezes.

### Ações a Testar:

#### A) Finalizar Passo 1

1. [ ] Preencher formulário do protocolo
2. [ ] Adicionar receptoras
3. [ ] Clicar **rapidamente múltiplas vezes** em "Finalizar 1º Passo"
4. [ ] Verificar console (F12) e banco de dados

- [ ] ✅ Apenas 1 protocolo criado
- [ ] ✅ Apenas 1 requisição RPC enviada
- [ ] ✅ Botão desabilita após primeiro clique

#### B) Marcar Status no Passo 2

5. [ ] No Passo 2, clicar **rapidamente múltiplas vezes** em "Confirmar" de uma receptora
6. [ ] Verificar console e banco

- [ ] ✅ Apenas 1 atualização no banco
- [ ] ✅ Status atualizado apenas 1 vez
- [ ] ✅ Botão desabilita durante salvamento

#### C) Finalizar Passo 2

7. [ ] Revisar todas as receptoras
8. [ ] Clicar **rapidamente múltiplas vezes** em "Finalizar 2º Passo"
9. [ ] Verificar console e banco

- [ ] ✅ Apenas 1 atualização de status do protocolo
- [ ] ✅ Protocolo marcado como `PASSO2_FECHADO` apenas 1 vez
- [ ] ✅ Botão desabilita durante salvamento

---

## 7️⃣ TESTE: Iniciar Passo 2 - Validação de Receptoras

**Objetivo:** Verificar que validação ocorre antes de iniciar Passo 2.

### Passos:

1. [ ] Criar protocolo com receptoras e finalizar Passo 1
2. [ ] Ir em "Aguardando 2º Passo"
3. [ ] Clicar em "INICIAR 2º PASSO"
4. [ ] Preencher data e técnico
5. [ ] Clicar em "Confirmar e Iniciar"

### Resultado Esperado (Normal):

- [ ] ✅ Validação silenciosa ocorre (verifica receptoras)
- [ ] ✅ Se houver receptoras: Passo 2 inicia normalmente
- [ ] ✅ Toast de sucesso: "2º passo iniciado"
- [ ] ✅ Navega para tela do Passo 2

### Teste com Protocolo sem Receptoras (Proteção):

6. [ ] Usar protocolo sem receptoras (criado no banco ou corrompido)
7. [ ] Tentar iniciar Passo 2

### Resultado Esperado:

- [ ] ✅ Validação **detecta** ausência de receptoras
- [ ] ✅ Toast de erro: "Este protocolo não possui receptoras vinculadas"
- [ ] ✅ Passo 2 **NÃO inicia**
- [ ] ✅ Modal permanece aberto ou fecha com erro

---

## 8️⃣ TESTE: Auditoria SQL - Protocolos sem Receptoras

**Objetivo:** Verificar que scripts de auditoria funcionam corretamente.

### Passos:

1. [ ] Acessar Supabase Dashboard → SQL Editor
2. [ ] Executar: `auditoria_protocolos_sem_receptoras.sql`
3. [ ] Revisar resultados

### Resultado Esperado:

- [ ] ✅ Query 1: Lista protocolos sem receptoras (se houver)
- [ ] ✅ Query 2: Estatísticas por status
- [ ] ✅ Query 3: Protocolos recentes sem receptoras
- [ ] ✅ Query 4: Protocolos críticos (Passo 2 sem receptoras)
- [ ] ✅ Query 5: Resumo geral

### Verificação:

4. [ ] Identificar se há protocolos problemáticos
5. [ ] Se houver, revisar antes de qualquer limpeza
6. [ ] **NÃO executar** `limpeza_protocolos_sem_receptoras.sql` até revisar auditoria

---

## 📊 Resumo dos Testes

### Critérios de Sucesso:

- [ ] ✅ Receptoras APTA não aparecem como elegíveis após Passo 2
- [ ] ✅ Receptoras INAPTA voltam a aparecer após protocolo fechado
- [ ] ✅ Finalizar Passo 1 sempre cria vínculos corretamente
- [ ] ✅ Passo 2 bloqueia se não houver receptoras
- [ ] ✅ Multi-clique bloqueado em todas as ações críticas
- [ ] ✅ Erros são exibidos corretamente (toast + console)
- [ ] ✅ Não há protocolos "zumbis" criados

### Arquivos Alterados para Verificar:

- [ ] `src/lib/receptoraStatus.ts` - Lógica de elegibilidade
- [ ] `src/pages/ProtocoloPasso2.tsx` - Validação e bloqueio
- [ ] `src/pages/Protocolos.tsx` - Validação ao iniciar Passo 2
- [ ] `src/pages/ProtocoloFormWizard.tsx` - Já tinha proteção (verificar se funciona)

### SQL para Verificação Rápida:

```sql
-- Contar protocolos sem receptoras
SELECT COUNT(*) as protocolos_sem_receptoras
FROM (
    SELECT p.id
    FROM protocolos_sincronizacao p
    LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
    GROUP BY p.id
    HAVING COUNT(pr.id) = 0
) as sem_receptoras;
```

---

## 🐛 Problemas Conhecidos (se houver)

Liste aqui quaisquer problemas encontrados durante os testes:

1. _________________________________________________________
2. _________________________________________________________
3. _________________________________________________________

---

## ✅ Assinatura de Teste

- [ ] Todos os testes acima foram executados
- [ ] Todos os resultados esperados foram confirmados
- [ ] Nenhum bug crítico foi encontrado
- [ ] Correções estão funcionando conforme esperado

**Data do Teste:** _______________

**Testado por:** _______________
