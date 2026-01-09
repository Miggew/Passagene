# ✅ Checklist de Testes Manuais - Mudanças Implementadas

Este checklist cobre todas as mudanças implementadas.

---

## 🔍 Pré-requisitos

- [ ] Aplicação rodando localmente (`pnpm dev`)
- [ ] Acesso ao Supabase Dashboard
- [ ] Ter pelo menos 1 protocolo fechado (PASSO2_FECHADO) para testar relatório
- [ ] Ter receptoras cadastradas para testar Passo 1

---

## 1️⃣ TESTE: Relatório do Protocolo - Cabeçalho e Tabela Final

**Objetivo:** Verificar que o relatório tem cabeçalho na ordem correta, sem timeline, e com tabela final.

### Passos:

1. [ ] Acessar um protocolo fechado (PASSO2_FECHADO) pelo histórico/relatório
2. [ ] Verificar seção "Informações do Protocolo"

### Resultado Esperado - Cabeçalho (ordem fixa):

- [ ] ✅ Campo 1: "Fazenda" (mostra nome da fazenda ou "—")
- [ ] ✅ Campo 2: "Data início" (mostra data formatada ou "—")
- [ ] ✅ Campo 3: "Vet responsável pelo início" (extraído de responsavel_inicio ou "—")
- [ ] ✅ Campo 4: "Tec responsável pelo início" (extraído de responsavel_inicio ou "—")
- [ ] ✅ Campo 5: "Data segundo passo" (mostra data ou "—")
- [ ] ✅ Campo 6: "Responsável pelo segundo passo" (mostra técnico ou "—")
- [ ] ✅ Campos nulos mostram "—" (não ficam vazios)

### Resultado Esperado - Totais:

- [ ] ✅ Seção de totais permanece igual (Total Iniciaram, Confirmadas, Descartadas, Taxa de Sucesso)

### Resultado Esperado - Timeline REMOVIDA:

- [ ] ✅ **NÃO existe mais** seção "Linha do Tempo"
- [ ] ✅ **NÃO existe mais** seção "Receptoras que Iniciaram o Protocolo"
- [ ] ✅ **NÃO existe mais** seção "Resultado Final das Receptoras" (separada)

### Resultado Esperado - Nova Tabela Final:

- [ ] ✅ Existe seção "Receptoras e Resultado Final"
- [ ] ✅ Tabela tem 3 colunas:
  - Identificação (brinco e nome se existir)
  - Resultado Final (badge com status: Confirmada/Descartada)
  - Motivo do Descarte (mostra motivo se descartada, ou "—")
- [ ] ✅ Tabela mostra TODAS as receptoras do protocolo
- [ ] ✅ Status final reflete o estado real (APTA/INAPTA)
- [ ] ✅ **Não há botões de ação/edição** (read-only)
- [ ] ✅ Se não houver receptoras, mostra mensagem "Nenhuma receptora no protocolo"

### Verificação no Banco (opcional):

```sql
-- Verificar estrutura de responsavel_inicio
SELECT id, responsavel_inicio, passo2_tecnico_responsavel
FROM protocolos_sincronizacao
WHERE status = 'PASSO2_FECHADO'
LIMIT 1;
```

- [ ] ✅ Formato: "VET: <nome> | TEC: <nome>" (ou similar)

---

## 2️⃣ TESTE: Passo 1 - Seleção de Receptoras Corrigida

**Objetivo:** Verificar que receptoras já selecionadas não aparecem na lista de disponíveis e não desaparecem da lista selecionada.

### Passos:

1. [ ] Criar novo protocolo
2. [ ] Preencher fazenda, data, veterinário, técnico
3. [ ] Continuar para "Adicionar Receptoras"
4. [ ] Clicar em "Adicionar Receptora"
5. [ ] Selecionar receptora A da lista
6. [ ] Adicionar (clicar em "Adicionar")
7. [ ] Verificar que receptora A aparece na lista de selecionadas
8. [ ] Abrir novamente "Adicionar Receptora"
9. [ ] Tentar encontrar receptora A na lista

### Resultado Esperado:

- [ ] ✅ Receptora A **NÃO aparece** na lista de disponíveis após ser adicionada
- [ ] ✅ Receptora A **permanece** na lista de selecionadas
- [ ] ✅ Campo Select volta para placeholder "Selecione uma receptora VAZIA" após adicionar

### Continuar Teste:

10. [ ] Selecionar receptora B da lista disponível
11. [ ] Adicionar receptora B
12. [ ] Verificar ambas na lista de selecionadas

### Resultado Esperado:

- [ ] ✅ Receptora B aparece na lista de selecionadas
- [ ] ✅ Receptora A **continua** na lista de selecionadas (não sumiu)
- [ ] ✅ Receptora B **NÃO aparece** mais na lista de disponíveis

