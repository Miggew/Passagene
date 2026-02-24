# PassaGene - Documentação Técnica Completa

> **Sistema de Gestão de FIV (Fertilização In Vitro) para Gado Bovino**
> Documento gerado em: 2026-02-14
> Propósito: Avaliação detalhada para melhorias e detecção de erros

---

## ÍNDICE

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Banco de Dados (Schema Completo)](#4-banco-de-dados)
5. [Sistema de Autenticação e Permissões](#5-autenticação-e-permissões)
6. [Rotas e Navegação](#6-rotas-e-navegação)
7. [Módulos de Negócio (Páginas)](#7-módulos-de-negócio)
8. [Hooks e Camada de Dados](#8-hooks-e-camada-de-dados)
9. [Componentes Compartilhados](#9-componentes-compartilhados)
10. [Edge Functions e Serviços Serverless](#10-edge-functions-e-serviços-serverless)
11. [EmbryoScore (Sistema de IA)](#11-embryoscore)
12. [Regras de Negócio Críticas](#12-regras-de-negócio-críticas)
13. [Padrões de Design e UI](#13-padrões-de-design)
14. [Infraestrutura e Deploy](#14-infraestrutura)
15. [Mapa de Dependências](#15-dependências)

---

## 1. VISÃO GERAL DO SISTEMA

PassaGene é um sistema completo de gestão de FIV (Fertilização In Vitro) para gado bovino. Cobre todo o fluxo reprodutivo:

```
Cadastro (Clientes/Fazendas/Doadoras/Receptoras/Touros)
  → Protocolo de Sincronização (receptoras)
  → Aspiração de Oócitos (doadoras)
  → Lote FIV (acasalamentos doadora×touro)
  → Classificação de Embriões (+ EmbryoScore IA)
  → Transferência de Embriões (TE)
  → Diagnóstico de Gestação (DG, 27+ dias)
  → Sexagem (54+ dias)
  → Nascimento (registro de cria)
```

### Métricas do Projeto
| Métrica | Valor |
|---------|-------|
| Arquivos TypeScript/JavaScript | 315 |
| Páginas (componentes de rota) | 45 |
| Componentes reutilizáveis | 215+ |
| Hooks customizados | 70+ |
| Tabelas no banco | 31 |
| Views | 4+ |
| Edge Functions | 3 |
| Migrações SQL | 13 |

---

## 2. STACK TECNOLÓGICO

### Frontend
| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| React | 19.1.1 | Framework UI |
| Vite | 5.4.1 | Build tool + dev server |
| TypeScript | 5.5.3 | Tipagem estática |
| Tailwind CSS | 3.4.11 | Estilização utility-first |
| TanStack Query | 5.56.2 | Cache e estado de servidor |
| React Router | 6.26.2 | Roteamento (HashRouter) |
| React Hook Form | 7.53.0 | Formulários |
| Zod | 4.3.6 | Validação de schemas |
| shadcn/ui | — | Componentes base (Radix UI) |
| Recharts | 2.12.7 | Gráficos e visualizações |
| Sonner | 1.5.0 | Toast notifications |
| date-fns | 3.6.0 | Manipulação de datas |
| jsPDF | 4.0.0 | Geração de PDF |
| next-themes | 0.4.6 | Dark/light mode |

### Backend
| Tecnologia | Uso |
|-----------|-----|
| Supabase (PostgreSQL) | Banco de dados + Auth + Storage |
| Supabase Edge Functions (Deno) | Lógica server-side |
| Google Cloud Run | Extração de frames e DINOv2 |
| Gemini API (2.0-Flash / 2.5-Flash) | Detecção e análise IA |
| pgvector | Embeddings para KNN |

### Configuração TanStack Query
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

---

## 3. ESTRUTURA DO PROJETO

```
C:\Projetos\Passagene/
├── src/
│   ├── main.tsx                        # Entry point
│   ├── App.tsx                         # Router + providers (11 KB)
│   ├── index.css                       # CSS variables + global styles (5.5 KB)
│   │
│   ├── api/                            # Camada de dados
│   │   ├── supabaseQueries.ts          # Queries raw Supabase
│   │   ├── hooks.ts                    # React Query hooks
│   │   └── index.ts                    # Exports
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx             # Auth provider (sessão, login, logout)
│   │
│   ├── hooks/                          # 70+ hooks customizados
│   │   ├── core/                       # useDebounce, useListFilter, usePagination, usePersistedFilters
│   │   ├── aspiracoes/                 # 4 hooks
│   │   ├── cliente/                    # 4 hooks
│   │   ├── doadoras/                   # 3 hooks
│   │   ├── embrioes/                   # 3 hooks
│   │   ├── genetica/                   # 2 hooks
│   │   ├── lotesFiv/                   # 4 hooks
│   │   ├── loteTE/                     # 3 hooks
│   │   ├── protocolos/                 # 8 hooks
│   │   ├── protocoloPasso2/            # 3 hooks
│   │   ├── receptoraHistorico/         # 3 hooks
│   │   ├── receptoras/                 # 5 hooks
│   │   ├── touros/                     # 3 hooks
│   │   ├── usePermissions.ts           # Controle de acesso
│   │   ├── useEmbryoScores.ts          # Scores + polling + realtime
│   │   ├── useEmbryoVideoUpload.ts     # Upload de vídeos
│   │   ├── useEmbryoReview.ts          # Revisão do biólogo
│   │   ├── useKPIData.ts               # Métricas e KPIs
│   │   ├── useTransferenciaEmbrioesData.ts  # TE data (933 linhas - MAIOR)
│   │   ├── useTransferenciaHandlers.ts      # TE handlers
│   │   ├── useTransferenciaEmbrioesFilters.ts
│   │   ├── useLotesFiltros.ts          # Filtros com localStorage
│   │   ├── useClienteFilter.ts         # Multi-tenancy
│   │   ├── useUserClientes.ts          # Clientes do usuário
│   │   ├── useStorageUrl.ts            # URLs signed do Storage
│   │   ├── useTheme.ts                 # Dark/light mode
│   │   ├── use-mobile.tsx              # Detecção mobile
│   │   └── use-toast.ts               # Toasts
│   │
│   ├── components/
│   │   ├── admin/          (6)         # Tabs do painel admin
│   │   ├── aspiracoes/     (1)         # Formulário de oócitos
│   │   ├── camera/         (3)         # Gravação de vídeo
│   │   ├── charts/         (5)         # KPI, barras, linhas, período
│   │   ├── cliente/        (6)         # Cards do portal cliente
│   │   ├── embrioes/       (5)         # Classificação e bulk actions
│   │   ├── embryoscore/    (18)        # Sistema IA completo
│   │   ├── fazenda/        (3)         # Tabs fazenda
│   │   ├── genetica/       (3)         # Catálogo genético
│   │   ├── home/           (5)         # Dashboards por role
│   │   ├── icons/          (6)         # Ícones SVG customizados
│   │   ├── layout/         (6)         # MainLayout, Sidebar, HubTabs, MobileNav
│   │   ├── lotes/          (4)         # Lotes FIV
│   │   ├── loteTE/         (4)         # Lotes TE
│   │   ├── protocolos/     (8)         # Wizard + forms protocolo
│   │   ├── receptoraHistorico/ (7)     # Timeline + stats
│   │   ├── receptoras/     (6)         # CRUD receptoras
│   │   ├── shared/         (22)        # Badges, loading, forms, errors
│   │   ├── shared/DataTable/ (5)       # Tabela genérica responsiva
│   │   ├── touros/         (1)         # Campos dinâmicos por raça
│   │   ├── transferencia/  (4)         # TE seleção + relatório
│   │   └── ui/             (36)        # shadcn/ui base components
│   │
│   ├── pages/
│   │   ├── [autenticação]              # Login, SignUp, ForgotPassword
│   │   ├── Home.tsx                    # Dashboard (role-based)
│   │   ├── Administrativo.tsx          # Admin (6 tabs)
│   │   ├── Doadoras.tsx + DoadoraDetail.tsx
│   │   ├── Touros.tsx + TouroDetail.tsx
│   │   ├── DosesSemen.tsx
│   │   ├── Protocolos.tsx + ProtocoloDetail.tsx
│   │   ├── Aspiracoes.tsx + PacoteAspiracaoDetail.tsx
│   │   ├── LotesFIV.tsx
│   │   ├── Embrioes.tsx + EmbrioesCongelados.tsx
│   │   ├── TransferenciaEmbrioes.tsx + TESessaoDetail.tsx
│   │   ├── DiagnosticoGestacao.tsx + DiagnosticoSessaoDetail.tsx
│   │   ├── Sexagem.tsx + SexagemSessaoDetail.tsx
│   │   ├── EmbryoScore.tsx
│   │   ├── FazendaDetail.tsx
│   │   ├── ReceptoraHistorico.tsx
│   │   ├── relatorios/    (5 páginas)  # Hub de relatórios
│   │   ├── genetica/      (5 páginas)  # Hub genética/catálogo
│   │   └── cliente/       (4 páginas)  # Portal do cliente
│   │
│   ├── lib/
│   │   ├── supabase.ts                 # Cliente Supabase
│   │   ├── types.ts                    # Tipos TypeScript principais
│   │   ├── types/index.ts              # Tipos detalhados (3000+ linhas)
│   │   ├── types/lotesFiv.ts           # Tipos lotes FIV
│   │   ├── types/transferenciaEmbrioes.ts
│   │   ├── fivFlowRules.ts             # Regras de negócio FIV
│   │   ├── receptoraStatus.ts          # Cores/ícones de status
│   │   ├── gestacao.ts                 # Cálculos de gestação
│   │   ├── dateUtils.ts                # Helpers de data
│   │   ├── dataEnrichment.ts           # Enriquecimento genealogia
│   │   ├── statusLabels.ts             # Labels de status (pt-BR)
│   │   ├── error-handler.ts            # Tratamento de erros
│   │   ├── exportPdf.ts                # Geração de PDFs
│   │   ├── utils.ts                    # cn(), formatCurrency, etc.
│   │   ├── embryoscore/prompts.ts      # Prompts Gemini
│   │   └── validations/index.ts        # Schemas Zod
│   │
│   ├── assets/
│   │   ├── logoescrito.svg             # Logo com texto
│   │   └── logosimples.svg             # Logo simples
│   │
│   └── types/                          # Tipos adicionais
│
├── supabase/
│   ├── functions/
│   │   ├── embryo-analyze/index.ts     # IA: DINOv2 + KNN + MLP (895 linhas)
│   │   ├── embryo-detect/index.ts      # Detecção Gemini box_2d (351 linhas)
│   │   └── daily-summary/index.ts      # Resumo diário GENE (331 linhas)
│   │
│   └── migrations/                     # 13 migrações SQL
│
├── cloud-run/
│   └── frame-extractor/
│       ├── app.py                      # Flask: 5 endpoints (806 linhas)
│       ├── Dockerfile
│       └── requirements.txt
│
├── sql/
│   ├── rls_policies.sql                # Todas as políticas RLS
│   ├── rls_rollback.sql                # Emergência: desabilitar RLS
│   └── rls_verify.sql                  # Verificar status RLS
│
├── CLAUDE.md                           # Regras do projeto
├── DOCS.md                             # Referência rápida
├── package.json                        # 32 deps diretas
├── vite.config.ts                      # Vite + PWA + SWC
├── tailwind.config.ts                  # Tema customizado
└── tsconfig.json                       # TypeScript strict
```

---

## 4. BANCO DE DADOS

### 4.1 Diagrama de Relacionamentos (Simplificado)

```
clientes
  ├── fazendas (cliente_id)
  │   ├── doadoras (fazenda_id)
  │   ├── pacotes_aspiracao (fazenda_id origem, fazenda_destino_id destino)
  │   ├── protocolos_sincronizacao (fazenda_id)
  │   ├── receptora_fazenda_historico (fazenda_id)
  │   └── transferencias_sessoes (fazenda_id)
  ├── user_profiles (cliente_id se type='cliente')
  ├── doses_semen (cliente_id proprietário)
  └── embrioes (cliente_id para estoque congelado)

touros (catálogo público)
  └── doses_semen (touro_id)

pacotes_aspiracao
  ├── aspiracoes_doadoras (pacote_aspiracao_id)
  ├── lotes_fiv (pacote_aspiracao_id)
  └── pacotes_aspiracao_fazendas_destino

lotes_fiv (D0 = data_abertura)
  ├── lote_fiv_acasalamentos (lote_fiv_id)
  ├── embrioes (lote_fiv_id)
  └── lote_fiv_fazendas_destino

lote_fiv_acasalamentos
  ├── acasalamento_embrioes_media (vídeos/imagens)
  ├── embryo_analysis_queue (fila de IA)
  └── embrioes (lote_fiv_acasalamento_id)

embrioes
  ├── embryo_scores (embriao_id)
  ├── transferencias_embrioes (embriao_id)
  ├── historico_embrioes (audit trail)
  └── animais (offspring)

receptoras
  ├── receptora_fazenda_historico (movimentação entre fazendas)
  ├── receptoras_cio_livre (sincronização manual)
  ├── protocolo_receptoras (protocolo_id + receptora_id)
  ├── transferencias_embrioes (receptora_id)
  ├── diagnosticos_gestacao (receptora_id)
  └── animais (mãe de aluguel)
```

### 4.2 Tabelas Detalhadas

#### `clientes` — Organizações clientes
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| nome | TEXT NOT NULL | Nome do cliente |
| telefone | TEXT | Telefone |
| endereco | TEXT | Endereço |
| created_at | TIMESTAMPTZ | Data de criação |

#### `fazendas` — Propriedades/fazendas dos clientes
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| cliente_id | UUID FK → clientes | Proprietário |
| nome | TEXT NOT NULL | Nome da fazenda |
| sigla | TEXT | Abreviação |
| responsavel | TEXT | Gerente responsável |
| contato_responsavel | TEXT | Contato do gerente |
| localizacao | TEXT | Descrição geográfica |
| latitude, longitude | NUMERIC | Coordenadas GPS |

#### `doadoras` — Vacas doadoras de oócitos
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| fazenda_id | UUID FK → fazendas | Fazenda de origem |
| nome | TEXT | Nome da doadora |
| registro | TEXT NOT NULL | Registro ABCZ |
| raca | TEXT | Raça (Holandês, Nelore, Girolando) |
| gpta | NUMERIC | Score genético |
| controle_leiteiro | NUMERIC | Controle leiteiro |
| beta_caseina | TEXT | Genótipo beta-caseína (A1A1, A1A2, A2A2) |
| pai_registro, pai_nome | TEXT | Registro e nome do pai |
| mae_registro, mae_nome | TEXT | Registro e nome da mãe |
| genealogia_texto | TEXT | Pedigree completo |
| link_abcz | TEXT | Link catálogo ABCZ |
| foto_url | TEXT | URL da foto |
| disponivel_aspiracao | BOOLEAN | Disponível para aspiração? |
| classificacao_genetica | TEXT | '1_estrela', '2_estrelas', '3_estrelas', 'diamante' |

#### `receptoras` — Vacas receptoras (barriga de aluguel)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| identificacao | TEXT UNIQUE NOT NULL | Brinco/identificação |
| nome | TEXT | Nome/apelido |
| status_reprodutivo | TEXT | Status atual |
| fazenda_atual_id | UUID FK | **DEPRECIADO**: usar receptora_fazenda_historico |
| data_provavel_parto | DATE | Data estimada do parto |
| is_cio_livre | BOOLEAN | Sincronização manual? |
| status_cio_livre | TEXT | PENDENTE, CONFIRMADA, REJEITADA, SUBSTITUIDA |

**Status possíveis da receptora:**

| Status | Cor | Descrição |
|--------|-----|-----------|
| SERVIDA | violet | Recebeu embrião, aguardando DG |
| UTILIZADA | violet | Usada em protocolo para receber embrião |
| PRENHE | green | Gestação confirmada por DG |
| PRENHE_RETOQUE | amber | Prenhe de retoque (re-transferência) |
| PRENHE_FEMEA | pink | Prenhe, sexagem = fêmea |
| PRENHE_MACHO | blue | Prenhe, sexagem = macho |
| PRENHE_SEM_SEXO | purple | Prenhe, sexo não determinado |
| PRENHE_2_SEXOS | indigo | Prenhe, gêmeos de sexos diferentes |
| VAZIA | red | DG negativo |
| RETOQUE | amber | Precisa nova TE |
| INAPTA | red | Removida do protocolo |
| APTA | green | Apta para TE |

#### `touros` — Catálogo de touros (público)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| registro | TEXT NOT NULL | Registro |
| nome | TEXT NOT NULL | Nome |
| raca | TEXT | Raça |
| dados_geneticos | JSONB | Índices genéticos por raça (ver abaixo) |
| dados_producao | JSONB | Métricas de produção |
| dados_conformacao | JSONB | Conformação/tipo |
| medidas_fisicas | JSONB | Medidas físicas |
| dados_saude_reproducao | JSONB | Saúde e reprodução |
| caseinas | JSONB | Genótipos de caseínas |
| outros_dados | JSONB | Badges, composição genética |
| disponivel | BOOLEAN | Sêmen disponível? |

**Estrutura JSONB `dados_geneticos` por raça:**

- **Holandês**: nm_dolares, tpi, ptat, udc, flc, bwc, gpa_lpi, pro_dolar
- **Nelore**: sumario_ancp (mp120, dpn, dp210-dp450, dstay, etc.), sumario_abcz_pmgz, genepius
- **Girolando**: gpta_leite, ipplg, ietg, ifpg, ireg, csmg, esug, ptapn, ptapg

#### `doses_semen` — Estoque de sêmen por cliente
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| touro_id | UUID FK → touros | Touro referenciado |
| cliente_id | UUID FK → clientes | Proprietário |
| tipo_semen | TEXT | CONVENCIONAL ou SEXADO |
| quantidade | INTEGER | Doses em estoque |

#### `pacotes_aspiracao` — Pacotes de aspiração OPU
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| fazenda_id | UUID FK | Fazenda de origem |
| fazenda_destino_id | UUID FK | Fazenda destino principal |
| data_aspiracao | DATE NOT NULL | Data do procedimento |
| horario_inicio | TIME | Hora de início |
| veterinario_responsavel | TEXT | Veterinário |
| tecnico_responsavel | TEXT | Técnico |
| status | TEXT | EM_ANDAMENTO ou FINALIZADO |
| total_oocitos | INTEGER | Total de oócitos coletados |
| usado_em_lote_fiv | BOOLEAN | Já usado em lote FIV? |

#### `aspiracoes_doadoras` — Resultado por doadora na aspiração
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| pacote_aspiracao_id | UUID FK | Pacote pai |
| doadora_id | UUID FK | Doadora aspirada |
| atresicos | INTEGER | Oócitos atrésicos |
| degenerados | INTEGER | Oócitos degenerados |
| expandidos | INTEGER | Oócitos expandidos |
| desnudos | INTEGER | Oócitos desnudos |
| **viaveis** | INTEGER | **CRÍTICO: Oócitos viáveis para FIV** |
| total_oocitos | INTEGER | Soma de todas as categorias |
| recomendacao_touro | TEXT | Sugestão de touro |

#### `lotes_fiv` — Lotes de FIV
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| pacote_aspiracao_id | UUID FK | Aspiração de origem |
| **data_abertura** | DATE NOT NULL | **D0 = Data de fecundação (início da timeline)** |
| status | TEXT | ABERTO ou FECHADO |
| **disponivel_para_transferencia** | BOOLEAN | **Deve ser TRUE para permitir TE** |

#### `lote_fiv_acasalamentos` — Cruzamentos doadora×touro dentro do lote
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| lote_fiv_id | UUID FK | Lote FIV pai |
| aspiracao_doadora_id | UUID FK | Aspiração específica |
| dose_semen_id | UUID FK | Dose de sêmen usada |
| quantidade_fracionada | NUMERIC | Fração da dose |
| quantidade_oocitos | INTEGER | Oócitos atribuídos |
| embrioes_clivados_d3 | INTEGER | Contagem de clivagem D3 |
| quantidade_embrioes | INTEGER | Embriões viáveis finais |

#### `acasalamento_embrioes_media` — Mídia (vídeos/imagens)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| lote_fiv_acasalamento_id | UUID FK | Acasalamento associado |
| tipo_media | TEXT | VIDEO ou IMAGEM |
| arquivo_url | TEXT | URL pública (Supabase Storage) |
| arquivo_path | TEXT | Caminho interno no bucket |
| arquivo_nome | TEXT | Nome original |
| duracao_segundos | NUMERIC | Duração (vídeos) |
| largura, altura | INTEGER | Dimensões em pixels |

#### `embrioes` — Embriões individuais
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| lote_fiv_id | UUID FK | Lote FIV |
| lote_fiv_acasalamento_id | UUID FK | Cruzamento genético |
| acasalamento_media_id | UUID FK | Vídeo/imagem para análise |
| queue_id | UUID FK | Job de análise IA |
| numero_lote | INTEGER | Número sequencial no lote |
| **classificacao** | TEXT | BE, BN, BX, BL, BI, Mo, Dg (IETS) |
| **status_atual** | TEXT | FRESCO, CONGELADO, TRANSFERIDO, DESCARTADO |
| cliente_id | UUID FK | Proprietário (para congelados) |
| fazenda_destino_id | UUID FK | Fazenda destino |
| estrela | BOOLEAN | Top-quality (escolha do biólogo) |
| data_classificacao, data_congelamento, data_descarte | DATE | Datas de eventos |

**Ciclo de vida do embrião:**
```
FRESCO → TRANSFERIDO (TE bem-sucedida)
FRESCO → CONGELADO (armazenado, ganha cliente_id)
FRESCO → DESCARTADO (inviável ou D9+)
CONGELADO → TRANSFERIDO (descongelado e transferido)
```

#### `protocolos_sincronizacao` — Protocolos de sincronização
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| fazenda_id | UUID FK | Fazenda do protocolo |
| data_inicio | DATE NOT NULL | Data de início |
| data_retirada | DATE | Data de retirada |
| responsavel_inicio | TEXT NOT NULL | Técnico início |
| responsavel_retirada | TEXT | Técnico retirada |
| status | TEXT | Status do protocolo |
| passo2_data | DATE | Data do Passo 2 |
| passo2_tecnico_responsavel | TEXT | Técnico do Passo 2 |

#### `protocolo_receptoras` — Receptoras no protocolo
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| protocolo_id | UUID FK | Protocolo |
| receptora_id | UUID FK | Receptora |
| status | TEXT | SERVIDA, UTILIZADA, PRENHE, VAZIA, RETOQUE, INAPTA |
| motivo_inapta | TEXT | Razão se INAPTA |
| ciclando_classificacao | TEXT | N (não ciclando) ou CL (ciclando) |
| qualidade_semaforo | INTEGER | 1=vermelho, 2=amarelo, 3=verde |

#### `transferencias_embrioes` — Registros de TE
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| embriao_id | UUID FK | Embrião transferido |
| receptora_id | UUID FK | Receptora que recebeu |
| protocolo_receptora_id | UUID FK | Protocolo-receptora |
| **data_te** | DATE NOT NULL | **Data oficial da TE (NÃO data_transferencia)** |
| tipo_te | TEXT | Tipo (fresco, descongelado, etc.) |
| veterinario_responsavel | TEXT | Veterinário |
| status_te | TEXT | REALIZADA, FALHA, etc. |

#### `diagnosticos_gestacao` — Diagnósticos (DG e Sexagem)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| receptora_id | UUID FK | Receptora diagnosticada |
| data_te | DATE NOT NULL | Data da TE de referência |
| tipo_diagnostico | TEXT | Tipo do diagnóstico |
| data_diagnostico | DATE NOT NULL | Data do diagnóstico |
| resultado | TEXT | PRENHE, VAZIA, MORTO |
| sexagem | TEXT | FEMEA, MACHO, SEM_SEXO, 2_SEXOS |
| numero_gestacoes | INTEGER | Número de fetos |

#### `receptora_fazenda_historico` — Movimentação entre fazendas
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| receptora_id | UUID FK | Receptora |
| fazenda_id | UUID FK | Fazenda |
| data_inicio | DATE NOT NULL | Data de entrada |
| data_saida | DATE | Data de saída |

> **CRÍTICO**: A fazenda atual da receptora é determinada pelo registro com `MAX(data_inicio)` nesta tabela, NÃO pelo campo `fazenda_atual_id` na tabela receptoras.

#### `animais` — Crias nascidas de TE
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| embriao_id | UUID FK | Embrião de origem |
| receptora_id | UUID FK | Mãe de aluguel |
| fazenda_id | UUID FK | Fazenda de nascimento |
| cliente_id | UUID FK | Proprietário |
| data_nascimento | DATE NOT NULL | Data de nascimento |
| sexo | TEXT | FEMEA, MACHO, SEM_SEXO |
| raca | TEXT | Raça |

#### `transferencias_sessoes` — Sessões de TE (agrupamento)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| fazenda_id | UUID FK | Local da sessão |
| status | TEXT | ABERTA ou ENCERRADA |
| transferencias_ids | UUID[] | Array de IDs de transferência |
| protocolo_receptora_ids | UUID[] | Array de protocolo_receptoras |
| origem_embriao | TEXT | PACOTE (fresco) ou CONGELADO |
| data_te | DATE | Data da sessão |

#### Tabelas do EmbryoScore

**`embryo_analysis_queue`** — Fila de análise IA
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | ID do job |
| media_id | UUID FK | Vídeo/imagem |
| lote_fiv_acasalamento_id | UUID FK | Acasalamento |
| status | TEXT | pending, processing, completed, failed |
| retry_count | INTEGER | Tentativas (max 3) |
| detected_bboxes | JSONB | Bboxes detectadas por OpenCV/Gemini |
| detection_confidence | TEXT | high, medium, low |
| expected_count | INTEGER | Embriões esperados |
| crop_paths | JSONB | Caminhos dos crops JPEG |
| plate_frame_path | TEXT | Frame da placa |

**`embryo_scores`** — Resultados da análise IA (versionado)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | ID do score |
| embriao_id | UUID FK | Embrião analisado |
| embryo_score | NUMERIC | Score final (0-100) |
| classification | TEXT | Excelente, Bom, Regular, Borderline, Inviavel |
| confidence | TEXT | high, medium, low |
| morph_score | NUMERIC | Score morfologia (0-100) |
| kinetic_score | NUMERIC | Score cinética (0-100) |
| stage | TEXT | Estágio IETS (1-9) |
| icm_grade, te_grade | TEXT | A, B ou C |
| knn_classification | TEXT | Classificação KNN (v2) |
| knn_confidence | NUMERIC | Confiança KNN |
| knn_votes | JSONB | Votos por classe |
| mlp_classification | TEXT | Classificação MLP (v2) |
| mlp_confidence | NUMERIC | Confiança MLP |
| combined_classification | TEXT | Decisão final ensemble |
| combined_confidence | NUMERIC | Confiança ensemble |
| combined_source | TEXT | knn, knn_mlp_agree, knn_mlp_disagree, mlp_only, insufficient |
| embedding | vector(768) | Embedding DINOv2 (pgvector) |
| kinetic_intensity/harmony/symmetry/stability/bg_noise | NUMERIC | Métricas cinéticas |
| crop_image_path, motion_map_path, composite_path | TEXT | Imagens no Storage |
| bbox_x/y/width/height_percent | NUMERIC | Posição na placa |
| is_current | BOOLEAN | Score mais recente? (soft delete) |
| analysis_version | INTEGER | Versão da análise |
| biologo_concorda | BOOLEAN | Biólogo concordou? |
| biologo_nota | TEXT | Notas do biólogo |
| biologist_classification | TEXT | Classificação final do biólogo |

**Classificação EmbryoScore:**
| Faixa | Classificação |
|-------|---------------|
| ≥82 | Excelente |
| ≥65 | Bom |
| ≥48 | Regular |
| ≥25 | Borderline |
| <25 | Inviável |

**`embryo_references`** — Atlas de referência para KNN
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | ID da referência |
| classification | TEXT NOT NULL | Classe ground-truth (IETS) |
| embedding | vector(768) NOT NULL | Vetor DINOv2 |
| kinetic_intensity/harmony/symmetry/stability/bg_noise | NUMERIC | Cinética |
| pregnancy_result | BOOLEAN | Resultou em prenhez? |
| species | TEXT | bovine_real, bovine_rocha, human |
| source | TEXT | lab, dataset_rocha, dataset_kromp, dataset_kaggle |
| biologist_agreed | BOOLEAN | Biólogo concordou com IA? |

**Índice pgvector:** HNSW (vector_cosine_ops) para busca KNN eficiente.

**`embryo_score_config`** — Configuração do modelo
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| morph_weight | NUMERIC | Peso da morfologia (0-1) |
| kinetic_weight | NUMERIC | Peso da cinética (0-1) |
| model_name | TEXT | Nome do modelo (gemini-2.5-flash) |
| active | BOOLEAN | Configuração ativa? |
| calibration_prompt | TEXT | Prompt do sistema (NULL = padrão) |
| analysis_prompt | TEXT | Prompt de análise (NULL = padrão) |

**`embryo_score_secrets`** — Chaves de API
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| key_name | TEXT UNIQUE | Nome da chave (GEMINI_API_KEY) |
| key_value | TEXT | Valor da chave |

#### Tabelas de Controle de Acesso

**`user_profiles`** — Perfis de usuário
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK, FK → auth.users | Usuário Supabase |
| nome | TEXT NOT NULL | Nome completo |
| email | TEXT NOT NULL | E-mail |
| user_type | TEXT NOT NULL | admin, operacional, cliente |
| cliente_id | UUID FK | Cliente (se user_type='cliente') |

**`hubs`** — Módulos de navegação
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| code | TEXT UNIQUE | Código interno (relatorios, aspiracoes) |
| name | TEXT | Nome de exibição |
| routes | TEXT[] | Rotas associadas |
| display_order | INTEGER | Ordem no menu |

**`user_hub_permissions`** — Permissões por hub
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| user_id | UUID FK | Usuário |
| hub_code | TEXT FK | Código do hub |
| can_access | BOOLEAN | Acesso permitido? |

### 4.3 Views

| View | Propósito |
|------|-----------|
| **vw_receptoras_fazenda_atual** | Fazenda atual de cada receptora (último registro por data_inicio) |
| v_protocolo_receptoras_status | Sumário de status por protocolo |
| v_tentativas_te_status | Taxas de sucesso de TE |
| v_embrioes_disponiveis_te | Embriões frescos disponíveis para TE |

### 4.4 Funções RPC/RLS

```sql
get_user_cliente_id()                    -- Retorna cliente_id do usuário logado
is_admin_or_operacional()                -- Verifica se é admin/operacional
is_cliente()                             -- Verifica se é cliente
get_receptora_fazenda_atual(uuid)        -- Fazenda atual da receptora
receptora_belongs_to_cliente(uuid)       -- Receptora pertence ao cliente logado?
match_embryos(vector, int, uuid, float)  -- KNN: busca vizinhos por similaridade coseno
get_descartes_te_cliente(uuid[], date)   -- Descartes de TE por cliente
```

### 4.5 Políticas RLS (Row Level Security)

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|---------------------|
| clientes | admin: todos; cliente: só o seu | admin/operacional |
| fazendas | admin: todos; cliente: do seu cliente | admin/operacional |
| doadoras | admin: todos; cliente: de suas fazendas | admin/operacional |
| receptoras | admin: todos; cliente: via receptora_belongs_to_cliente() | admin/operacional |
| touros | PÚBLICO (catálogo) | admin/operacional |
| embrioes | via lote_fiv → pacote → fazenda | admin/operacional |
| embryo_scores | via embriao → lote | Edge Function (service_role) |
| user_profiles | admin: todos; usuário: só o seu | admin |

---

## 5. AUTENTICAÇÃO E PERMISSÕES

### 5.1 Fluxo de Auth

- **Provider**: Supabase Auth (email + password)
- **Context**: `AuthContext.tsx` fornece `useAuth()`
- **Sessão**: Verificada em `supabase.auth.getSession()` no load
- **Listener**: `supabase.auth.onAuthStateChange()` para mudanças
- **Tab focus**: Verifica se sessão expirou ao retornar à tab

### 5.2 Tipos de Usuário

| Tipo | Acesso | Dashboard |
|------|--------|-----------|
| **admin** | Todos os hubs, todos os dados | HomeDashboardAdmin (KPIs gerais) |
| **operacional** | Hubs permitidos via user_hub_permissions | HomeDashboardOperacional |
| **cliente** | Apenas `/cliente/*` | HomeDashboardCliente |

### 5.3 Route Guards

```tsx
<ProtectedRoute>     // Redireciona para /login se não autenticado
  <MainLayout>       // Layout com sidebar + header
    <Outlet />       // Conteúdo da página
  </MainLayout>
</ProtectedRoute>

<PublicRoute>         // Redireciona para / se já autenticado
  <Login />
</PublicRoute>
```

### 5.4 Hook usePermissions

```typescript
usePermissions() → {
  isAdmin, isCliente, isOperacional: boolean,
  profile: UserProfile,
  hasAccessToHub(code: string): boolean,
  hasAccessToRoute(route: string): boolean,
  getAccessibleHubs(): Hub[],
  getDefaultRoute(): string  // '/' para todos
}
```

---

## 6. ROTAS E NAVEGAÇÃO

### 6.1 Mapa Completo de Rotas

```
ROTAS PÚBLICAS (sem autenticação)
  /login                               → Login
  /signup                              → Cadastro
  /forgot-password                     → Recuperação de senha
  /style-guide                         → Showcase de componentes (dev)

ROTAS PROTEGIDAS (autenticação obrigatória)
  /                                    → Home (Dashboard role-based)
  /administrativo                      → Admin (6 tabs)
  /sem-acesso                          → Sem permissão
  /embryoscore                         → EmbryoScore IA

  DOADORAS
  /doadoras                            → Lista de doadoras
  /doadoras/:id                        → Detalhe da doadora

  RECEPTORAS
  /receptoras/:id/historico            → Histórico da receptora

  PROTOCOLOS
  /protocolos                          → Lista de protocolos
  /protocolos/:id                      → Detalhe (wizard multi-step)
  /protocolos/:id/relatorio            → Relatório fechado
  /protocolos/fechados/:id/relatorio   → Relatório (rota alternativa)

  ASPIRAÇÕES
  /aspiracoes                          → Pacotes de aspiração
  /aspiracoes/:id                      → Detalhe do pacote

  TOUROS
  /touros                              → Catálogo de touros
  /touros/:id                          → Detalhe do touro
  /doses-semen                         → Estoque de sêmen

  LOTES FIV
  /lotes-fiv                           → Lista de lotes
  /lotes-fiv/:id                       → Detalhe do lote

  EMBRIÕES
  /embrioes                            → Embriões frescos
  /embrioes-congelados                 → Embriões congelados

  TRANSFERÊNCIA DE EMBRIÕES (TE)
  /transferencia                       → Lista/sessões TE
  /transferencia/sessao                → Sessão TE detalhe

  DIAGNÓSTICO DE GESTAÇÃO (DG)
  /dg                                  → Sessões de DG
  /dg/sessao                           → Sessão DG detalhe

  SEXAGEM
  /sexagem                             → Sessões de sexagem
  /sexagem/sessao                      → Sessão sexagem detalhe

  FAZENDAS
  /fazendas/:id                        → Detalhe da fazenda (tabs)

  HUB RELATÓRIOS
  /relatorios                          → Home relatórios
  /relatorios/servicos                 → Relatórios de serviço
  /relatorios/animais                  → Relatórios de animais
  /relatorios/material                 → Relatórios de material genético
  /relatorios/producao                 → Métricas de produção

  HUB GENÉTICA
  /genetica                            → Home genética
  /genetica/doadoras                   → Catálogo doadoras
  /genetica/doadoras/:id               → Detalhe genético doadora
  /genetica/touros                     → Catálogo touros
  /genetica/touros/:id                 → Detalhe genético touro

  HUB CLIENTE
  /cliente/rebanho                     → Rebanho do cliente
  /cliente/relatorios                  → Relatórios do cliente
  /cliente/botijao                     → Estoque congelado
  /cliente/configuracoes               → Configurações

  REDIRECTS
  /clientes → /administrativo?tab=clientes
  /usuarios → /administrativo?tab=usuarios
  /fazendas → /administrativo?tab=fazendas

  * (catch-all) → NotFound (404)
```

### 6.2 Layout e Navegação

**Desktop:**
- **HubTabs**: Tabs horizontais no topo (hubs filtrados por permissão)
- **Sidebar**: Menu lateral esquerdo (w-64) com rotas do hub ativo
- **Conteúdo**: Área principal com padding `p-4 md:p-8`

**Mobile:**
- **Bottom Nav**: 4-5 botões fixos no rodapé (h-20)
  - Admin/Operacional: Home, Protocolos, TE, DG, Menu
  - Cliente: Home, Rebanho, Relatórios, Botijão
- **Sheet Menu**: Drawer lateral direito com todos os hubs/rotas
- Sem sidebar (hidden on mobile)

**AnalysisQueueBar**: Barra global de status do EmbryoScore
- Mostra pending/processing
- Tempo decorrido da análise mais antiga
- Botão "Parar" com confirmação

---

## 7. MÓDULOS DE NEGÓCIO

### 7.1 Aspirações (OPU)
**Rota**: `/aspiracoes`
**Arquivo**: `src/pages/Aspiracoes.tsx`

**Funcionalidades:**
- **Tab "Nova Sessão"**: Criar pacote de aspiração
  - Selecionar fazenda de origem e destino
  - Adicionar/criar doadoras inline
  - Para cada doadora: registrar contagens de oócitos (atrésicos, degenerados, expandidos, desnudos, viáveis)
  - Auto-calcular horário da próxima doadora
  - Salvar total de oócitos
- **Tab "Histórico"**: Listagem com filtros e paginação (15/página)
- **Draft**: Auto-save em localStorage com expiração de 24h
- **Validação**: Veterinário, técnico, fazenda e data obrigatórios

### 7.2 Protocolos de Sincronização
**Rota**: `/protocolos`
**Arquivo**: `src/pages/Protocolos.tsx`

**Passo 1 (Criação):**
- Selecionar fazenda
- Adicionar receptoras (busca + seleção dupla coluna)
- Definir status ciclando (N/CL) e qualidade (1-3)
- Finalizar → status PASSO1_FECHADO

**Passo 2 (Avaliação):**
- Selecionar protocolo fechado
- Avaliar cada receptora: APTA, INAPTA (com motivo), INICIADA
- Registrar responsáveis
- Finalizar → status SINCRONIZADO

**Regra**: Mínimo 27 dias entre Passo 1 e TE.

### 7.3 Lotes FIV
**Rota**: `/lotes-fiv`
**Arquivo**: `src/pages/LotesFIV.tsx`

**Funcionalidades:**
- Cards coloridos por dia de cultivo (D0-D8)
- Criar novo lote (NovoLoteDialog)
- Acasalamentos doadora×touro com doses fracionadas
- Upload de vídeo por acasalamento
- Despacho de embriões (D7) → marca `disponivel_para_transferencia`
- Contagem: oócitos, clivados, embriões
- Histórico com paginação

### 7.4 Embriões
**Rota**: `/embrioes` (frescos) e `/embrioes-congelados`
**Arquivo**: `src/pages/Embrioes.tsx`, `EmbrioesCongelados.tsx`

**Funcionalidades:**
- Classificação individual ou em batch (A, B, C, BE, BN, BX, BL, BI)
- Toggle estrela (top-quality)
- Congelar → muda status + registra cliente_id
- Descartar → muda status + registra data
- Editar fazendas destino
- Bulk actions bar quando múltiplos selecionados

### 7.5 Transferência de Embriões (TE)
**Rota**: `/transferencia`
**Arquivo**: `src/pages/TransferenciaEmbrioes.tsx`

**Funcionalidades:**
- Layout dual: Receptoras (esquerda) + Embriões (direita)
- Origem: PACOTE (fresco) ou CONGELADO
- Filtros: fazenda, data passo 2, cliente, raça
- Selecionar receptora + embrião → registrar transferência
- Max 2 embriões por receptora (toggle "2º embrião" raro ~3%)
- Sessão com persistência e restauração
- Relatório final ao encerrar
- Marca embrião como TRANSFERIDO e receptora como SERVIDA

**Arquivo mais complexo**: `useTransferenciaEmbrioesData.ts` (933 linhas)

### 7.6 Diagnóstico de Gestação (DG)
**Rota**: `/dg`
**Arquivo**: `src/pages/DiagnosticoGestacao.tsx`

**Funcionalidades:**
- Selecionar fazenda → lote TE → receptoras SERVIDAS
- Para cada receptora: data_diagnostico, resultado (PRENHE/VAZIA/RETOQUE), numero_gestacoes
- Auto-fill numero_gestacoes=1 para PRENHE
- Auto-calcular data_provavel_parto se PRENHE
- Validação: mínimo **27 dias** de gestação (DIAS_MINIMOS.DG)
- Draft com auto-save

### 7.7 Sexagem
**Rota**: `/sexagem`
**Arquivo**: `src/pages/Sexagem.tsx`

**Funcionalidades:**
- Receptoras PRENHE/PRENHE_RETOQUE elegíveis
- Múltiplas gestações = múltiplos campos de sexagem
- Para cada gestação: FEMEA, MACHO, SEM_SEXO, VAZIA
- Lógica de status:
  - Todos FEMEA → PRENHE_FEMEA
  - Todos MACHO → PRENHE_MACHO
  - Mistos → PRENHE_2_SEXOS
  - Todos SEM_SEXO → PRENHE_SEM_SEXO
  - Todos VAZIA → VAZIA
- Validação: mínimo **54 dias** de gestação (DIAS_MINIMOS.SEXAGEM)
- Sexagens armazenadas em observacoes como "SEXAGENS:F,M,SS|notas"

### 7.8 Relatórios
**Rotas**: `/relatorios/*`

| Página | Conteúdo |
|--------|----------|
| RelatoriosHome | Hub com KPIs 30 dias, gráficos de tendência |
| RelatoriosServicos | TE, DG, Sexagem por período/fazenda/cliente |
| RelatoriosAnimais | Genealogia, produção, genética |
| RelatoriosMaterial | Doses de sêmen, embriões, estoque |
| RelatoriosProducao | KPIs comparativos período a período |

### 7.9 Portal do Cliente
**Rotas**: `/cliente/*`

| Página | Conteúdo |
|--------|----------|
| ClienteRebanho | Visão do rebanho (receptoras, doadoras) |
| ClienteRelatorios | Relatórios do cliente |
| ClienteBotijao | Estoque de embriões congelados |
| ClienteConfiguracoes | Perfil e preferências |

**Público-alvo**: Usuários idosos com vista ruim e pouca intimidade tecnológica.
- Fontes mínimas: `text-xs` (12px) para labels, `text-base` (16px) para nomes
- Touch targets mínimos: 44px (h-11)

### 7.10 Administrativo
**Rota**: `/administrativo`
**6 tabs:** Clientes, Usuários, Fazendas, Catálogo, EmbryoScore, Dashboard

---

## 8. HOOKS E CAMADA DE DADOS

### 8.1 Camada de API

**`src/api/supabaseQueries.ts`** — Queries raw para Supabase (SELECT, INSERT, UPDATE)

**`src/api/hooks.ts`** — React Query hooks com cache configurado:
- Dados estáticos (fazendas, touros, clientes): staleTime 5min, gcTime 10min
- Dados dinâmicos (receptoras, doadoras, doses): staleTime 2min, gcTime 5min

**Query Key Namespace:**
```typescript
queryKeys = {
  fazendas: ['fazendas'],
  fazenda: (id) => ['fazendas', id],
  doadorasByFazenda: (id) => ['doadoras', 'fazenda', id],
  receptorasComStatusByFazenda: (id) => ['receptoras-com-status', id],
  dosesByCliente: (id) => ['doses-semen', 'cliente', id],
  // ...
}
```

**Invalidação:**
```typescript
useInvalidateQueries() → {
  invalidateFazendas, invalidateTouros, invalidateClientes,
  invalidateDoadoras, invalidateReceptoras, invalidateDoses,
  invalidateAll
}
```

### 8.2 Hooks Core

| Hook | Propósito |
|------|-----------|
| `useDebounce(value, delay=300)` | Debounce genérico para inputs |
| `useListFilter({data, searchFn, extraFilters})` | Filtragem com busca + filtros extras |
| `usePagination(data, {pageSize=20})` | Estado de paginação com navegação |
| `usePersistedFilters({storageKey, initialFilters})` | Filtros com persistência em localStorage |

### 8.3 Hooks de EmbryoScore

| Hook | Propósito |
|------|-----------|
| `useEmbryoScore(embriaoId)` | Score individual com polling 5s até chegar |
| `useAcasalamentoScores(id)` | Scores de todos embriões de um acasalamento |
| `useEmbryoScoresBatch(ids)` | Batch com polling + realtime subscription |
| `useEmbryoAnalysisStatus(id)` | Status do job com polling 3s |
| `useGlobalAnalysisQueue()` | Fila global (pending/processing) com polling 10s |
| `useRetryAnalysis()` | Retry de jobs falhos |
| `useCancelAnalysis()` | Cancelar job específico |
| `useEmbryoVideoUpload()` | Upload com progresso (validação, storage, record) |
| `useReviewData(queueId)` | Dados para revisão do biólogo |
| `useSubmitClassification()` | Salvar classificação do biólogo + inserir no atlas |
| `useUndoClassification()` | Desfazer classificação (janela de 5 min) |
| `useAtlasStats()` | Contagem de referências no atlas |

### 8.4 Hooks de Transferência (mais complexo)

**`useTransferenciaEmbrioesData`** (933 linhas):
- Carrega fazendas, clientes, pacotes, embriões congelados, receptoras
- Gerencia sessão de TE com persistência/restauração
- Merge receptoras de PROTOCOLO + CIO_LIVRE
- Filtros: origem, cliente, raça, data passo 2

**`useTransferenciaHandlers`**:
- `handleSubmit()`: Registra transferência individual
- `handleDescartarReceptora()`: Remove receptora da sessão
- `verificarEAtualizarStatusProtocolo()`: Verifica se protocolo pode ser fechado
- `gerarRelatorioSessao()`: Gera relatório com genealogia
- `handleEncerrarSessao()`: Finaliza e limpa sessão

### 8.5 Padrões de TanStack Query

**Polling condicional:**
```typescript
refetchInterval: (query) => {
  return query.state.data ? false : 5000; // Para quando dado chega
}
```

**Realtime subscription:**
```typescript
supabase.channel('scores')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'embryo_scores' }, () => {
    queryClient.invalidateQueries({ queryKey: ['embryo-scores'] });
  })
  .subscribe();
```

**Optimistic updates:**
```typescript
const localUpdates = new Map<id, Partial<updates>>();
const removedIds = new Set<id>();
// Aplicados via useMemo antes de retornar dados
```

---

## 9. COMPONENTES COMPARTILHADOS

### 9.1 Sistema de Badges

**StatusBadge** (`src/components/shared/StatusBadge.tsx`)
- 89 configurações de status
- Props: `{ status, count?, size?: 'sm'|'default' }`
- Estilo: `bg-[cor]/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]/30`

**CountBadge** (`src/components/shared/CountBadge.tsx`)
- Variantes: default, primary, success, warning, danger, info, pink, blue, purple, cyan, violet
- Props: `{ value, variant?, suffix? }`

**ResultBadge** (`src/components/shared/ResultBadge.tsx`)
- Resultados DG, Sexagem, classificação de embrião
- Utilitários: `getResultColor()`, `getSexagemResult()`, `getSexagemLabel()`

### 9.2 Formulários

| Componente | Propósito |
|-----------|-----------|
| `DatePickerBR` | Date picker pt-BR com ISO strings |
| `SearchInput` | Campo de busca com ícone e clear |
| `FazendaSelector` | Dropdown de fazendas em card |
| `CiclandoBadge` | Badge editável N/CL |
| `QualidadeSemaforo` | Semáforo 1-2-3 (vermelho-amarelo-verde) |
| `ClassificacoesCicloInline` | Editor combinado ciclo + qualidade |
| `FormDialog` | Wrapper genérico para formulários em dialog |

### 9.3 DataTable Responsivo

**DataTable** (`src/components/shared/DataTable/`)
- Auto-switch: TableView (desktop ≥768px) ↔ CardView (mobile)
- Props: `{ data, columns, renderCell, onRowClick, actions, rowNumber }`

**SelectableDataTable** — Com radio/checkbox
- Props adicionais: `{ selectionType, selectedId, onSelect, pageSize }`

**EditableDataTable** — Com edição inline
- Tipos: text, number, time, custom
- Props adicionais: `{ onCellChange, onRemoveRow, showRemoveButton }`

### 9.4 Loading & Erros

| Componente | Uso |
|-----------|-----|
| `LoadingSpinner` | Spinner simples (Loader2 animado) |
| `LoadingScreen` | Tela com logo animado (pulse + ping) |
| `LoadingInline` | Loading compacto para seções |
| `TableSkeleton` | Skeleton de tabela |
| `EmptyState` | Estado vazio (sem dados) |
| `SectionErrorBoundary` | Error boundary por seção |
| `AppErrorFallback` | Fallback global (react-error-boundary) |

### 9.5 Outros Compartilhados

| Componente | Uso |
|-----------|-----|
| `PageHeader` | Cabeçalho de página com título |
| `ThemeToggle` | Toggle dark/light |
| `ScrollToTop` | Botão voltar ao topo |
| `GenealogiaTree` | Árvore genealógica completa |
| `GenealogiaTreeSimple` | Árvore simplificada |
| `DoadoraHistoricoAspiracoes` | Histórico de aspirações |

### 9.6 Componentes shadcn/ui (36)

alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, chart, checkbox, collapsible, command, dialog, dropdown-menu, form, input, label, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip

---

## 10. EDGE FUNCTIONS E SERVIÇOS SERVERLESS

### 10.1 `embryo-analyze` — Pipeline DINOv2 + KNN + MLP (895 linhas)

**Endpoint**: POST `/supabase/functions/embryo-analyze`
**Input**: `{ queue_id: string }`

**Pipeline de 12 etapas:**

1. **Buscar e validar job** → embryo_analysis_queue (status pending/failed, max 3 retries)
2. **Buscar metadata da mídia** → acasalamento_embrioes_media
3. **Buscar embriões** → 3 fallbacks: por queue_id, media_id, acasalamento_id
4. **Buscar/reusar bboxes** → Cache de jobs anteriores no mesmo media_id
5. **Gerar URL signed** do vídeo (600s TTL)
6. **Detecção server-side** (se sem cache):
   - Cloud Run `/extract-frame` → extrai frame
   - Gemini 2.5-Flash box_2d → detecta embriões com prompt estruturado
   - Filtra outliers por tamanho (25%-400% da mediana)
   - Ordena por leitura (esquerda→direita, cima→baixo)
7. **Cloud Run `/extract-and-crop`** → 40 frames × N crops por embrião
8. **Upload plate frame** → bucket `embryoscore`
9. **DINOv2 paralelo** → embedding 768d + cinética 5 métricas + MLP por embrião
10. **KNN Atlas paralelo** → match_embryos RPC, votação majoritária
11. **Combinação dinâmica KNN + MLP:**
    - Atlas maduro (200+ refs): KNN domina
    - Crescendo + ambos concordam: 60% KNN + 40% MLP
    - Crescendo + discordam: peso proporcional à maturidade
    - Apenas MLP: se confiança ≥50%
    - Insuficiente: graceful degradation
12. **Salvar scores** → soft-delete versões anteriores, inserir novas com is_current=true

### 10.2 `embryo-detect` — Detecção via Gemini (351 linhas)

**Endpoint**: POST `/supabase/functions/embryo-detect`
**Input**: `{ frame_base64, expected_count, frame_width?, frame_height? }`
**Output**: `{ bboxes: DetectedBbox[], model, debug }`

**Prompt de detecção:**
```
Detect EXACTLY ${expected_count} bovine embryos.
Each detection: box_2d [ymin, xmin, ymax, xmax] normalized 0-1000.
Embryos: DARK, OPAQUE, circular structures.
REJECT: Bubbles (bright/transparent), debris, well edges, shadows.
```

**Parsing robusto**: JSON direto → markdown code blocks → extração de propriedade → regex → reparo de resposta truncada.

### 10.3 `daily-summary` — Resumo Diário GENE (331 linhas)

**Endpoint**: POST `/supabase/functions/daily-summary`
**Input**: `{ cliente_id, cliente_nome, data, receptoras, proximos_servicos, ultimos_resultados, estoque, fazendas }`
**Output**: `{ summary: string }` (4 parágrafos)

**Persona GENE:**
- Veterinário experiente, amigo do produtor
- Fala como gente do interior — direto, simples
- 80-150 palavras, frases curtas (max 15 palavras)
- Sem listas/bullets, sem termos técnicos
- 2-3 emojis permitidos: 🔴 🟡 ✅ 🐄

### 10.4 Cloud Run: `frame-extractor` (Python/Flask, 806 linhas)

**Endpoints:**

| Endpoint | Propósito |
|----------|-----------|
| `POST /extract-frame` | Extrai 1 frame JPEG do vídeo (com detecção de frame preto) |
| `POST /crop-frame` | Recorta múltiplas regiões de um frame |
| `POST /extract-and-crop` (v2) | Extrai 40 frames + recorta por embrião em uma chamada |
| `POST /analyze-activity` (v2) | Análise cinética completa com compensação de ruído da câmera |
| `GET /health` | Health check |

**`/analyze-activity`** — Análise cinética detalhada:
- Compensação de ruído de fundo (background noise)
- Por embrião: activity_score, core/periphery_activity, temporal_pattern, symmetry
- Kinetic Quality Score com modificadores
- Heatmaps de atividade cumulativa
- Clean frames + composite frames + cumulative heatmap

---

## 11. EMBRYOSCORE

### 11.1 Arquitetura v2 (Atual)

```
                    ┌─────────────────────┐
                    │  Upload de Vídeo    │
                    │  (Storage bucket)   │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │  embryo_analysis_   │
                    │  queue (pending)     │
                    └────────┬────────────┘
                             │
              ┌──────────────▼──────────────────┐
              │  Edge Function: embryo-analyze   │
              │  (Deno, 895 linhas)              │
              └──────┬───────────┬──────────────┘
                     │           │
         ┌───────────▼──┐  ┌────▼──────────┐
         │  Gemini 2.5  │  │  Cloud Run    │
         │  (Detecção   │  │  /extract-    │
         │   box_2d)    │  │  and-crop     │
         └──────────────┘  └────┬──────────┘
                                │ 40 frames × N crops
                     ┌──────────▼──────────┐
                     │  Cloud Run DINOv2   │
                     │  /analyze-embryo    │
                     │  (embedding 768d +  │
                     │   kinetics + MLP)   │
                     └──────────┬──────────┘
                                │
                  ┌─────────────▼───────────┐
                  │  pgvector KNN Search    │
                  │  match_embryos() RPC    │
                  │  (embryo_references)    │
                  └─────────────┬───────────┘
                                │
                  ┌─────────────▼───────────┐
                  │  Combinação Dinâmica    │
                  │  KNN + MLP → Score      │
                  └─────────────┬───────────┘
                                │
                  ┌─────────────▼───────────┐
                  │  embryo_scores          │
                  │  (is_current=true)      │
                  └─────────────────────────┘
                                │
                  ┌─────────────▼───────────┐
                  │  Revisão do Biólogo     │
                  │  (biologist_classific.) │
                  │  → Insere no Atlas      │
                  └─────────────────────────┘
```

### 11.2 Componentes Frontend (18 arquivos)

| Componente | Propósito |
|-----------|-----------|
| EmbryoScoreCard | Card principal de score |
| EmbryoScoreBadge | Badge de qualidade |
| VideoUploadButton | Upload de vídeo |
| EmbryoReviewPanel | Revisão do biólogo |
| EmbryoHighlightFrame | Destaque do embrião no frame |
| EmbryoMinimap | Minimapa de posições |
| PlatePanorama | Vista completa da placa |
| LoteScoreDashboard | Dashboard do lote |
| BiologistClassButtons | Botões de aprovação |
| BiologistFeedback | Formulário de feedback |
| ComparativeAnalysisCard | Comparação entre embriões |
| DiscrepancyAlert | Alerta de discrepância |
| ConcordanceReport | Relatório de concordância |
| ScoreRemapping | Visualização de remapeamento |
| ScorePregnancyCorrelation | Correlação com prenhez |
| DoadoraScoreTrend | Tendência de scores por doadora |
| TransferRankingCard | Ranking para TE |
| DispatchSummary | Resumo de despacho |

### 11.3 Formato de Coordenadas (Bboxes)

```
Browser/JavaScript:  Centro-based percentages (0-100)
  { x_percent, y_percent, width_percent, height_percent, radius_px }

Gemini box_2d:  [ymin, xmin, ymax, xmax] normalizados 0-1000
  Conversão: dividir por 10 → porcentagem 0-100
```

### 11.4 Loop de Feedback do Biólogo

1. IA analisa embrião → score + classificação
2. Biólogo revisa → concorda ou reclassifica
3. Se classificado → inserido no `embryo_references` (atlas cresce)
4. Próxima análise usa atlas atualizado para KNN
5. Atlas mais maduro → KNN mais confiável → peso maior

---

## 12. REGRAS DE NEGÓCIO CRÍTICAS

### 12.1 Timeline do Embrião (a partir de D0 = data_abertura)

| Dia | Evento | Notas |
|-----|--------|-------|
| D0 | Fecundação | `data_abertura` do lote FIV |
| D3 | Avaliação clivagem | `embrioes_clivados_d3` contados |
| D6/D7/D8 | Avaliação expansão | Contagem final de embriões |
| D9 | Prazo de descarte | Se não transferido até D9 → DESCARTADO |
| D27+ (pós-TE) | DG possível | Mínimo 27 dias após TE |
| D54+ (pós-TE) | Sexagem possível | Mínimo 54 dias após TE |

### 12.2 Regras de Status da Receptora

| Módulo | Dias Mínimos | Status Entrada | Status Saída |
|--------|--------------|----------------|--------------|
| DG | 27 dias pós-TE | SERVIDA | PRENHE, VAZIA, RETOQUE |
| Sexagem | 54 dias pós-TE | PRENHE, PRENHE_RETOQUE | PRENHE_FEMEA/MACHO/SEM_SEXO/2_SEXOS, VAZIA |

### 12.3 Campos Críticos (Armadilhas Conhecidas)

| Campo | Tabela | Regra |
|-------|--------|-------|
| `data_abertura` | lotes_fiv | **D0 = data de fecundação** |
| `data_te` | transferencias_embrioes | **Data oficial da TE (NÃO `data_transferencia`)** |
| `disponivel_para_transferencia` | lotes_fiv | **Deve ser TRUE para permitir TE** |
| `viaveis` | aspiracoes_doadoras | **Oócitos viáveis (métrica principal)** |
| `is_current` | embryo_scores | **TRUE = score mais recente (soft delete)** |
| Fazenda atual | receptora_fazenda_historico | **Via MAX(data_inicio), NÃO `fazenda_atual_id`** |

### 12.4 Contagem de Embriões

```sql
-- Embriões viáveis = classificação válida
COUNT(*) FROM embrioes
WHERE classificacao IN ('A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI')
```

### 12.5 Multi-Tenancy

- **Frontend**: `useClienteFilter()` filtra dados por cliente_id (otimização UI)
- **Backend**: Políticas RLS no Supabase (segurança real server-side)
- **Nunca depender apenas do filtro frontend** — RLS é a garantia

### 12.6 Armadilhas Supabase

- **Nested joins** podem falhar silenciosamente → preferir queries separadas
- **`vw_receptoras_fazenda_atual`** é necessária para obter fazenda de receptoras
- **DatePickerBR** usa string ISO (`"2026-01-15"`), não objeto Date
- **Supabase CLI NÃO executa SQL arbitrário** sem Docker → SQL via Dashboard
- **NUNCA fazer `migration repair`** sem saber quais migrations foram aplicadas

---

## 13. PADRÕES DE DESIGN

### 13.1 Regra de Ouro
**MENOS É MAIS** — Nada de glows, stripes, dots, gradient text, blur, animate-ping.

### 13.2 Cores Semânticas

| Status | Cor | Uso |
|--------|-----|-----|
| PRENHE | green | Gestação confirmada |
| VAZIA | red | Sem gestação |
| RETOQUE/PRENHE_RETOQUE | amber | Retry/atenção |
| PRENHE_FEMEA | pink | Fêmea confirmada |
| PRENHE_MACHO | blue | Macho confirmado |
| PRENHE_2_SEXOS | indigo | Gêmeos mixtos |
| PRENHE_SEM_SEXO | purple | Sexo não determinado |
| SERVIDA/UTILIZADA | violet | Em processo |
| CONGELADO | cyan | Congelado |

### 13.3 Layout Responsivo Dual

```tsx
{/* Mobile: Cards */}
<div className="md:hidden space-y-3">
  {data.map(item => <Card>...</Card>)}
</div>

{/* Desktop: Tabela Grid */}
<div className="hidden md:block">
  <div className="grid grid-cols-[2fr_1fr_1fr]">...</div>
</div>
```

### 13.4 Cards e Componentes

```tsx
// Card padrão
<div className="rounded-xl border border-border bg-card shadow-sm p-4">

// Card mobile
<div className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">

// Container de filtros
<div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">

// Indicador colorido
<div className="w-1 h-6 rounded-full bg-[cor]/40">
```

### 13.5 Dark Mode
- Usar CSS variables: `bg-muted`, `text-foreground`, `border-border`
- **NUNCA** hardcodar cores como `bg-white`, `text-gray-900`
- Gerenciado por next-themes + localStorage

### 13.6 Touch Targets (Mobile)
- Mínimo: 44px (h-11)
- Inputs: `w-full md:w-[Xpx]`
- Botões: `h-11 md:h-9`

### 13.7 CSS Grid para Tabelas

**100% largura (sem scroll):**
```tsx
<div className="rounded-lg border border-border">
  <div className="grid grid-cols-[2fr_16px_1.2fr_1.8fr]">
```

**Scroll horizontal:**
```tsx
<div className="overflow-x-auto">
  <div className="min-w-[750px]">
    <div className="grid grid-cols-[160px_36px_90px_100px]">
```

> **ARMADILHA**: `overflow-x-auto` + `minmax(X,1fr)` = colunas travadas no mínimo.

---

## 14. INFRAESTRUTURA

### 14.1 Google Cloud
- **Projeto**: `apppassatempo`
- **Cloud Run**: `frame-extractor` em us-central1
  - 512Mi memória, 1 CPU, max 5 instâncias, 300s timeout
  - Deploy: `gcloud run deploy frame-extractor --source cloud-run/frame-extractor/ --project apppassatempo --region us-central1`

### 14.2 Supabase
- **Projeto**: `twsnzfzjtjdamwwembzp`
- PostgreSQL + Auth + Storage + Edge Functions
- Extensão pgvector habilitada

### 14.3 Variáveis de Ambiente
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GEMINI_API_KEY=         (edge functions)
FRAME_EXTRACTOR_URL=    (Cloud Run URL)
DINOV2_CLOUD_RUN_URL=   (Cloud Run URL)
```

### 14.4 Build & Deploy
```bash
pnpm run dev       # Dev server
pnpm run build     # Production build → dist/
pnpm run preview   # Preview local do build
pnpm run lint      # ESLint
```

### 14.5 Storage Buckets

| Bucket | Conteúdo |
|--------|----------|
| `embryo-videos` | Vídeos de embriões + crops JPEG |
| `embryoscore` | Artefatos de análise (frames, motion maps, composites) |

---

## 15. DEPENDÊNCIAS

### Produção (32 pacotes)

| Categoria | Pacotes |
|-----------|---------|
| UI Primitivos | @radix-ui/* (12 pacotes), lucide-react, @hugeicons |
| Estado & Cache | @tanstack/react-query, @supabase/supabase-js |
| Formulários | react-hook-form, zod |
| Routing | react-router-dom |
| Charts | recharts |
| Data | date-fns |
| PDF | jspdf, jspdf-autotable, html2canvas |
| Tema | next-themes, tailwindcss-animate |
| Toast | sonner |
| Util | clsx, tailwind-merge, vaul, embla-carousel-react |
| Analytics | @vercel/speed-insights |
| Erros | react-error-boundary |

### Desenvolvimento (8 pacotes)
vite, @vitejs/plugin-react-swc, vite-plugin-pwa, vite-plugin-svgr, typescript, eslint, typescript-eslint, autoprefixer

---

## APÊNDICE: GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| D0 | Dia 0 = data de fecundação (data_abertura do lote FIV) |
| TE | Transferência de Embriões |
| DG | Diagnóstico de Gestação |
| FIV | Fertilização In Vitro |
| OPU | Ovum Pick-Up (aspiração de oócitos) |
| Doadora | Vaca doadora de oócitos |
| Receptora | Vaca receptora (barriga de aluguel) |
| Protocolo | Protocolo de sincronização de cio |
| Lote FIV | Grupo de fecundações de uma mesma aspiração |
| Acasalamento | Cruzamento doadora × touro dentro do lote |
| Oócito | Óvulo imaturo |
| Palheta | Unidade de criopreservação |
| IETS | International Embryo Technology Society (classificação) |
| BE | Blastocisto Expandido |
| BN | Blastocisto em Nidação |
| BX | Blastocisto Expandido eXtra |
| BL | Blastocisto |
| BI | Blastocisto Inicial |
| Mo | Mórula |
| Dg | Degenerado/morto |
| KNN | K-Nearest Neighbors (busca por similaridade) |
| MLP | Multi-Layer Perceptron (rede neural) |
| DINOv2 | Vision Transformer da Meta para embeddings |
| pgvector | Extensão PostgreSQL para vetores |
| RLS | Row Level Security (segurança por linha) |
| PRENHE | Prenha/grávida |
| VAZIA | Não prenha |
| SERVIDA | Coberta/inseminada |
| RETOQUE | Nova tentativa necessária |
