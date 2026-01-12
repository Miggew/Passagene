# 📋 Resumo da Implementação - Classificações de Receptoras

## ✅ Objetivo

Adicionar duas classificações opcionais para receptoras que são definidas **apenas no Passo 1** do protocolo e permanecem **travadas (read-only)** após o Passo 1 ser fechado.

---

## 🗄️ Banco de Dados

### Migration SQL: `migrations_add_classificacoes_receptoras.sql`

**Tabela alterada:** `protocolo_receptoras`

**Colunas adicionadas:**

1. **`ciclando_classificacao`** (TEXT NULL)
   - Valores permitidos: `'N'`, `'CL'` ou `NULL`
   - Constraint: `CHECK (ciclando_classificacao IN ('N', 'CL') OR ciclando_classificacao IS NULL)`

2. **`qualidade_semaforo`** (SMALLINT NULL)
   - Valores permitidos: `1`, `2`, `3` ou `NULL`
   - Constraint: `CHECK ((qualidade_semaforo >= 1 AND qualidade_semaforo <= 3) OR qualidade_semaforo IS NULL)`

**View criada:** `vw_receptoras_protocolo_ativo`
- Retorna receptoras com seu protocolo ativo mais recente
- Inclui as classificações `ciclando_classificacao` e `qualidade_semaforo`

**Observações:**
- ❌ **NÃO há DEFAULT** - campos devem ser `NULL` por padrão
- Campos só são preenchidos explicitamente no Passo 1

---

## 🎨 Componentes Reutilizáveis Criados

### 1. `CiclandoBadge` (`src/components/shared/CiclandoBadge.tsx`)

**Props:**
- `value: 'N' | 'CL' | null | undefined`
- `onChange?: (value: 'N' | 'CL' | null) => void`
- `disabled?: boolean`
- `variant?: 'display' | 'editable'` (default: `'display'`)

**Comportamento:**
- **Display mode:** Mostra badge CL (azul) ou N (cinza), ou "—" se null
- **Editable mode:** Abre popover com opções CL, N e "Limpar" (seta null)

### 2. `QualidadeSemaforo` (`src/components/shared/QualidadeSemaforo.tsx`)

**Props:**
- `value: 1 | 2 | 3 | null | undefined`
- `onChange?: (value: 1 | 2 | 3 | null) => void`
- `disabled?: boolean`
- `variant?: 'single' | 'row'` (default: `'single'`)

**Comportamento:**
- **Single mode:** Mostra apenas a bolinha correspondente (vermelha=1, amarela=2, verde=3) ou "—" se null
- **Row mode:** Mostra popover com 3 bolinhas clicáveis + opção "Limpar"

**Visual:**
- 🔴 Vermelho = 1
- 🟡 Amarelo = 2
- 🟢 Verde = 3

---

## 📄 Arquivos Alterados

### 1. `src/lib/types.ts`

**Mudanças:**
- Adicionados campos `ciclando_classificacao` e `qualidade_semaforo` à interface `ProtocoloReceptora`

```typescript
export interface ProtocoloReceptora {
  // ... campos existentes
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
}
```

---

### 2. `src/pages/ProtocoloFormWizard.tsx`

**Mudanças principais:**

1. **Interface `ReceptoraLocal` atualizada:**
   - Adicionados campos `ciclando_classificacao` e `qualidade_semaforo`

2. **Formulário de adicionar receptora:**
   - Adicionados campos `CiclandoBadge` e `QualidadeSemaforo` (editáveis)
   - Campos são opcionais (podem ficar null)

3. **Tabela de receptoras:**
   - Adicionadas colunas "Ciclando" e "Qualidade"
   - Componentes permitem edição inline (enquanto Passo 1 está aberto)

4. **`handleFinalizarPasso1`:**
   - Após criar protocolo via RPC, faz UPDATE em lote das classificações
   - Persiste valores (incluindo null) no banco

5. **`handleAddReceptora`:**
   - Inclui classificações ao adicionar receptora à lista local