### Teste de Duplicidade:

13. [ ] Tentar adicionar receptora A novamente (mesmo que não apareça na lista)
14. [ ] Se aparecer por algum motivo, tentar selecionar

### Resultado Esperado:

- [ ] ✅ **Não é possível** adicionar a mesma receptora duas vezes
- [ ] ✅ Se tentar, mostra toast: "Receptora já adicionada"
- [ ] ✅ Lista de selecionadas mantém apenas 1 ocorrência de cada receptora

### Teste de Validação - Finalizar:

15. [ ] Verificar que há pelo menos 1 receptora selecionada
16. [ ] Clicar em "Finalizar 1º Passo"

### Resultado Esperado:

- [ ] ✅ Protocolo é criado com todas as receptoras selecionadas
- [ ] ✅ IDs enviados correspondem exatamente às receptoras na lista
- [ ] ✅ Não há IDs duplicados
- [ ] ✅ Não há IDs vazios/nulos

### Verificação no Banco:

```sql
-- Verificar receptoras vinculadas ao protocolo recém-criado
SELECT pr.receptora_id, r.identificacao, COUNT(*) as count
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '<ID_DO_PROTOCOLO_CRIADO>'
GROUP BY pr.receptora_id, r.identificacao
HAVING COUNT(*) > 1;
```

- [ ] ✅ Query não retorna linhas (não há duplicatas)

---

## 3️⃣ TESTE: Passo 2 - Botão Confirmar Simplificado

**Objetivo:** Verificar que "Confirmar" abre apenas dialog de confirmação, sem Select de status.

### Passos:

1. [ ] Acessar protocolo no Passo 2 (status PASSO1_FECHADO ou PASSO2 aberto)
2. [ ] Identificar receptora com status "Aguardando Revisão" (INICIADA)
3. [ ] Clicar no botão "Confirmar" dessa receptora

### Resultado Esperado - Dialog de Confirmação:

- [ ] ✅ Abre dialog com título "Confirmar Receptora"
- [ ] ✅ Mostra mensagem: "Tem certeza que deseja confirmar a receptora <brinco>?"
- [ ] ✅ Mostra texto explicativo: "A receptora será marcada como APTA e seguirá para TE"
- [ ] ✅ **NÃO existe** Select para escolher status
- [ ] ✅ Botões: "Cancelar" e "Confirmar"

### Continuar Teste:

4. [ ] Clicar em "Confirmar" no dialog
5. [ ] Observar comportamento

### Resultado Esperado - Após Confirmar:

- [ ] ✅ Dialog fecha automaticamente
- [ ] ✅ Toast de sucesso: "Receptora confirmada"
- [ ] ✅ Status da receptora muda para "Confirmada" (badge verde)
- [ ] ✅ Botões "Confirmar" e "Descartar" desaparecem da linha
- [ ] ✅ Status no banco é atualizado para `APTA`
- [ ] ✅ `motivo_inapta` fica NULL

### Teste de Multi-clique:

6. [ ] Tentar clicar rapidamente várias vezes em "Confirmar" (antes de fechar dialog)

### Resultado Esperado:

- [ ] ✅ Botão desabilita durante salvamento ("Confirmando...")
- [ ] ✅ **Apenas 1 requisição** é enviada ao servidor
- [ ] ✅ Não cria múltiplas atualizações

### Verificação no Banco:

```sql
-- Verificar status atualizado
SELECT pr.status, pr.motivo_inapta
FROM protocolo_receptoras pr
WHERE pr.receptora_id = '<ID_DA_RECEPTORA_CONFIRMADA>'
AND pr.protocolo_id = '<ID_DO_PROTOCOLO>';
```

- [ ] ✅ `status = 'APTA'`
- [ ] ✅ `motivo_inapta = NULL`

---

## 4️⃣ TESTE: Passo 2 - Botão Descartar (Mantido)

**Objetivo:** Verificar que "Descartar" continua funcionando com motivo opcional.

### Passos:

1. [ ] Acessar protocolo no Passo 2
2. [ ] Identificar outra receptora com status "Aguardando Revisão"
3. [ ] Clicar no botão "Descartar"

### Resultado Esperado - Dialog de Descartar:

- [ ] ✅ Abre dialog com título "Descartar Receptora"
- [ ] ✅ Mostra mensagem: "Descartar a receptora <brinco> do protocolo?"
- [ ] ✅ Existe Select para "Motivo do descarte (opcional)"
- [ ] ✅ Select tem opções: Sem motivo, Morreu, Doente, Sumiu, Perdeu P4, Não respondeu, Outro
- [ ] ✅ Botões: "Cancelar" e "Descartar"

