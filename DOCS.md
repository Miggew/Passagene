# Docs Enxutos

## Fluxos Principais do App

### Clientes
- **Rotas**: `/clientes`, `/clientes/novo`, `/clientes/:id`, `/clientes/:id/editar`
- **Objetivo**: cadastro e manutenção de clientes.
- **Tabelas**: `clientes`

### Fazendas
- **Rotas**: `/fazendas`, `/fazendas/:id`
- **Objetivo**: visualizar fazendas e relação com clientes.
- **Tabelas**: `fazendas`

### Doadoras
- **Rotas**: `/doadoras`, `/doadoras/:id`
- **Objetivo**: cadastro e histórico de doadoras.
- **Tabelas**: `doadoras`, `aspiracoes_doadoras`

### Receptoras
- **Rotas**: `/receptoras`, `/receptoras/:id/historico`
- **Objetivo**: gerenciamento e histórico de receptoras.
- **Tabelas**: `receptoras`, `receptora_fazenda_historico`, `protocolo_receptoras`, `diagnosticos_gestacao`, `transferencias_embrioes`
- **Views**: `vw_receptoras_fazenda_atual`

### Protocolos
- **Rotas**: `/protocolos`, `/protocolos/novo`, `/protocolos/:id`, `/protocolos/:id/passo2`, `/protocolos/:id/relatorio`, `/protocolos/fechados/:id/relatorio`
- **Objetivo**: criação e fechamento de protocolos, Passo 2 e relatório.
- **Tabelas**: `protocolos_sincronizacao`, `protocolo_receptoras`
- **Views**: `v_protocolo_receptoras_status`, `v_tentativas_te_status`

### Aspirações
- **Rotas**: `/aspiracoes`, `/aspiracoes/novo`, `/aspiracoes/:id`
- **Objetivo**: pacotes de aspiração e destino.
- **Tabelas**: `pacotes_aspiracao`, `pacotes_aspiracao_fazendas_destino`, `aspiracoes_doadoras`

### Touros e Doses de Sêmen
- **Rotas**: `/touros`, `/touros/:id`, `/doses-semen`
- **Objetivo**: cadastro de touros e controle de doses.
- **Tabelas**: `touros`, `doses_semen`

### Lotes FIV
- **Rotas**: `/lotes-fiv`, `/lotes-fiv/:id`
- **Objetivo**: criação e acompanhamento de lotes FIV.
- **Tabelas**: `lotes_fiv`, `lote_fiv_acasalamentos`, `lote_fiv_fazendas_destino`, `aspiracoes_doadoras`, `doses_semen`, `pacotes_aspiracao`

### Embriões
- **Rotas**: `/embrioes`
- **Objetivo**: gestão de embriões, congelamento e destino.
- **Tabelas**: `embrioes`, `historico_embrioes`, `lotes_fiv`

### Transferência de Embriões (TE)
- **Rotas**: `/transferencia`
- **Objetivo**: transferências e status por receptora.
- **Tabelas**: `transferencias_embrioes`, `protocolo_receptoras`, `embrioes`, `pacotes_embrioes`
- **Views**: `v_protocolo_receptoras_status`, `vw_receptoras_fazenda_atual`

### Diagnóstico de Gestação
- **Rotas**: `/dg`
- **Objetivo**: registrar diagnósticos.
- **Tabelas**: `diagnosticos_gestacao`

### Sexagem
- **Rotas**: `/sexagem`
- **Objetivo**: registrar sexagem ligada a lotes/embriões.
- **Tabelas**: `lotes_fiv`, `embrioes`

## Banco de Dados (Essencial)

### Supabase
- Configuração em `src/lib/supabase.ts`.
- Variáveis de ambiente (opcional): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Caso não definidas, o app usa valores padrão definidos no arquivo.

### Conexão rápida
- A função `testSupabaseConnection()` testa acesso básico pela tabela `clientes`.

### Dependências mínimas

**Tabelas principais**
- `clientes`, `fazendas`, `doadoras`, `receptoras`
- `protocolos_sincronizacao`, `protocolo_receptoras`
- `pacotes_aspiracao`, `pacotes_aspiracao_fazendas_destino`, `aspiracoes_doadoras`
- `lotes_fiv`, `lote_fiv_acasalamentos`, `lote_fiv_fazendas_destino`
- `embrioes`, `historico_embrioes`
- `doses_semen`, `touros`
- `transferencias_embrioes`, `diagnosticos_gestacao`, `pacotes_embrioes`
- `receptora_fazenda_historico`
- `receptoras_cio_livre`, `animais`

**Views usadas no app**
- `vw_receptoras_fazenda_atual`
- `v_protocolo_receptoras_status`
- `v_tentativas_te_status`
- `v_embrioes_disponiveis_te`

### Extensões recentes (SQL necessário)

**Receptoras em cio livre (sincronização manual para TE)**
```sql
create table if not exists public.receptoras_cio_livre (
  id uuid primary key default gen_random_uuid(),
  receptora_id uuid not null references public.receptoras(id),
  fazenda_id uuid not null references public.fazendas(id),
  data_cio date not null,
  observacoes text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
```

**Cópia de receptora para Cio Livre (proteção contra erro humano)**
```sql
alter table public.receptoras
  add column if not exists receptora_origem_id uuid references public.receptoras(id),
  add column if not exists is_cio_livre boolean not null default false,
  add column if not exists status_cio_livre text,
  add column if not exists codigo_cio_livre text;

create index if not exists idx_receptoras_origem_cio_livre
  on public.receptoras(receptora_origem_id);
```

**Animais (nascimentos)**
```sql
create table if not exists public.animais (
  id uuid primary key default gen_random_uuid(),
  embriao_id uuid references public.embrioes(id),
  receptora_id uuid references public.receptoras(id),
  fazenda_id uuid references public.fazendas(id),
  cliente_id uuid references public.clientes(id),
  data_nascimento date not null,
  sexo text not null,
  raca text,
  pai_nome text,
  mae_nome text,
  observacoes text,
  created_at timestamptz not null default now()
);
```

**Descartar embriões D9 (automático)**
```sql
create or replace function public.descartar_embrioes_d9()
returns void
language plpgsql
as $$
begin
  update public.embrioes
  set status_atual = 'DESCARTADO',
      data_descarte = current_date
  where status_atual = 'FRESCO'
    and id in (
      select embriao_id
      from public.v_embrioes_disponiveis_te
      where d8_limite is not null
        and d8_limite < current_date
    )
    and id not in (
      select embriao_id
      from public.transferencias_embrioes
      where status_te = 'REALIZADA'
    );
end;
$$;
```

**Agendar execução diária (pg_cron)**
```sql
-- requer extensão pg_cron habilitada no Supabase
select cron.schedule(
  'descartar_embrioes_d9_diario',
  '0 2 * * *',
  $$select public.descartar_embrioes_d9();$$
);
```

> Regra oficial: D9 baseado na data do lote/aspiração (via `v_embrioes_disponiveis_te`), não no `created_at` do embrião.

## Observação
- Todos os SQLs e docs antigos foram removidos da raiz. Este arquivo é a nova referência mínima.
