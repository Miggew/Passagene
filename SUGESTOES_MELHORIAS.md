# Sugestões de Melhorias - PassaGene

## 📋 Resumo Executivo

Este documento lista sugestões de melhorias para tornar o código mais eficiente, manutenível e escalável.

---

## 🚀 1. Hooks Customizados para Queries Comuns

### Problema Atual
Queries para carregar fazendas, receptoras e outras entidades são duplicadas em múltiplos componentes.

### Solução
Criar hooks customizados usando React Query (já está no projeto) para queries comuns:

```typescript
// src/hooks/use-fazendas.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';

export function useFazendas() {
  return useQuery({
    queryKey: ['fazendas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

// src/hooks/use-receptoras-fazenda.ts
export function useReceptorasFazenda(fazendaId: string | null) {
  return useQuery({
    queryKey: ['receptoras-fazenda', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return [];
      
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;
      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) return [];

      const { data, error } = await supabase
        .from('receptoras')
        .select('*')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!fazendaId,
  });
}
```

**Benefícios:**
- ✅ Cache automático (React Query)
- ✅ Refetch automático
- ✅ Loading/error states centralizados
- ✅ Menos código duplicado
- ✅ Melhor performance (evita queries duplicadas)

---

## 🎯 2. Remover Fallbacks Desnecessários

### Problema Atual
Código mantém fallback para `fazenda_atual_id` "durante transição", mas a transição já foi completada.

### Solução
Remover todos os fallbacks e usar apenas `vw_receptoras_fazenda_atual`:

```typescript
// ❌ ANTES (com fallback desnecessário)
if (receptoraIds.length === 0) {
  // Fallback: buscar diretamente da tabela receptoras (durante transição)
  const { data, error } = await supabase
    .from('receptoras')
    .select('*')
    .eq('fazenda_atual_id', fazendaId);
  // ...
}

// ✅ DEPOIS (sem fallback)
const { data: viewData, error: viewError } = await supabase
  .from('vw_receptoras_fazenda_atual')
  .select('receptora_id, fazenda_nome_atual')
  .eq('fazenda_id_atual', fazendaId);

if (viewError) throw viewError;
const receptoraIds = viewData?.map(v => v.receptora_id) || [];

if (receptoraIds.length === 0) return [];

const { data, error } = await supabase
  .from('receptoras')
  .select('*')
  .in('id', receptoraIds)
  .order('identificacao', { ascending: true });
```

**Arquivos a atualizar:**
- `src/pages/Receptoras.tsx` (linha 142-179)
- `src/pages/ProtocoloFormWizard.tsx` (linha 146-167)
- `src/pages/ProtocoloDetail.tsx` (linha 183-200)
- Remover `fazenda_atual_id` ao criar receptoras (linha 236, 326, 501)

---

## ⚡ 3. Otimizar Cálculo de Status de Receptoras

### Problema Atual
`calcularStatusReceptora` é chamado múltiplas vezes em loops, causando N queries.

### Solução
Já existe `calcularStatusReceptoras` (batch), mas pode ser otimizado com uma única query:

