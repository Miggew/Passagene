# Notas da Sessão Claude - 28/01/2026

## Contexto do Projeto
Sistema de gestão de FIV (Fertilização In Vitro) para gado. O "Hub Campo" contém módulos de DG (Diagnóstico de Gestação) e Sexagem Fetal.

---

## Páginas Refatoradas

### DiagnosticoGestacao.tsx
- Interface compacta: barra superior com Vet | Téc | Fazenda | Lote TE | Salvar
- Removido botão "Iniciar Sessão" - fluxo direto
- Tabela de receptoras mais compacta

### Sexagem.tsx
- Mesma interface compacta do DG
- Mesma lógica de fluxo

---

## Mudanças Principais

### 1. Interface Compacta
- Campos vet/tec em inputs pequenos na barra superior
- Selects de Fazenda e Lote TE inline
- Botão Salvar na mesma linha
- Fazenda desabilitada até preencher veterinário
- Lote desabilitado até selecionar fazenda

### 2. Validação
- Apenas veterinário é obrigatório (técnico é opcional)
- Alterado em: `src/lib/gestacao.ts` função `validarResponsaveis()`

### 3. Otimização de Performance
- Updates de diagnósticos em paralelo (Promise.all)
- Updates de status de receptoras em batch (um UPDATE com IN ao invés de vários)
- Reload de fazendas/lotes em background (sem await)

### 4. Correção de Filtros
- Hook `useFazendasComLotes`: só mostra fazendas com receptoras do status correto E com TEs realizadas
- Hook `useLotesTE`: simplificado, não filtra mais por tipo_diagnostico
- Sexagem: filtro corrigido para apenas PRENHE/PRENHE_RETOQUE (não incluir PRENHE_FEMEA, etc)

### 5. Fluxo Após Salvar
- Limpa seleção de lote se fechou
- Recarrega fazendas e lotes em background
- Campos vet/tec sempre editáveis (para fazer outro lote)

---

## Regras de Negócio Importantes

### Diagnóstico de Gestação (DG)
- Pode ser feito a partir de **27 dias** após a fecundação do embrião
- Receptoras com status `SERVIDA`
- Resultados: PRENHE, VAZIA, RETOQUE

### Sexagem Fetal
- Pode ser feita a partir de **54 dias** após a fecundação do embrião
- Receptoras com status `PRENHE` ou `PRENHE_RETOQUE`
- Após sexagem, status muda para: PRENHE_FEMEA, PRENHE_MACHO, PRENHE_SEM_SEXO, PRENHE_2_SEXOS ou VAZIA
- Sexagem pode ser feita sem DG prévio (desde que tenha 54+ dias)

### Cálculo de Dias de Gestação
- D0 = `data_abertura` do lote FIV (data da fecundação)
- Dias = diferença entre hoje e D0

---

## Pendente / Próximos Passos

### 1. Implementar Regra dos Dias Mínimos ✅ CONCLUÍDO
- [x] DG: Avisar lotes com menos de 27 dias de gestação
- [x] Sexagem: Avisar lotes com menos de 54 dias de gestação
- [x] Mostrar lotes com aviso visual (não esconder)
- [x] Bloquear botão Salvar quando dias insuficientes
- [x] Mostrar dias de gestação no dropdown de lotes

### 2. Testar
- [ ] Confirmar que lote de sexagem some após salvar (verificar console para logs de status)
- [ ] Testar DG completo quando tiver dados
- [ ] Testar aviso de dias mínimos em DG e Sexagem

---

## Arquivos Modificados

```
src/pages/DiagnosticoGestacao.tsx  - Interface refatorada + aviso dias mínimos
src/pages/Sexagem.tsx              - Interface refatorada + aviso dias mínimos
src/hooks/loteTE/useFazendasComLotes.ts - Filtro simplificado
src/hooks/loteTE/useLotesTE.ts     - Filtro simplificado + cálculo dias gestação
src/hooks/loteTE/index.ts          - Exports atualizados
src/lib/gestacao.ts                - validarResponsaveis() + DIAS_MINIMOS + LoteTEBase atualizado
```

### Implementação Dias Mínimos (28/01/2026)

**Constantes adicionadas em `gestacao.ts`:**
```typescript
export const DIAS_MINIMOS = {
  DG: 27,      // Diagnóstico de Gestação
  SEXAGEM: 54, // Sexagem Fetal
};
```

**Comportamento:**
1. O hook `useLotesTE` agora calcula `dias_gestacao` para cada lote
2. No dropdown de lotes, mostra: `DD/MM/YYYY • XXd • N rec.`
3. Lotes com dias insuficientes aparecem em amarelo com ⚠️
4. Ao selecionar lote com dias insuficientes, mostra aviso detalhado
5. Botão Salvar fica desabilitado enquanto dias < mínimo

---

## Problemas Resolvidos

1. **Erro 400 na query** - Coluna `tipo_diagnostico` ou relacionamento com `receptoras` não existia
2. **Erro "column fazenda_atual_id does not exist"** - Usava coluna inexistente, corrigido para usar view
3. **Fazendas não apareciam** - Hook muito restritivo, simplificado
4. **Lotes não apareciam** - Mesmo problema, simplificado
5. **Campo vet travava após fechar lote** - Removido disabled
6. **Lote repetia após salvar** - Filtro incluía status pós-sexagem, corrigido
7. **Salvamento lento** - Otimizado com batch updates e Promise.all

---

## Como Continuar na Próxima Sessão

Peça para o Claude ler este arquivo:
```
Leia o arquivo CLAUDE_SESSION_NOTES.md para contexto da última sessão
```

Depois continue de onde parou, por exemplo:
```
Vamos implementar a regra dos dias mínimos (27 para DG, 54 para Sexagem)
```
