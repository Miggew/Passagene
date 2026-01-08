# 🧪 Guia de Testes - PassaGene

## 📋 Pré-requisitos

1. **Aplicação rodando localmente:**
   ```bash
   pnpm dev
   ```

2. **Acesso ao Supabase:**
   - Acesse o dashboard do Supabase
   - Vá em "SQL Editor"

---

## 🔧 Passo 1: Executar Migração SQL

### 1.1. Acessar SQL Editor no Supabase
1. Abra o dashboard do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **"SQL Editor"**

### 1.2. Executar a Migração
1. Clique em **"New query"**
2. Cole o seguinte SQL:

```sql
-- Adicionar campos para o 2º passo
ALTER TABLE protocolos_sincronizacao
ADD COLUMN IF NOT EXISTS passo2_data DATE,
ADD COLUMN IF NOT EXISTS passo2_tecnico_responsavel TEXT;
```

3. Clique em **"Run"** (ou pressione `Ctrl+Enter`)
4. Deve aparecer: ✅ "Success. No rows returned"

### 1.3. Verificar se funcionou (opcional)
Execute esta query para verificar:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'protocolos_sincronizacao' 
AND column_name IN ('passo2_data', 'passo2_tecnico_responsavel');
```

Deve retornar 2 linhas com as novas colunas.

---

## ✅ Passo 2: Testar as Funcionalidades

### 🐛 Teste 1: BUG da Data (1 dia antes)

**Objetivo:** Verificar que a data selecionada é salva corretamente no banco.

#### Passo a passo:
1. Acesse: `http://localhost:5173/#/protocolos/novo`
2. Preencha o formulário:
   - Selecione uma fazenda
   - **Selecione uma data específica** (ex: 15/01/2026)
   - Preencha veterinário e técnico
3. Clique em **"Criar Protocolo"**

#### Verificação no Banco:
1. No Supabase, vá em **"Table Editor"**
2. Abra a tabela `protocolos_sincronizacao`
3. Encontre o protocolo recém-criado
4. Verifique a coluna `data_inicio`:
   - ✅ Deve estar como `2026-01-15` (mesma data selecionada)
   - ❌ NÃO deve estar como `2026-01-14` (1 dia antes)

#### Verificação na UI:
1. Na tela de detalhes do protocolo
2. Verifique o campo "Data Início":
   - ✅ Deve mostrar `15/01/2026`
   - ❌ NÃO deve mostrar `14/01/2026`

#### Teste com diferentes datas:
- [ ] Teste com data no início do mês (01/01/2026)
- [ ] Teste com data no fim do mês (31/01/2026)
- [ ] Teste com data no meio do mês (15/01/2026)
- [ ] Todas devem salvar e exibir corretamente

---

### 📝 Teste 2: Modal para Iniciar 2º Passo

**Objetivo:** Verificar que o modal solicita data e técnico antes de iniciar o 2º passo.

#### Pré-requisito:
Você precisa ter um protocolo com status `PASSO1_FECHADO`:
1. Crie um protocolo (Teste 1)
2. Adicione pelo menos 1 receptora
3. Finalize o 1º passo (botão "Finalizar 1º Passo")

#### Passo a passo:
1. Acesse: `http://localhost:5173/#/protocolos`
2. Clique na aba **"2º Passo (para confirmar)"**
3. Encontre um protocolo aguardando 2º passo
4. Clique no botão **"INICIAR 2º PASSO"**

#### Verificações:
- [ ] ✅ Modal deve abrir
- [ ] ✅ Deve ter campo "Data de Realização do 2º Passo" (obrigatório)
- [ ] ✅ Deve ter campo "Técnico Responsável" (obrigatório)
- [ ] ✅ Deve ter botões "Confirmar e Iniciar" e "Cancelar"

#### Teste de Validação:
1. Tente clicar em "Confirmar e Iniciar" sem preencher nada
   - [ ] ✅ Deve mostrar toast de erro: "Data e técnico são obrigatórios"

2. Preencha apenas a data (sem técnico)
   - [ ] ✅ Deve mostrar erro

3. Preencha apenas o técnico (sem data)
   - [ ] ✅ Deve mostrar erro

4. Preencha ambos e confirme:
   - [ ] ✅ Deve salvar no banco
   - [ ] ✅ Deve mostrar toast de sucesso
   - [ ] ✅ Deve navegar para a tela do Passo 2

