# Checklist de Schema (Sem Executar SQL)

Este checklist serve para validar se o banco está compatível com o app sem executar scripts de migração.

## 1) Conexão e ambiente
- [ ] Projeto Supabase correto selecionado
- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` conferidos (ou usando defaults do app)

## 1.1) Roteiro operacional (sem SQL)
- [ ] Abrir o projeto Supabase correto e confirmar ambiente
- [ ] Validar variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## 2) Tabelas essenciais (existem e com colunas básicas)
- [ ] `clientes`
- [ ] `fazendas`
- [ ] `doadoras`
- [ ] `receptoras`
- [ ] `protocolos_sincronizacao`
- [ ] `protocolo_receptoras`
- [ ] `pacotes_aspiracao`
- [ ] `pacotes_aspiracao_fazendas_destino`
- [ ] `aspiracoes_doadoras`
- [ ] `lotes_fiv`
- [ ] `lote_fiv_acasalamentos`
- [ ] `lote_fiv_fazendas_destino`
- [ ] `embrioes`
- [ ] `historico_embrioes`
- [ ] `doses_semen`
- [ ] `touros`
- [ ] `transferencias_embrioes`
- [ ] `diagnosticos_gestacao`
- [ ] `pacotes_embrioes`
- [ ] `receptora_fazenda_historico`

## 3) Views usadas pelo app
- [ ] `vw_receptoras_fazenda_atual`
- [ ] `v_protocolo_receptoras_status`
- [ ] `v_tentativas_te_status`

## 3.1) Mapa rápido de uso no app (não remover sem validar)
- `Transferência de Embriões`: `transferencias_embrioes`, `embrioes`, `lotes_fiv`, `pacotes_aspiracao`, `pacotes_aspiracao_fazendas_destino`, `protocolo_receptoras`, `protocolos_sincronizacao`, `vw_receptoras_fazenda_atual`, `v_protocolo_receptoras_status`, `v_tentativas_te_status`, `pacotes_embrioes` (restauro de sessão)
- `Embriões/Estoque`: `embrioes`, `historico_embrioes`, `lotes_fiv`, `lote_fiv_acasalamentos`, `aspiracoes_doadoras`, `doadoras`, `doses_semen`, `pacotes_aspiracao`, `pacotes_aspiracao_fazendas_destino`, `fazendas`, `clientes`
- `Lotes FIV`: `lotes_fiv`, `lote_fiv_acasalamentos`, `lote_fiv_fazendas_destino`, `embrioes`, `pacotes_aspiracao`, `aspiracoes_doadoras`, `doadoras`, `doses_semen`, `fazendas`, `clientes`
- `Protocolos`: `protocolos_sincronizacao`, `protocolo_receptoras`, `receptoras`, `fazendas`, `receptora_fazenda_historico`
- `Diagnóstico/Sexagem`: `diagnosticos_gestacao` + `receptoras`/`fazendas`

## 4) Campos críticos (verificar via Table Editor)
- [ ] `protocolos_sincronizacao.passo2_data`
- [ ] `protocolos_sincronizacao.passo2_tecnico_responsavel`
- [ ] `transferencias_embrioes.data_te`
- [ ] `embrioes.status_atual`
- [ ] `lotes_fiv.disponivel_para_transferencia`

## 5) Smoke de leitura (sem alteração)
- [ ] Listar `clientes` e `fazendas` no Table Editor
- [ ] Abrir `protocolos_sincronizacao` e `protocolo_receptoras`
- [ ] Abrir `lotes_fiv` e `embrioes`
- [ ] Verificar views (`vw_receptoras_fazenda_atual`, `v_protocolo_receptoras_status`)

## 5.1) Smoke de leitura das views
- [ ] Abrir `vw_receptoras_fazenda_atual` e confirmar retorno (mesmo que 0 rows)
- [ ] Abrir `v_protocolo_receptoras_status` e confirmar retorno
- [ ] Abrir `v_tentativas_te_status` e confirmar retorno

## 6) Campos legacy (marcar para revisão futura)
- [ ] `pacotes_aspiracao.fazenda_destino_id` (se já usa `pacotes_aspiracao_fazendas_destino`)
- [ ] Outros campos não usados, conforme “Mapa rápido de uso”

## 6) Backup e auditoria (se for executar migrações no futuro)
- [ ] Exportar tabelas críticas antes de mudanças de schema
- [ ] Anotar alterações planejadas e dependências no app

## 6.1) Backup mínimo recomendado
- [ ] Exportar CSV de `embrioes`
- [ ] Exportar CSV de `lotes_fiv`
- [ ] Exportar CSV de `protocolos_sincronizacao`
- [ ] Exportar CSV de `protocolo_receptoras`
- [ ] Exportar CSV de `transferencias_embrioes`
- [ ] Exportar CSV de `pacotes_aspiracao`