```typescript
// src/lib/receptoraStatus.ts - MELHORIA
export async function calcularStatusReceptorasBatch(receptoraIds: string[]): Promise<Map<string, string>> {
  if (receptoraIds.length === 0) return new Map();

  // 1. Buscar todas as tentativas de uma vez
  const { data: tentativas } = await supabase
    .from('v_tentativas_te_status')
    .select('receptora_id, status_tentativa, data_te')
    .in('receptora_id', receptoraIds)
    .order('data_te', { ascending: false });

  // 2. Buscar todos os protocolo_receptoras de uma vez
  const { data: protocoloReceptoras } = await supabase
    .from('protocolo_receptoras')
    .select('receptora_id, status, protocolo_id')
    .in('receptora_id', receptoraIds);

  // 3. Buscar todos os protocolos de uma vez
  const protocoloIds = [...new Set(protocoloReceptoras?.map(pr => pr.protocolo_id) || [])];
  const { data: protocolos } = await supabase
    .from('protocolos_sincronizacao')
    .select('id, status')
    .in('id', protocoloIds);

  // 4. Processar em memória
  const statusMap = new Map<string, string>();
  const protocoloStatusMap = new Map(protocolos?.map(p => [p.id, p.status]) || []);
  
  // Agrupar tentativas por receptora (mais recente)
  const tentativasPorReceptora = new Map<string, any>();
  tentativas?.forEach(t => {
    if (!tentativasPorReceptora.has(t.receptora_id)) {
      tentativasPorReceptora.set(t.receptora_id, t);
    }
  });

  receptoraIds.forEach(id => {
    // Verificar tentativa mais recente
    const tentativa = tentativasPorReceptora.get(id);
    if (tentativa) {
      const statusMapLocal = {
        'PRENHE_FEMEA': 'PRENHE (FÊMEA)',
        'PRENHE_MACHO': 'PRENHE (MACHO)',
        'PRENHE_SEM_SEXO': 'PRENHE (SEM SEXO)',
        'PRENHE': 'PRENHE',
        'VAZIA': 'VAZIA',
        'RETOQUE': 'SERVIDA',
        'SEM_DIAGNOSTICO': 'SERVIDA',
      };
      if (statusMapLocal[tentativa.status_tentativa]) {
        statusMap.set(id, statusMapLocal[tentativa.status_tentativa]);
        return;
      }
    }

    // Verificar protocolos ativos
    const prs = protocoloReceptoras?.filter(pr => pr.receptora_id === id) || [];
    const protocolosAtivos = prs.filter(pr => {
      const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
      return protocoloStatus !== 'PASSO2_FECHADO' && 
             (pr.status === 'APTA' || pr.status === 'INICIADA');
    });

    if (protocolosAtivos.length > 0) {
      statusMap.set(id, protocolosAtivos.some(pr => pr.status === 'APTA') 
        ? 'SINCRONIZADA' 
        : 'EM SINCRONIZAÇÃO');
      return;
    }

    statusMap.set(id, 'VAZIA');
  });

  return statusMap;
}
```

**Benefícios:**
- ✅ 3 queries ao invés de N queries
- ✅ Muito mais rápido para listas grandes
- ✅ Menos carga no banco

---

## 🔧 4. Utility Functions para Error Handling

### Problema Atual
Tratamento de erro repetido em múltiplos lugares.

### Solução
Criar funções utilitárias:

```typescript
// src/lib/error-handler.ts
import { toast } from '@/hooks/use-toast';

export function handleError(error: unknown, defaultMessage: string) {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  
  // Mensagens específicas para erros comuns
  if (errorMessage.includes('RLS') || errorMessage.includes('policy')) {
    toast({
      title: 'Erro de permissão',
      description: 'RLS está bloqueando a operação. Configure políticas no Supabase.',
      variant: 'destructive',
    });
    return;
  }

  if (errorMessage.includes('23505')) {
    // Duplicate key
    toast({
      title: 'Registro duplicado',
      description: 'Já existe um registro com esses dados.',
      variant: 'destructive',
    });
    return;
  }

  toast({
    title: 'Erro',
    description: errorMessage,
    variant: 'destructive',
  });
}

// Uso:
// ❌ ANTES
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
  toast({
    title: 'Erro ao salvar',
    description: errorMessage.includes('RLS') || errorMessage.includes('policy')
      ? 'RLS está bloqueando escrita...'
      : errorMessage,
    variant: 'destructive',
  });
}

// ✅ DEPOIS
catch (error) {
  handleError(error, 'Erro ao salvar');
}
```

---

## 📊 5. Otimizar ProtocoloDetail.tsx (N+1 Query)

### Problema Atual
Loop fazendo query individual para cada receptora:

```typescript
// ❌ ANTES - N+1 queries
for (const pr of prData || []) {
  const { data: receptoraData } = await supabase
    .from('receptoras')
    .select('*')
    .eq('id', pr.receptora_id)
    .single();
  // ...
}
```

### Solução
Fazer query única:

```typescript
// ✅ DEPOIS - 1 query
const receptoraIds = prData?.map(pr => pr.receptora_id) || [];

const { data: receptorasData, error: receptorasError } = await supabase
  .from('receptoras')
  .select('*')
  .in('id', receptoraIds);

if (receptorasError) throw receptorasError;

const receptorasMap = new Map(receptorasData?.map(r => [r.id, r]) || []);

const receptorasWithStatus: ReceptoraWithStatus[] = (prData || []).map(pr => ({
  ...receptorasMap.get(pr.receptora_id),
  pr_id: pr.id,
  pr_status: pr.status,
  pr_motivo_inapta: pr.motivo_inapta,
  pr_observacoes: pr.observacoes,
})).filter(r => r.id); // Remove se receptora não foi encontrada
```

---

## 🎨 6. Constantes para Mensagens e Validações

### Problema Atual
Strings hardcoded e validações repetidas.

