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

**Views usadas no app**
- `vw_receptoras_fazenda_atual`
- `v_protocolo_receptoras_status`
- `v_tentativas_te_status`

## Observação
- Todos os SQLs e docs antigos foram removidos da raiz. Este arquivo é a nova referência mínima.
