# 🧪 Guia de Testes - Correções de Bugs

## Data: 2026-01-08

---

## ✅ Pré-requisitos

1. **SQL já executado:**
   - ✅ RPC `criar_protocolo_passo1_atomico` criada
   - ✅ Índice criado
   - ✅ Protocolo zumbi deletado

2. **Aplicação rodando:**
   ```bash
   pnpm dev
   ```

3. **Acesse:** `http://localhost:5173/#/protocolos`

---

## 🎯 Teste 1: Multi-clique no Finalizar Passo 1 (CRÍTICO)

**Objetivo:** Verificar que múltiplos cliques não criam protocolos duplicados

### Passos:
1. Clique em **"Novo Protocolo (1º Passo)"**
2. Preencha o formulário:
   - Selecione uma fazenda
   - Data de início
   - Veterinário
   - Técnico
3. Clique em **"Continuar para Receptoras"**
4. Adicione pelo menos 1 receptora
5. **AÇÃO CRÍTICA:** Clique rapidamente várias vezes (5-10x) em **"Finalizar 1º Passo"**

### ✅ Resultado Esperado:
- [ ] Botão fica desabilitado após o primeiro clique
- [ ] Texto muda para "Finalizando..."
- [ ] Apenas **1 protocolo** é criado no banco
- [ ] Navega automaticamente para `/protocolos` após sucesso
- [ ] Toast de sucesso aparece

### Verificação no Banco (Supabase):
```sql
-- Verificar se há protocolos duplicados criados hoje
SELECT id, fazenda_id, data_inicio, created_at, status
FROM protocolos_sincronizacao
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```
**Esperado:** Apenas 1 protocolo criado neste teste

---

## 🎯 Teste 2: Validação de Receptoras

**Objetivo:** Verificar que não é possível finalizar sem receptoras ou com IDs inválidos

### 2.1 - Finalizar sem Receptoras
1. Crie novo protocolo (formulário completo)
2. **NÃO adicione nenhuma receptora**
3. Tente clicar em **"Finalizar 1º Passo"**

### ✅ Resultado Esperado:
- [ ] Toast de erro aparece: "Adicione pelo menos 1 receptora antes de finalizar"
- [ ] Botão permanece habilitado (mas não finaliza)

### 2.2 - Finalizar com Receptoras Válidas
1. Adicione pelo menos 2 receptoras
2. Clique em **"Finalizar 1º Passo"**

### ✅ Resultado Esperado:
- [ ] Protocolo criado com sucesso
- [ ] Todas as receptoras vinculadas
- [ ] Verificar no banco:
```sql
-- Verificar receptoras vinculadas ao protocolo
SELECT pr.*, r.identificacao, r.nome
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '<ID_DO_PROTOCOLO_CRIADO>';
```
**Esperado:** Mesmo número de receptoras que você adicionou

---

## 🎯 Teste 3: Receptora Reciclada (Descartada Anteriormente)

**Objetivo:** Verificar que receptoras descartadas podem ser reutilizadas

### Passos:
1. **Criar Protocolo A:**
   - Criar protocolo via wizard
   - Adicionar uma receptora (ex: "Brinco 123")
   - Finalizar Passo 1
   
2. **Iniciar Passo 2 do Protocolo A:**
   - Ir em "Aguardando 2º Passo"
   - Clicar "INICIAR 2º PASSO"
   - Preencher data e técnico
   
3. **Descartar a Receptora:**
   - Na tela do Passo 2
   - Selecionar a receptora "Brinco 123"
   - Clicar em "Descartar"
   - Selecionar motivo (ou "Sem motivo")
   - Confirmar
   
4. **Finalizar Passo 2:**
   - Finalizar o protocolo A

5. **Criar Novo Protocolo B:**
   - Criar novo protocolo via wizard
   - Tentar adicionar a mesma receptora "Brinco 123"

### ✅ Resultado Esperado:
- [ ] Receptora "Brinco 123" aparece na lista de disponíveis
- [ ] Pode adicionar normalmente
- [ ] Pode finalizar Passo 1 sem erro
- [ ] Protocolo B criado com sucesso

---

## 🎯 Teste 4: Histórico - Não Busca Automaticamente

**Objetivo:** Verificar que histórico abre rápido e não busca automaticamente

### Passos:
1. Ir em **Protocolos**
2. Clicar na aba **"Histórico"**

### ✅ Resultado Esperado:
- [ ] Aba abre **instantaneamente** (sem spinner)
- [ ] Mensagem aparece: "Preencha os filtros obrigatórios e clique em 'Buscar Protocolos'"
- [ ] Lista vazia inicialmente
- [ ] Botão "Buscar Protocolos" desabilitado

---

## 🎯 Teste 5: Atalhos de Data no Histórico

**Objetivo:** Verificar que os atalhos preenchem datas automaticamente

### Passos:
1. Ir em **Protocolos > Histórico**
2. Selecionar uma **Fazenda** (obrigatório)
3. Clicar em **"Últimos 7 dias"**

### ✅ Resultado Esperado:
- [ ] Data inicial preenchida automaticamente (7 dias atrás)
- [ ] Data final preenchida automaticamente (hoje)
- [ ] Botão "Buscar Protocolos" habilitado

### Repetir para:
- [ ] **"Últimos 30 dias"** - preenche corretamente
- [ ] **"Últimos 90 dias"** - preenche corretamente

---

## 🎯 Teste 6: Busca e Paginação no Histórico

**Objetivo:** Verificar que busca funciona e paginação funciona corretamente

