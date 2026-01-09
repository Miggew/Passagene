# ✅ Checklist de Testes - Bug do Dropdown Corrigido

Este checklist verifica que o bug do dropdown inconsistente foi corrigido definitivamente.

---

## 🐛 Bug Original

**Problema:** Receptora já selecionada continuava aparecendo no dropdown de forma inconsistente (às vezes sumia, às vezes não).

**Causa Raiz Identificada:**
- State separado `receptorasDisponiveis` que podia ficar desatualizado
- Cálculo assíncrono com possível race condition
- Falta de re-render forçado no SelectContent quando selecionadas mudavam
- Possível inconsistência de tipos (string vs UUID)

---

## ✅ Correções Implementadas

1. **Removido state `receptorasDisponiveis`** - Fonte de verdade única
2. **Criado state `allReceptoras`** - Todas as receptoras VAZIAS da fazenda
3. **Cálculo derivado `availableReceptoras`** - Sempre calculado a partir de `allReceptoras` e `selectedIds`
4. **`selectedIds` como Set normalizado** - IDs sempre como string para comparação consistente
5. **Key no SelectContent** - Força re-render quando selecionadas mudam
6. **Normalização de IDs** - Sempre converter para string e trim antes de comparar

---

## 🔍 TESTE 1: Adicionar Receptora - Deve Sumir Imediatamente

**Objetivo:** Verificar que receptora adicionada some do dropdown imediatamente e permanentemente.

### Passos:

1. [ ] Criar novo protocolo
2. [ ] Preencher dados e continuar para "Adicionar Receptoras"
3. [ ] Clicar em "Adicionar Receptora"
4. [ ] Selecionar Receptora A no dropdown
5. [ ] Clicar em "Adicionar"
6. [ ] Verificar que Receptora A aparece na lista de selecionadas
7. [ ] **IMEDIATAMENTE** após adicionar, clicar novamente em "Adicionar Receptora"
8. [ ] Abrir o dropdown

### Resultado Esperado:

- [ ] ✅ Receptora A **NÃO aparece** no dropdown
- [ ] ✅ Dropdown mostra apenas receptoras ainda não selecionadas
- [ ] ✅ Select está limpo (mostra placeholder "Selecione uma receptora VAZIA")

---

## 🔍 TESTE 2: Abrir e Fechar Dropdown Múltiplas Vezes

**Objetivo:** Verificar que dropdown é determinístico - mesmas entradas => mesmas opções.

### Passos:

1. [ ] Com Receptora A já adicionada (do teste anterior)
2. [ ] Abrir dropdown "Adicionar Receptora"
3. [ ] Verificar lista
4. [ ] Fechar dropdown (clicar fora ou ESC)
5. [ ] Abrir dropdown novamente
6. [ ] Verificar lista novamente
7. [ ] Repetir 3-4 vezes

### Resultado Esperado:

- [ ] ✅ Receptora A **NUNCA aparece** no dropdown
- [ ] ✅ Lista permanece **sempre a mesma** (determinística)
- [ ] ✅ Não há "flicker" ou mudanças aleatórias na lista

---

## 🔍 TESTE 3: Adicionar Múltiplas Receptoras

**Objetivo:** Verificar que múltiplas receptoras podem ser adicionadas e todas somem do dropdown.

### Passos:

1. [ ] Com Receptora A já adicionada
2. [ ] Adicionar Receptora B
3. [ ] Verificar que ambas aparecem na lista de selecionadas
4. [ ] Abrir dropdown novamente
5. [ ] Verificar lista

### Resultado Esperado:

- [ ] ✅ Receptora A **NÃO aparece** no dropdown
- [ ] ✅ Receptora B **NÃO aparece** no dropdown
- [ ] ✅ Receptora A **permanece** na lista de selecionadas
- [ ] ✅ Receptora B **permanece** na lista de selecionadas
- [ ] ✅ Lista de selecionadas mostra ambas corretamente

### Continuar Teste:

6. [ ] Adicionar Receptora C
7. [ ] Verificar que todas as 3 estão na lista de selecionadas
8. [ ] Abrir dropdown

### Resultado Esperado:

- [ ] ✅ Nenhuma das 3 (A, B, C) aparece no dropdown
- [ ] ✅ Todas as 3 permanecem na lista de selecionadas

---

## 🔍 TESTE 4: Tentar Adicionar Duplicata

**Objetivo:** Verificar que duplicidade é bloqueada mesmo se tentar forçar.

### Passos:

1. [ ] Com Receptora A já adicionada
2. [ ] Tentar adicionar Receptora A novamente (mesmo que não apareça no dropdown)
3. [ ] Se por algum motivo aparecer, selecionar e tentar adicionar

### Resultado Esperado:

- [ ] ✅ Se aparecer no dropdown (não deveria), ao tentar adicionar mostra toast: "Receptora já adicionada"
- [ ] ✅ Lista de selecionadas mantém apenas 1 ocorrência de A
- [ ] ✅ Não cria duplicata no estado

---

## 🔍 TESTE 5: Remover e Re-adicionar Receptora

**Objetivo:** Verificar que ao remover, receptora volta ao dropdown.

### Passos:

1. [ ] Com Receptora A adicionada
2. [ ] Remover Receptora A (botão X)
3. [ ] Verificar que A saiu da lista de selecionadas
4. [ ] Abrir dropdown "Adicionar Receptora"
5. [ ] Verificar lista

### Resultado Esperado:

- [ ] ✅ Receptora A **VOLTA** a aparecer no dropdown
- [ ] ✅ Pode ser selecionada e adicionada novamente
- [ ] ✅ Lista de selecionadas não contém mais A