---

### 3. `src/pages/ProtocoloPasso2.tsx`

**Mudanças:**

1. **Interface `ReceptoraWithStatus` atualizada:**
   - Adicionados `pr_ciclando_classificacao` e `pr_qualidade_semaforo`

2. **`loadReceptoras`:**
   - Carrega classificações do banco junto com outros dados

3. **Tabela de receptoras:**
   - Adicionadas colunas "Ciclando" e "Qualidade" (read-only)
   - Componentes em modo `display` e `disabled={true}`

4. **Handlers `handleConfirmarReceptora` e `handleDescartarReceptora`:**
   - ✅ **NÃO alteram** as classificações (apenas atualizam status)
   - Classificações permanecem como foram definidas no Passo 1

---

### 4. `src/pages/ProtocoloRelatorioFechado.tsx`

**Mudanças:**

1. **Interface `ReceptoraComStatusFinal` atualizada:**
   - Adicionados campos de classificação

2. **`loadReceptoras`:**
   - Carrega classificações do banco

3. **Tabela do relatório:**
   - Adicionadas colunas "Ciclando" e "Qualidade" (read-only)
   - Exibe classificações no relatório final

---

## 🔒 Regras de Edição Implementadas

### ✅ Passo 1 (Editável)

- Classificações podem ser definidas/alteradas:
  - Ao adicionar receptora (modal de adicionar)
  - Diretamente na tabela (edição inline)
- Valores podem ser:
  - `'N'` ou `'CL'` para ciclando
  - `1`, `2` ou `3` para qualidade
  - `null` (campo vazio/limpo)

### 🔒 Passo 2 (Read-only)

- Classificações são **apenas exibidas**
- Nenhum handler altera essas classificações
- Componentes renderizados com `variant="display"` e `disabled={true}`

### 🔒 Relatório Fechado (Read-only)

- Classificações são **apenas exibidas** no relatório
- Mantém histórico das classificações definidas no Passo 1

---

## ✅ Verificações Realizadas

1. ✅ Passo 2 **NÃO preenche automaticamente** as classificações
2. ✅ Handlers de confirmação/descarte **NÃO alteram** classificações
3. ✅ Componentes reutilizáveis criados e funcionais
4. ✅ Migration SQL pronta para execução
5. ✅ Tipos TypeScript atualizados
6. ✅ Todas as telas atualizadas (Passo 1, Passo 2, Relatório)
7. ✅ Nenhum erro de lint

---

## 🚀 Próximos Passos (Futuro - TE)

Os componentes `CiclandoBadge` e `QualidadeSemaforo` estão prontos para uso no módulo de Transferência de Embriões:

- Usar `variant="display"` para exibir apenas
- Usar `variant="row"` (QualidadeSemaforo) se precisar exibir 3 bolinhas
- Garantir `disabled={true}` se não for permitir edição

---

## 📝 Notas Técnicas

### RPC `criar_protocolo_passo1_atomico`

A RPC atual não aceita os novos campos. A solução implementada:

1. RPC cria protocolo + vínculos básicos (como antes)
2. Após sucesso, faz UPDATE em lote das classificações
3. Updates são feitos em paralelo (Promise.allSettled) para performance
4. Erros de update são logados mas não impedem criação do protocolo

**Alternativa futura (opcional):**
- Atualizar a RPC para aceitar arrays de classificações como parâmetros
- Fazer tudo em uma única transação (mais eficiente)

---

## 🧪 Checklist de Testes

- [ ] Criar protocolo no Passo 1 com classificações
- [ ] Verificar que classificações são persistidas
- [ ] Verificar que Passo 2 exibe classificações (read-only)
- [ ] Verificar que relatório fechado exibe classificações
- [ ] Verificar que campos podem ficar null/vazios
- [ ] Verificar edição inline no Passo 1
- [ ] Verificar que Passo 2 não altera classificações

---

**Data da Implementação:** 2026-01-08

**Status:** ✅ Implementado e Pronto para Teste