### Passos:
1. Ir em **Protocolos > Histórico**
2. Selecionar **Fazenda**
3. Usar atalho **"Últimos 90 dias"** (para ter mais resultados)
4. Clicar em **"Buscar Protocolos"**

### ✅ Resultado Esperado:
- [ ] Lista aparece com protocolos do período
- [ ] **Protocolos sem receptoras (zumbis) NÃO aparecem**
- [ ] Performance rápida (< 2 segundos)
- [ ] Contador mostra: "Página 1 - Mostrando X protocolos"

### Se houver mais de 50 protocolos:
5. Clicar em **"Próxima"**

### ✅ Resultado Esperado:
- [ ] Lista atualiza para próxima página
- [ ] Contador atualiza: "Página 2 - Mostrando X protocolos"
- [ ] Botão "Anterior" habilitado

6. Clicar em **"Anterior"**

### ✅ Resultado Esperado:
- [ ] Volta para página 1
- [ ] Contador atualiza corretamente

---

## 🎯 Teste 7: Operação Atômica (RPC)

**Objetivo:** Verificar que a operação é tudo ou nada

### Passos:
1. Criar novo protocolo
2. Adicionar várias receptoras (3+)
3. **Durante o processo de finalização**, desconectar internet ou simular erro
   - (Difícil simular, mas pode testar com dados inválidos)

### Alternativa - Teste Manual:
1. Verificar no banco que não há protocolos órfãos:
```sql
-- Verificar protocolos sem receptoras
SELECT p.id, p.data_inicio, p.status, COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.created_at >= CURRENT_DATE
GROUP BY p.id, p.data_inicio, p.status
HAVING COUNT(pr.id) = 0;
```

### ✅ Resultado Esperado:
- [ ] **Nenhum protocolo órfão** (todos têm pelo menos 1 receptora)
- [ ] Protocolos criados hoje têm receptoras vinculadas

---

## 🎯 Teste 8: Passo 2 NÃO é Criado Automaticamente

**Objetivo:** Verificar que Passo 2 só é criado quando usuário clica em "INICIAR 2º PASSO"

### Passos:
1. Criar e finalizar um protocolo no Passo 1
2. Verificar no banco imediatamente após finalizar:

```sql
-- Verificar protocolo recém-criado
SELECT id, status, passo2_data, passo2_tecnico_responsavel
FROM protocolos_sincronizacao
WHERE created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

### ✅ Resultado Esperado:
- [ ] `status = 'PASSO1_FECHADO'`
- [ ] `passo2_data = NULL`
- [ ] `passo2_tecnico_responsavel = NULL`

3. Ir em **"Aguardando 2º Passo"**
4. Clicar **"INICIAR 2º PASSO"**
5. Preencher data e técnico
6. Confirmar

### ✅ Resultado Esperado:
- [ ] `passo2_data` preenchido
- [ ] `passo2_tecnico_responsavel` preenchido
- [ ] Navega para tela do Passo 2

---

## 🎯 Teste 9: Validação de SelectItem (sem value="")

**Objetivo:** Verificar que não há erros de SelectItem no console

### Passos:
1. Abrir **Console do Navegador** (F12)
2. Aba **Console**
3. Criar novo protocolo
4. Clicar em **"Adicionar Receptora"**
5. Abrir o Select de receptoras

### ✅ Resultado Esperado:
- [ ] **Nenhum erro** no console sobre SelectItem com value=""
- [ ] Select funciona normalmente
- [ ] Pode selecionar receptoras

### Teste Adicional:
6. Ir para Passo 2 de um protocolo
7. Descartar uma receptora
8. No Select de "Motivo", selecionar **"Sem motivo"**

### ✅ Resultado Esperado:
- [ ] **Nenhum erro** no console
- [ ] "Sem motivo" pode ser selecionado normalmente

---

## 🎯 Teste 10: Verificar Protocolos Zumbis Não Aparecem

**Objetivo:** Verificar que protocolos sem receptoras não aparecem no histórico

### Passos:
1. **Criar protocolo de teste** (se necessário)
2. Ir em **Protocolos > Histórico**
3. Selecionar Fazenda
4. Usar **"Últimos 30 dias"**
5. Clicar **"Buscar Protocolos"**

### ✅ Resultado Esperado:
- [ ] **Apenas protocolos com receptoras** aparecem na lista
- [ ] Protocolos órfãos (sem receptoras) NÃO aparecem
- [ ] Todos os protocolos listados têm `receptoras_count > 0`

---

## 📊 Resumo de Testes

Marque conforme vai testando:

- [ ] **Teste 1:** Multi-clique não cria duplicados
- [ ] **Teste 2:** Validação de receptoras funciona
- [ ] **Teste 3:** Receptoras recicladas funcionam
- [ ] **Teste 4:** Histórico não busca automaticamente
- [ ] **Teste 5:** Atalhos de data funcionam
- [ ] **Teste 6:** Busca e paginação funcionam
- [ ] **Teste 7:** Operação atômica (sem protocolos órfãos)
- [ ] **Teste 8:** Passo 2 não é criado automaticamente
- [ ] **Teste 9:** Sem erros de SelectItem
- [ ] **Teste 10:** Zumbis não aparecem no histórico

---

## 🐛 Se Algo Der Errado

### Erro ao Finalizar Passo 1:
- Verifique o console do navegador (F12)
- Verifique se a RPC foi criada corretamente
- Verifique se os IDs de receptoras são válidos

### Protocolos Duplicados:
- Verifique se o `useRef` está funcionando
- Verifique logs no console

### Histórico Lento:
- Verifique se o índice foi criado
- Verifique quantos protocolos existem no período

---

**Boa sorte com os testes! 🚀**