### Continuar Teste:

6. [ ] Adicionar Receptora A novamente
7. [ ] Verificar que A some do dropdown imediatamente

### Resultado Esperado:

- [ ] ✅ Funciona corretamente (A some novamente)

---

## 🔍 TESTE 6: Console - Sem Erros

**Objetivo:** Verificar que não há erros no console relacionados ao Select.

### Passos:

1. [ ] Abrir Console do Navegador (F12)
2. [ ] Ir para criação de protocolo (Passo 1)
3. [ ] Adicionar múltiplas receptoras (A, B, C)
4. [ ] Abrir e fechar dropdown várias vezes
5. [ ] Remover e re-adicionar receptoras

### Resultado Esperado:

- [ ] ✅ **Nenhum erro** no console sobre SelectItem com value=""
- [ ] ✅ **Nenhum erro** sobre keys duplicadas
- [ ] ✅ **Nenhum warning** do React sobre dependências de hooks
- [ ] ✅ Console limpo (apenas logs normais se houver)

---

## 🔍 TESTE 7: Finalizar Passo 1 - IDs Corretos

**Objetivo:** Verificar que Finalizar envia os IDs corretos (sem duplicatas, sem IDs vazios).

### Passos:

1. [ ] Adicionar receptoras A, B, C
2. [ ] Verificar lista de selecionadas (3 receptoras)
3. [ ] Clicar em "Finalizar 1º Passo"
4. [ ] Verificar no console (F12) a requisição RPC

### Resultado Esperado:

- [ ] ✅ RPC é chamada com array de IDs: `[idA, idB, idC]`
- [ ] ✅ **Exatamente 3 IDs** (sem duplicatas)
- [ ] ✅ **Nenhum ID vazio/null/undefined**
- [ ] ✅ Todos os IDs são UUIDs válidos (strings)

### Verificação no Banco:

```sql
-- Verificar receptoras vinculadas
SELECT pr.receptora_id, r.identificacao, COUNT(*) as count
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '<ID_DO_PROTOCOLO_CRIADO>'
GROUP BY pr.receptora_id, r.identificacao
HAVING COUNT(*) > 1;
```

- [ ] ✅ Query não retorna linhas (sem duplicatas)
- [ ] ✅ Protocolo tem exatamente 3 receptoras vinculadas

---

## 🔍 TESTE 8: Performance e Responsividade

**Objetivo:** Verificar que cálculo derivado não causa lentidão.

### Passos:

1. [ ] Ter fazenda com muitas receptoras (20+ receptoras VAZIAS)
2. [ ] Adicionar 10 receptoras
3. [ ] Abrir dropdown
4. [ ] Observar tempo de resposta

### Resultado Esperado:

- [ ] ✅ Dropdown abre rapidamente (< 200ms)
- [ ] ✅ Lista renderiza sem lag
- [ ] ✅ Seleção funciona normalmente

---

## 🔍 TESTE 9: Edge Cases

### 9.1 - Receptora Nova Criada no Wizard

**Passos:**
1. [ ] Criar nova receptora diretamente no wizard
2. [ ] Verificar que ela aparece na lista de selecionadas
3. [ ] Tentar adicionar ela novamente via dropdown

**Resultado Esperado:**
- [ ] ✅ Receptora nova não aparece no dropdown (já está selecionada)
- [ ] ✅ Não pode ser adicionada duas vezes

### 9.2 - Mudar de Fazenda (se possível)

**Passos:**
1. [ ] Voltar para o passo de formulário
2. [ ] Mudar fazenda
3. [ ] Continuar para receptoras novamente

**Resultado Esperado:**
- [ ] ✅ Lista de receptoras atualiza corretamente
- [ ] ✅ Receptoras da fazenda anterior não aparecem
- [ ] ✅ Dropdown funciona normalmente

### 9.3 - Select Vazio (nenhuma receptora disponível)

**Passos:**
1. [ ] Selecionar fazenda que não tem receptoras VAZIAS
2. [ ] Continuar para receptoras
3. [ ] Tentar adicionar receptora

**Resultado Esperado:**
- [ ] ✅ Dropdown mostra: "Nenhuma receptora VAZIA disponível nesta fazenda"
- [ ] ✅ Botão "Adicionar" está desabilitado
- [ ] ✅ Não há erros no console

---

## 📊 Critérios de Sucesso Final

### Checklist Completo:

- [ ] ✅ Adicionar A → A some do dropdown **imediatamente**
- [ ] ✅ Abrir/fechar dropdown → A **nunca** volta a aparecer
- [ ] ✅ Adicionar B → A continua fora, B some também
- [ ] ✅ Lista de selecionadas **sempre correta** e estável
- [ ] ✅ **Nenhum erro** no console
- [ ] ✅ Não há duplicatas na lista de selecionadas
- [ ] ✅ Não há duplicatas enviadas ao finalizar
- [ ] ✅ Remover receptora → ela volta ao dropdown
- [ ] ✅ Select sempre limpo após adicionar (placeholder)

---

## 🐛 Problemas Encontrados (se houver)

Liste aqui qualquer problema:

1. _________________________________________________________
2. _________________________________________________________
3. _________________________________________________________

---

## ✅ Assinatura de Teste

- [ ] Todos os testes acima foram executados
- [ ] Bug do dropdown inconsistente foi **corrigido definitivamente**
- [ ] Comportamento é **determinístico** e **consistente**
- [ ] Nenhum novo bug foi introduzido

**Data do Teste:** _______________

**Testado por:** _______________