### Continuar Teste:

4. [ ] Selecionar motivo (ex: "Morreu")
5. [ ] Clicar em "Descartar"

### Resultado Esperado:

- [ ] ✅ Dialog fecha automaticamente
- [ ] ✅ Toast de sucesso: "Receptora descartada"
- [ ] ✅ Status muda para "Descartada" (badge vermelho)
- [ ] ✅ Motivo aparece na coluna "Motivo" da tabela
- [ ] ✅ Status no banco é atualizado para `INAPTA`
- [ ] ✅ `motivo_inapta` contém o motivo selecionado

### Teste sem Motivo:

6. [ ] Descartar outra receptora sem selecionar motivo (ou selecionar "Sem motivo")
7. [ ] Confirmar

### Resultado Esperado:

- [ ] ✅ Funciona corretamente
- [ ] ✅ `motivo_inapta = NULL` no banco

---

## 5️⃣ TESTE: Radix Select - Sem Value Vazio

**Objetivo:** Verificar que nenhum SelectItem tem value vazio (previne erros do Radix).

### Passos:

1. [ ] Abrir Console do Navegador (F12)
2. [ ] Ir para criação de novo protocolo (Passo 1)
3. [ ] Clicar em "Adicionar Receptora"
4. [ ] Abrir o Select de receptoras

### Resultado Esperado:

- [ ] ✅ **Nenhum erro** no console sobre SelectItem com value=""
- [ ] ✅ Select funciona normalmente
- [ ] ✅ Todos os SelectItems têm values válidos (não vazios)

### Continuar Teste:

5. [ ] Ir para Passo 2
6. [ ] Descartar uma receptora
7. [ ] Abrir Select de "Motivo"

### Resultado Esperado:

- [ ] ✅ **Nenhum erro** no console
- [ ] ✅ Select de motivo funciona normalmente
- [ ] ✅ Todos os SelectItems têm values válidos

---

## 6️⃣ TESTE: Estados Consistentes - IDs Únicos

**Objetivo:** Verificar que não há estados inconsistentes (IDs duplicados, itens que somem).

### Passos:

1. [ ] Criar novo protocolo
2. [ ] Adicionar 3 receptoras diferentes (A, B, C)
3. [ ] Verificar lista de selecionadas

### Resultado Esperado:

- [ ] ✅ Lista mostra exatamente 3 receptoras
- [ ] ✅ Cada receptora aparece apenas 1 vez
- [ ] ✅ IDs são únicos

### Continuar Teste:

4. [ ] Remover receptora B (usar botão X)
5. [ ] Verificar lista

### Resultado Esperado:

- [ ] ✅ Receptora B é removida
- [ ] ✅ Receptoras A e C permanecem
- [ ] ✅ Receptora B volta a aparecer na lista de disponíveis

### Teste de Finalizar:

6. [ ] Finalizar Passo 1 com A e C selecionadas
7. [ ] Verificar no banco

### Resultado Esperado:

- [ ] ✅ Protocolo criado com 2 receptoras vinculadas
- [ ] ✅ IDs são A e C (exatamente as que estavam selecionadas)
- [ ] ✅ Não há receptoras extras
- [ ] ✅ Não há receptoras faltando

---

## 📊 Resumo dos Testes

### Critérios de Sucesso:

- [ ] ✅ Relatório tem cabeçalho na ordem correta
- [ ] ✅ Timeline foi removida completamente
- [ ] ✅ Tabela final mostra receptoras e resultado
- [ ] ✅ Receptoras não aparecem duplicadas na seleção
- [ ] ✅ Receptoras não desaparecem da lista selecionada
- [ ] ✅ Confirmar vai direto sem Select de status
- [ ] ✅ Descartar continua com motivo opcional
- [ ] ✅ Nenhum SelectItem com value vazio
- [ ] ✅ Estados consistentes (IDs únicos)

### Arquivos Alterados para Verificar:

- [ ] `src/pages/ProtocoloRelatorioFechado.tsx` - Relatório ajustado
- [ ] `src/pages/ProtocoloFormWizard.tsx` - Seleção corrigida
- [ ] `src/pages/ProtocoloPasso2.tsx` - Confirmação simplificada

---

## 🐛 Problemas Encontrados (se houver)

Liste aqui quaisquer problemas encontrados:

1. _________________________________________________________
2. _________________________________________________________
3. _________________________________________________________

---

## ✅ Assinatura de Teste

- [ ] Todos os testes acima foram executados
- [ ] Todos os resultados esperados foram confirmados
- [ ] Nenhum bug foi encontrado
- [ ] Mudanças estão funcionando conforme especificado

**Data do Teste:** _______________

**Testado por:** _______________