#### Verificação no Banco:
1. No Supabase, vá em `protocolos_sincronizacao`
2. Encontre o protocolo
3. Verifique:
   - [ ] ✅ `passo2_data` está preenchida com a data informada
   - [ ] ✅ `passo2_tecnico_responsavel` está preenchido com o nome do técnico

#### Verificação na UI:
1. Na tela do Passo 2, verifique o card "Informações do Protocolo"
2. Deve mostrar:
   - [ ] ✅ "Data do 2º Passo" com a data informada
   - [ ] ✅ "Técnico 2º Passo" com o nome do técnico

#### Teste de Persistência:
1. Recarregue a página (F5)
2. Verifique:
   - [ ] ✅ Dados do passo 2 ainda estão visíveis
   - [ ] ✅ Não foram perdidos

---

### 🎨 Teste 3: Botões Melhorados no Passo 2

**Objetivo:** Verificar que os botões de ação estão mais visíveis e fáceis de usar.

#### Passo a passo:
1. Acesse um protocolo no 2º passo
2. Na tabela de receptoras, encontre uma receptora com status "Aguardando Revisão"

#### Verificações Visuais:
- [ ] ✅ Botão "Confirmar" deve ser verde (`bg-green-600`)
- [ ] ✅ Botão "Descartar" deve ser vermelho (`variant="destructive"`)
- [ ] ✅ Ambos devem ter texto visível ("Confirmar" / "Descartar")
- [ ] ✅ Ambos devem ter ícones (CheckCircle / XCircle)
- [ ] ✅ Botões devem estar bem espaçados (não colados)
- [ ] ✅ Botões devem ter tamanho adequado (fácil de clicar)

#### Teste de Funcionalidade:
1. Clique em "Confirmar":
   - [ ] ✅ Deve abrir modal
   - [ ] ✅ Status deve mudar para "Confirmada" após salvar

2. Clique em "Descartar":
   - [ ] ✅ Deve abrir modal
   - [ ] ✅ Status deve mudar para "Descartada" após salvar

#### Teste Responsivo:
1. Reduza a largura da janela do navegador
2. Verifique:
   - [ ] ✅ Botões ainda são clicáveis
   - [ ] ✅ Layout não quebra
   - [ ] ✅ Texto não fica cortado

---

### 🗑️ Teste 4: Motivo Opcional ao Descartar

**Objetivo:** Verificar que é possível descartar uma receptora sem informar motivo.

#### Passo a passo:
1. Acesse um protocolo no 2º passo
2. Clique em "Descartar" em uma receptora
3. No modal, verifique o campo "Motivo"

#### Verificações:
- [ ] ✅ Label deve dizer "Motivo (opcional)" (não "Motivo *")
- [ ] ✅ Select deve ter opção "Sem motivo" no topo
- [ ] ✅ Campo não deve ter asterisco (*) indicando obrigatório

#### Teste sem Motivo:
1. Selecione "Sem motivo" (ou deixe vazio)
2. Clique em "Atualizar Status"
3. Verifique:
   - [ ] ✅ Deve salvar sem erro
   - [ ] ✅ Toast de sucesso deve aparecer
   - [ ] ✅ Status deve mudar para "Descartada"
   - [ ] ✅ Coluna "Motivo" na tabela deve mostrar "-"

#### Verificação no Banco:
1. No Supabase, vá em `protocolo_receptoras`
2. Encontre a receptora descartada
3. Verifique:
   - [ ] ✅ `status` = `'INAPTA'`
   - [ ] ✅ `motivo_inapta` = `null` (ou string vazia)

#### Teste com Motivo:
1. Descartar outra receptora
2. Desta vez, selecione um motivo (ex: "Morreu")
3. Verifique:
   - [ ] ✅ Deve salvar normalmente
   - [ ] ✅ Motivo deve aparecer na tabela

---

### 📊 Teste 5: Consulta de Protocolos Fechados

**Objetivo:** Verificar a nova funcionalidade de consultar protocolos fechados com filtros.

#### Pré-requisito:
Você precisa ter pelo menos 1 protocolo com status `PASSO2_FECHADO`:
1. Complete um protocolo até o 2º passo
2. Finalize o 2º passo

#### Passo a passo:
1. Acesse: `http://localhost:5173/#/receptoras`
2. Observe que há 2 abas:
   - [ ] ✅ "Receptoras" (padrão)
   - [ ] ✅ "Protocolos Fechados"

3. Clique na aba **"Protocolos Fechados"**

#### Verificação Inicial:
- [ ] ✅ Deve mostrar card "Filtros de Busca"
- [ ] ✅ Deve ter 3 campos:
  - Select "Fazenda"
  - Input "Data Início (de)"
  - Input "Data Início (até)"