### Solução
Centralizar em constantes:

```typescript
// src/lib/constants.ts
export const ERROR_MESSAGES = {
  RLS_BLOCKED: 'RLS está bloqueando a operação. Configure políticas no Supabase.',
  DUPLICATE_KEY: 'Já existe um registro com esses dados.',
  NOT_FOUND: 'Registro não encontrado.',
  VALIDATION_REQUIRED: (field: string) => `${field} é obrigatório`,
} as const;

export const STATUS_LABELS = {
  'VAZIA': 'Vazia',
  'EM SINCRONIZAÇÃO': 'Em Sincronização',
  'SINCRONIZADA': 'Sincronizada',
  'SERVIDA': 'Servida',
  'PRENHE': 'Prenhe',
  // ...
} as const;

export const VALIDATION_RULES = {
  REQUIRED_FIELDS: {
    cliente: ['nome'],
    fazenda: ['cliente_id', 'nome'],
    receptora: ['identificacao'],
  },
} as const;
```

---

## 📦 7. Criar RPC para Cálculo de Status (Opcional)

### Problema Atual
Cálculo de status é feito no frontend, fazendo múltiplas queries.

### Solução
Criar RPC no banco para calcular status de múltiplas receptoras:

```sql
-- criar_rpc_calcular_status_receptoras.sql
CREATE OR REPLACE FUNCTION calcular_status_receptoras(p_receptora_ids UUID[])
RETURNS TABLE (
  receptora_id UUID,
  status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH tentativas_recentes AS (
    SELECT DISTINCT ON (receptora_id)
      receptora_id,
      status_tentativa
    FROM v_tentativas_te_status
    WHERE receptora_id = ANY(p_receptora_ids)
    ORDER BY receptora_id, data_te DESC
  ),
  protocolos_ativos AS (
    SELECT DISTINCT pr.receptora_id, pr.status, ps.status as protocolo_status
    FROM protocolo_receptoras pr
    JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
    WHERE pr.receptora_id = ANY(p_receptora_ids)
      AND ps.status != 'PASSO2_FECHADO'
      AND pr.status IN ('APTA', 'INICIADA')
  )
  SELECT 
    r.id,
    CASE
      WHEN tr.status_tentativa IN ('PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE') 
        THEN 'PRENHE'
      WHEN tr.status_tentativa = 'VAZIA' THEN 'VAZIA'
      WHEN tr.status_tentativa IN ('RETOQUE', 'SEM_DIAGNOSTICO') THEN 'SERVIDA'
      WHEN pa.status = 'APTA' THEN 'SINCRONIZADA'
      WHEN pa.status = 'INICIADA' THEN 'EM SINCRONIZAÇÃO'
      ELSE 'VAZIA'
    END as status
  FROM unnest(p_receptora_ids) as r(id)
  LEFT JOIN tentativas_recentes tr ON tr.receptora_id = r.id
  LEFT JOIN protocolos_ativos pa ON pa.receptora_id = r.id;
END;
$$;
```

**Benefícios:**
- ✅ 1 query ao invés de múltiplas
- ✅ Processamento no banco (mais rápido)
- ✅ Menos código no frontend

---

## 🧹 8. Limpeza de Código

### Remover
1. **Fallbacks desnecessários** (já mencionado)
2. **Comentários obsoletos** sobre "transição"
3. **Código duplicado de validação**
4. **Console.log de debug** em produção

### Organizar
1. **Agrupar imports** (React, libs, components, types)
2. **Extrair lógica complexa** para funções separadas
3. **Usar early returns** para reduzir nesting

---

## 📈 Priorização

### Alta Prioridade (Impacto Imediato)
1. ✅ Remover fallbacks desnecessários
2. ✅ Otimizar ProtocoloDetail.tsx (N+1 query)
3. ✅ Melhorar cálculo de status (batch queries)

### Média Prioridade (Manutenibilidade)
4. ✅ Criar hooks customizados
5. ✅ Utility functions para error handling
6. ✅ Constantes para mensagens

### Baixa Prioridade (Otimização Avançada)
7. ✅ RPC para cálculo de status
8. ✅ Refatoração adicional

---

## 🎯 Próximos Passos

1. Começar removendo fallbacks (rápido e seguro)
2. Otimizar ProtocoloDetail.tsx (grande ganho de performance)
3. Criar hooks para fazendas e receptoras (melhora reusabilidade)
4. Implementar melhorias de erro handling (melhora UX)
5. Considerar RPC de status (otimização avançada)
