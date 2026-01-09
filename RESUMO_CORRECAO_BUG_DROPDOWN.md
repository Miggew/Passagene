# 📋 Resumo da Correção - Bug do Dropdown Inconsistente

## 🐛 Bug Original

**Sintoma:** Receptora já selecionada continuava aparecendo no dropdown de forma inconsistente (às vezes sumia como deveria, às vezes não).

**Comportamento Observado:**
1. Selecionar e adicionar Receptora A
2. Ao abrir seletor para adicionar outra, A ainda aparece como opção disponível
3. Se tenta adicionar A de novo, não funciona (dedupe existe)
4. Em alguns casos, ao adicionar outra receptora, A SOME do dropdown, mas SEMPRE permanece na lista de selecionadas

**Causa Raiz Identificada:**
- State separado `receptorasDisponiveis` que podia ficar desatualizado
- Função `loadReceptorasDisponiveis()` assíncrona com possível race condition
- Falta de sincronização entre `receptorasLocais` (selecionadas) e lista disponível
- SelectContent do Radix não re-renderizava quando selecionadas mudavam (cache)
- Possível inconsistência de tipos (UUID como string vs number)

---

## ✅ Correção Implementada

### Mudanças Principais:

#### 1. **Removido State Separado de Disponíveis**

**Antes:**
```typescript
const [receptorasDisponiveis, setReceptorasDisponiveis] = useState<Receptora[]>([]);
```

**Depois:**
- State único: `allReceptoras` (todas as receptoras VAZIAS da fazenda)
- Cálculo derivado: `availableReceptoras` (calculado sempre a partir de `allReceptoras` e `selectedIds`)

#### 2. **Fonte de Verdade Única**

**Estado:**
- `allReceptoras`: Todas as receptoras VAZIAS da fazenda (carregadas do banco)
- `receptorasLocais`: Receptoras selecionadas (fonte de verdade da seleção)

**Cálculo Derivado:**
```typescript
// IDs normalizados como string (fonte de verdade)
const selectedIds = useMemo(() => {
  return new Set(
    receptorasLocais
      .filter(r => r.id && r.id.trim() !== '' && r.id !== null && r.id !== undefined)
      .map(r => String(r.id!).trim())
  );
}, [receptorasLocais]);

// Disponíveis = todas - selecionadas (SEMPRE calculado, nunca state)
const availableReceptoras = useMemo(() => {
  return allReceptoras.filter(r => {
    const receptoraId = r.id ? String(r.id).trim() : '';
    return receptoraId !== '' && !selectedIds.has(receptoraId);
  });
}, [allReceptoras, selectedIds]);
```

#### 3. **Normalização de IDs**

Todos os IDs são normalizados para string e trim antes de comparação:
- `String(r.id).trim()` sempre usado
- Set de IDs sempre contém strings normalizadas
- Comparações sempre consistentes

#### 4. **Key no SelectContent para Forçar Re-render**

```typescript
const selectContentKey = useMemo(() => {
  const idsArray = Array.from(selectedIds).sort();
  return idsArray.length > 0 ? idsArray.join('|') : 'empty';
}, [receptorasLocais]);

// No JSX:
<SelectContent key={selectContentKey}>
  {/* items */}
</SelectContent>
```

Isso força o Radix Select a re-renderizar o conteúdo quando `receptorasLocais` muda.

#### 5. **Função `loadAllReceptoras()` Simplificada**

**Antes:** `loadReceptorasDisponiveis()` calculava disponíveis dentro da função assíncrona

**Depois:** `loadAllReceptoras()` apenas carrega todas as receptoras VAZIAS do banco. O cálculo de disponíveis é feito de forma derivada e síncrona.

#### 6. **Sem Refetch Desnecessário**

**Antes:** Após adicionar receptora, chamava `loadReceptorasDisponiveis()` novamente

**Depois:** Não refaz fetch - o cálculo derivado já remove da lista disponível automaticamente.

---

## 📁 Arquivo Alterado

**`src/pages/ProtocoloFormWizard.tsx`**

**Mudanças:**
1. **Import:** Adicionado `useMemo` do React
2. **States:**
   - Removido: `receptorasDisponiveis`
   - Adicionado: `allReceptoras`, `loadingReceptoras`
3. **Funções:**
   - Removida: `loadReceptorasDisponiveis()`
   - Adicionada: `loadAllReceptoras()`
   - Refatorada: `handleAddReceptora()` (busca em `allReceptoras`, não precisa refetch)
   - Simplificada: `handleRemoveReceptora()` (não precisa refetch)
4. **Cálculos Derivados:**
   - `selectedIds` (useMemo)
   - `availableReceptoras` (useMemo)
   - `selectContentKey` (useMemo)
5. **JSX:**
   - Select usa `availableReceptoras` (derivado)
   - SelectContent tem `key={selectContentKey}` para forçar re-render
   - Normalização de IDs no value e na comparação

---

## 🔧 Detalhes Técnicos

### Normalização de IDs

```typescript
// Sempre normalizar antes de comparar
const receptoraId = r.id ? String(r.id).trim() : '';
if (!receptoraId) return null; // Skip invalid IDs

// Set sempre contém strings normalizadas
const selectedIdsSet = new Set(ids.map(id => String(id).trim()));
```

### Cálculo Derivado Determinístico

```typescript
// useMemo garante que só recalcula quando dependências mudam
const availableReceptoras = useMemo(() => {
  return allReceptoras.filter(r => {
    const receptoraId = r.id ? String(r.id).trim() : '';
    return receptoraId !== '' && !selectedIds.has(receptoraId);
  });
}, [allReceptoras, selectedIds]); // Dependências explícitas
```

### Key para Forçar Re-render

```typescript
// Key muda sempre que receptorasLocais muda
const selectContentKey = useMemo(() => {
  const idsArray = Array.from(selectedIds).sort();
  return idsArray.length > 0 ? idsArray.join('|') : 'empty';
}, [receptorasLocais]); // Depende de receptorasLocais, não selectedIds (que é derivado)
```

---

## ✅ Critérios de Aceite Atendidos

- [x] Receptora selecionada **SEMPRE** some do dropdown imediatamente
- [x] Dropdown é **determinístico**: mesmas entradas => mesmas opções
- [x] Não permite duplicidade por id
- [x] Depois de adicionar, Select é limpo (placeholder)
- [x] UI sempre consistente

---

## 🧪 Testes

Siga o checklist em `CHECKLIST_TESTES_BUG_DROPDOWN.md` para validar todas as correções.

---

## 📝 Observações

1. **Performance:** `useMemo` garante que cálculo só acontece quando necessário
2. **Type Safety:** Normalização garante comparações consistentes
3. **UX:** Key no SelectContent força re-render imediato (sem delay visual)
4. **Manutenibilidade:** Uma única fonte de verdade (`allReceptoras` e `receptorasLocais`)

---

**Data da Correção:** 2026-01-08

**Status:** ✅ Corrigido e Pronto para Teste