- [ ] ✅ Deve ter botão "Buscar Protocolos"
- [ ] ✅ Deve mostrar mensagem: "Nenhum protocolo encontrado" (se não houver filtros)

#### Teste sem Filtros:
1. Clique em "Buscar Protocolos" sem preencher nada
   - [ ] ✅ Deve mostrar mensagem apropriada
   - [ ] ✅ Não deve dar erro

#### Teste com Filtro de Fazenda:
1. Selecione uma fazenda no filtro
2. Clique em "Buscar Protocolos"
3. Verifique:
   - [ ] ✅ Deve carregar protocolos daquela fazenda
   - [ ] ✅ Tabela deve aparecer com dados

#### Teste com Filtro de Data:
1. Selecione uma data inicial (ex: 01/01/2026)
2. Selecione uma data final (ex: 31/01/2026)
3. Clique em "Buscar Protocolos"
4. Verifique:
   - [ ] ✅ Deve carregar protocolos no intervalo
   - [ ] ✅ Apenas protocolos dentro do intervalo devem aparecer

#### Teste com Filtros Combinados:
1. Selecione fazenda + intervalo de datas
2. Clique em "Buscar Protocolos"
3. Verifique:
   - [ ] ✅ Deve aplicar ambos os filtros
   - [ ] ✅ Resultados devem satisfazer ambos os critérios

#### Verificação da Tabela:
A tabela deve mostrar:
- [ ] ✅ Fazenda
- [ ] ✅ Data Início (formatada em pt-BR)
- [ ] ✅ Data 2º Passo (formatada em pt-BR)
- [ ] ✅ Técnico 2º Passo
- [ ] ✅ Receptoras Confirmadas (número)
- [ ] ✅ Status (badge "Fechado")
- [ ] ✅ Botão "Ver Detalhes"

#### Teste de Navegação:
1. Clique em "Ver Detalhes" em um protocolo
2. Verifique:
   - [ ] ✅ Deve navegar para `/protocolos/{id}`
   - [ ] ✅ Deve mostrar os detalhes do protocolo

#### Teste de Contagem:
1. Verifique a contagem de "Receptoras Confirmadas"
2. No banco, confira:
   ```sql
   SELECT COUNT(*) 
   FROM protocolo_receptoras 
   WHERE protocolo_id = '{id}' 
   AND status = 'APTA';
   ```
3. Verifique:
   - [ ] ✅ Número na tabela deve corresponder ao banco

---

## 🔍 Testes Adicionais de Integração

### Teste de Fluxo Completo:
1. [ ] Criar protocolo (data correta)
2. [ ] Adicionar receptoras
3. [ ] Finalizar 1º passo
4. [ ] Iniciar 2º passo (com modal)
5. [ ] Confirmar algumas receptoras
6. [ ] Descartar outras (com e sem motivo)
7. [ ] Finalizar 2º passo
8. [ ] Buscar protocolo fechado em Receptoras
9. [ ] Verificar todos os dados estão corretos

### Teste de Edge Cases:
- [ ] Protocolo sem receptoras (deve funcionar normalmente)
- [ ] Protocolo com muitas receptoras (performance)
- [ ] Buscar protocolos com datas muito antigas
- [ ] Buscar protocolos com datas futuras
- [ ] Protocolo sem dados do passo 2 (deve mostrar "-")

---

## 🐛 Como Reportar Problemas

Se encontrar algum problema durante os testes:

1. **Anote:**
   - Qual teste falhou
   - Passo exato onde falhou
   - Mensagem de erro (se houver)
   - Screenshot (se possível)

2. **Verifique:**
   - Console do navegador (F12) para erros JavaScript
   - Network tab para erros de API
   - Banco de dados para dados inconsistentes

3. **Informe:**
   - Descreva o problema claramente
   - Inclua os passos para reproduzir
   - Adicione screenshots/logs se possível

---

## ✅ Checklist Final

Após todos os testes, verifique:

- [ ] Migração SQL executada com sucesso
- [ ] Todas as 5 funcionalidades testadas
- [ ] Nenhum erro no console do navegador
- [ ] Dados salvos corretamente no banco
- [ ] UI responsiva e funcional
- [ ] Fluxo completo funcionando

---

## 🎯 Próximos Passos

Se todos os testes passarem:

1. ✅ Commit das alterações
2. ✅ Push para o repositório
3. ✅ Deploy (se aplicável)
4. ✅ Monitorar em produção

---

**Boa sorte com os testes! 🚀**
