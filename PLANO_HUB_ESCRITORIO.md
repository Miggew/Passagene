# Hub Escritorio — Plano Definitivo

## Visao Geral

O Hub Escritorio e um modulo de cadastro otimizado para desktop, projetado para digitalizar relatorios de campo preenchidos a mao e transcrever os dados para o banco de dados de forma rapida e inteligente.

### Contexto do Problema

Os servicos de campo (protocolos, TE, DG, sexagem, aspiracao) frequentemente sao realizados sem o uso do app. As informacoes chegam ao escritorio como relatorios em papel e precisam ser cadastradas manualmente. Esse processo e lento e propenso a erros.

### A Solucao

Dois modos de entrada que coexistem:
- **Foto/Scan** — Tira foto do relatorio, IA extrai os dados, usuario revisa e salva
- **Manual Rapido** — Grid tipo planilha otimizada para teclado (Tab/Enter)

### Principios

- Desktop-first (tela grande, conexao estavel, teclado)
- Velocidade de entrada e prioridade
- Revisao humana SEMPRE obrigatoria antes de salvar
- Reutilizar infraestrutura existente (Gemini API, Supabase Edge Functions, Storage)
- Logica de negocio centralizada em RPCs atomicas no banco (sem duplicacao)

---

## Cascata de Servicos — Logica de Negocio

Todos os servicos de receptoras seguem uma cascata onde cada etapa herda dados da anterior:

```
P1 Protocolo (fundacao — receptoras podem ser NOVAS)
  |
  v
P2 Confirmacao (receptoras JA no BD, confirmar presenca/perda)
  |
  v
TE Transferencia (receptoras do P2 + embriao do lab)
  |
  v
DG Diagnostico (receptoras da TE + resultado prenhe/vazia/retoque)
  |
  v
Sexagem (receptoras prenhe do DG + sexo femea/macho/etc)
```

Pipeline independente:
```
Aspiracao Folicular (doadoras, ~80% ja no BD, ~20% novas)
  → Produz oocitos → embrioes → alimentam a TE
```

### Implicacao para OCR

- **P1**: Mais dificil (receptoras novas, relatorios caoticos). Foco em entrada manual.
- **P2 em diante**: Cada vez mais facil — animais ja conhecidos no BD, match de alta confianca.
- **Aspiracao**: Relatorio padronizado, 80% matchavel contra BD.

---

## Bloco Universal de Campo (para grafica)

### Design: 2 Blocos

**Bloco 1 — Universal (receptoras):** Serve para P1, P2, TE, DG e Sexagem.
**Bloco 2 — Aspiracao (doadoras):** Serve para aspiracao folicular com colunas de oocitos.

### Bloco 1 — Universal

```
+----------------------------------------------------------+
|                                                           |
|  PASSAGENE — RELATORIO DE CAMPO                          |
|                                                           |
|  SERVICO:                                                |
|  [ ] Protocolo (1o passo)     [ ] Transferencia (TE)     |
|  [ ] Protocolo (2o passo)     [ ] Diagnostico (DG)       |
|                                [ ] Sexagem                |
|                                                           |
|  Fazenda: _________________________  Data: ___/___/___   |
|  Veterinario: _____________________  Tecnico: _________  |
|  Referencia: ______________________                      |
|                                                           |
| +----+------------------+-------+------------+---------+ |
| | No | ANIMAL (registro)| RACA  | RESULTADO  |  OBS    | |
| +----+------------------+-------+------------+---------+ |
| | 01 | ________________ | _____ | __________ | _______ | |
| | 02 | ________________ | _____ | __________ | _______ | |
| | .. | ________________ | _____ | __________ | _______ | |
| | 25 | ________________ | _____ | __________ | _______ | |
| +----+------------------+-------+------------+---------+ |
|                                                           |
|  Total: [___]     Pag: ___/___                           |
|                                                           |
|  +------------------------------------------------------+|
|  | COMO PREENCHER O RESULTADO:                           ||
|  |                                                       ||
|  | P1: deixar em branco (so preencher Animal e Raca)     ||
|  | P2: check = Apta    X = Perda                        ||
|  | TE: codigo do embriao (ex: EMB-001)                   ||
|  | DG: P = Prenhe   V = Vazia   R = Retoque             ||
|  | Sexagem: F = Femea  M = Macho  S = Sem sexo          ||
|  |          D = Dois sexos  V = Vazia                    ||
|  +------------------------------------------------------+|
|                                                           |
|  PASSAGENE v1.0                                          |
+----------------------------------------------------------+
```

Caracteristicas:
- 5 colunas limpas (No, Animal, Raca, Resultado, Obs)
- Sem checkboxes nas linhas — campo RESULTADO aberto para letra/codigo
- Legenda no rodape ensina o preenchimento por servico
- Campo Pag: ___/___ para relatorios com mais de 25 animais
- Versao (v1.0) no rodape para controle de template
- 25 linhas por pagina

### Bloco 2 — Aspiracao

```
+----------------------------------------------------------+
|                                                           |
|  PASSAGENE — ASPIRACAO FOLICULAR                         |
|                                                           |
|  Fazenda: _________________________  Data: ___/___/___   |
|  Veterinario: _____________________  Tecnico: _________  |
|  Hora inicio: ____:____  Hora final: ____:____           |
|                                                           |
| +----+--------------+------+----+----+----+----+----+---+|
| | No | DOADORA      | RACA |ATR |DEG |EXP |DES |VIA | T ||
| +----+--------------+------+----+----+----+----+----+---+|
| | 01 | ____________ | ____ |[__]|[__]|[__]|[__]|[__]|___||
| | 02 | ____________ | ____ |[__]|[__]|[__]|[__]|[__]|___||
| | .. | ____________ | ____ |[__]|[__]|[__]|[__]|[__]|___||
| | 20 | ____________ | ____ |[__]|[__]|[__]|[__]|[__]|___||
| +----+--------------+------+----+----+----+----+----+---+|
|                                                           |
|  Total viaveis: [___]   Total geral: [___]               |
|  Pag: ___/___                                            |
|  Assinatura: ________________________                     |
|                                                           |
|  ATR=Atresicos DEG=Degenerados EXP=Expandidos            |
|  DES=Desnudos VIA=Viaveis T=Total                        |
|                                                           |
|  PASSAGENE v1.0                                          |
+----------------------------------------------------------+
```

Caracteristicas:
- 20 linhas por pagina (colunas numericas precisam de mais espaco)
- Caixas [__] para numeros individuais
- 6 colunas de oocitos + total

### Impressao

Os blocos sao PDFs master em alta resolucao gerados pela plataforma.
O usuario baixa uma vez e envia para a grafica fazer blocos de 50-100 folhas.
Formato A4. Nao precisa reimprimir — o bloco dura meses.

---

## Relatorios Pre-preenchidos (Opcional/Premium)

Alem dos blocos genericos da grafica, o sistema pode gerar relatorios
pre-preenchidos com dados do BD para impressao sob demanda:

- Receptoras ja listadas por nome
- QR code com ID do protocolo (identificacao instantanea)
- Campos de resultado vazios para preenchimento em campo

Esses relatorios sao opcionais e complementam o bloco universal.
Uteis quando ha tempo de preparar antes de ir ao campo.

**Implementar na Fase 9 (apos o core estar funcionando).**

---

## Arquitetura Tecnica

### Pipeline OCR (foto do relatorio)

```
Frontend                          Supabase Storage
--------                          ----------------
1. Usuario tira foto
   ou faz upload                  2. Upload para bucket
                                     "report-images"
                                     path: {fazenda_id}/{timestamp}.jpg

Frontend                          Edge Function (report-ocr)
--------                          --------------------------
3. Invoca Edge Function           4. Recebe image_path (string leve)
   body: {                        5. Download imagem do Storage
     image_path,                     (server-to-server, sem limite)
     report_type,                 6. Converte para base64
     context: {                   7. Monta prompt enriquecido:
       fazenda_id,                   - Tipo de servico
       protocol_id (se souber)       - Animais conhecidos da fazenda
     }                               - Racas validas
   }                                 - Correcoes anteriores
                                  8. Chama Gemini 2.0 Flash Vision
                                  9. Pos-processamento:
                                     - Fuzzy match registros vs BD
                                     - Validacao de racas
                                     - Confidence scoring
                                  10. Retorna JSON estruturado

Frontend
--------
11. Exibe tela de revisao (foto lado a lado com dados)
12. Usuario corrige campos com baixa confianca
13. Salva dados no BD via RPC atomica
14. Salva correcoes em ocr_corrections (aprendizado)
15. Registra import em report_imports (historico + rollback)
```

### Identificacao do Contexto (sem QR)

Quando a foto vem do bloco universal (sem QR), o sistema identifica o contexto assim:

1. OCR le: tipo de servico (checkbox marcado) + fazenda + data
2. Query unica indexada: busca protocolo/sessao correspondente
   - Tipo + fazenda + data geralmente identifica unicamente
   - Se ambiguo: cruza registros lidos contra receptoras de cada protocolo candidato
   - Se ainda ambiguo: picker para usuario escolher
3. Com o protocolo identificado, carrega lista de animais esperados para match

Performance: uma query indexada (~50ms). O Gemini (~5-10s) e 99% do tempo total.

### Camada de Dados — RPCs Atomicas

Para evitar duplicacao de logica entre Hub Campo e Hub Escritorio,
todas as operacoes batch sao centralizadas em RPCs no banco:

| RPC | Operacao |
|-----|----------|
| `criar_protocolo_passo1_atomico` | Ja existe — P1 |
| `confirmar_p2_batch` | NOVA — confirma/marca perdas em batch |
| `registrar_te_batch` | NOVA — insere transferencias em batch |
| `registrar_dg_batch` | NOVA — insere diagnosticos em batch |
| `registrar_sexagem_batch` | NOVA — insere sexagens em batch |
| `registrar_aspiracao_batch` | NOVA — insere pacote + aspiracoes_doadoras |
| `reverter_import` | NOVA — desfaz uma importacao inteira |

Cada RPC e transacional — se qualquer operacao falhar, tudo e revertido.

Os hooks do Hub Campo podem ser migrados para usar essas mesmas RPCs futuramente,
eliminando duplicacao. Mas isso nao e pre-requisito — pode ser feito depois.

---

## Tabelas Novas (SQL)

```sql
-- Historico de relatorios importados (OCR ou manual)
CREATE TABLE report_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,          -- 'p1','p2','te','dg','sexagem','aspiracao'
  image_path text,                    -- path no Supabase Storage (null se manual)
  extracted_data jsonb,               -- JSON bruto do Gemini (null se manual)
  final_data jsonb NOT NULL,          -- JSON final apos correcoes do usuario
  status text DEFAULT 'processing',   -- 'processing','review','completed','reverted'
  fazenda_id uuid REFERENCES fazendas(id),
  protocolo_id uuid,                  -- referencia ao protocolo (se aplicavel)
  pacote_aspiracao_id uuid,           -- referencia a aspiracao (se aplicavel)
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  reverted_at timestamptz             -- quando foi desfeito (null = ativo)
);

-- Correcoes para aprendizado do OCR
CREATE TABLE ocr_corrections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,          -- 'p1','p2','te','dg','sexagem','aspiracao'
  field_type text NOT NULL,           -- 'registro','raca','resultado','viaveis'...
  raw_value text NOT NULL,            -- o que a IA leu
  corrected_value text NOT NULL,      -- o que o usuario corrigiu
  fazenda_id uuid REFERENCES fazendas(id),
  veterinario text,                   -- contexto da caligrafia
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ocr_corrections_lookup
  ON ocr_corrections(fazenda_id, report_type, field_type);

CREATE INDEX idx_report_imports_status
  ON report_imports(status, created_at DESC);
```

---

## Estrutura de Arquivos

```
src/
  pages/
    escritorio/
      EscritorioHome.tsx              # Dashboard do hub
      EscritorioAspiracao.tsx         # Aspiracao (OCR + manual)
      EscritorioDG.tsx                # DG (OCR + manual)
      EscritorioTE.tsx                # TE (OCR + manual)
      EscritorioSexagem.tsx           # Sexagem (OCR + manual)
      EscritorioP1.tsx                # P1 (manual + OCR melhor esforco)
      EscritorioP2.tsx                # P2 (OCR + manual)
      EscritorioHistorico.tsx         # Historico de importacoes + rollback

  components/
    escritorio/
      ReportScanner.tsx               # Upload foto + progress feedback
      OcrReviewGrid.tsx               # Grid de revisao (foto + dados side-by-side)
      ManualEntryGrid.tsx             # Grid teclado (Tab/Enter/autocomplete)
      AnimalAutocomplete.tsx          # Busca registro com typeahead
      ConfidenceBadge.tsx             # Indicador verde/amarelo/vermelho
      ServiceTypeSelector.tsx         # Seletor de tipo de servico
      EntryModeSwitch.tsx             # Toggle: Foto | Manual
      MultiPageUpload.tsx             # Upload de multiplas paginas

  hooks/
    escritorio/
      useReportOcr.ts                 # Pipeline OCR completo
      useOcrCorrections.ts            # CRUD correcoes + carrega para prompt
      useEscritorioDG.ts              # Chama RPC registrar_dg_batch
      useEscritorioTE.ts              # Chama RPC registrar_te_batch
      useEscritorioSexagem.ts         # Chama RPC registrar_sexagem_batch
      useEscritorioP1.ts              # Chama RPC criar_protocolo_passo1_atomico
      useEscritorioP2.ts              # Chama RPC confirmar_p2_batch
      useEscritorioAspiracao.ts       # Chama RPC registrar_aspiracao_batch
      useReportImports.ts             # Historico + rollback

  utils/
    escritorio/
      fuzzyMatch.ts                   # Algoritmo de fuzzy matching para registros
      postProcess.ts                  # Pos-processamento OCR (match + validacao)

supabase/
  functions/
    report-ocr/
      index.ts                        # Edge Function OCR
  migrations/
    XXXXXX_create_report_imports.sql   # Tabelas novas
    XXXXXX_create_batch_rpcs.sql      # RPCs atomicas
```

---

## Edge Function: report-ocr

### Estrutura

```
supabase/functions/report-ocr/index.ts

Recebe:
{
  image_path: string,       // path no Storage
  report_type: string,      // 'p1'|'p2'|'te'|'dg'|'sexagem'|'aspiracao'
  context: {
    fazenda_id: string,
    protocol_id?: string,   // se ja sabe qual protocolo
  }
}

Processo:
1. Download imagem do Storage (server-to-server)
2. Busca API key do Gemini (tabela embryo_score_secrets)
3. Busca animais conhecidos da fazenda (query no BD)
4. Busca correcoes recentes (tabela ocr_corrections, limit 20)
5. Monta prompt especifico para o report_type
6. Chama Gemini 2.0 Flash Vision (response_mime_type: application/json)
7. Pos-processamento: fuzzy match, validacao
8. Retorna JSON estruturado com confidence scores

Retorna:
{
  header: {
    fazenda: { value, confidence },
    data: { value, confidence },
    veterinario: { value, confidence },
    tecnico: { value, confidence },
    servico_detectado: string
  },
  rows: [
    {
      numero: number,
      registro: { value, confidence, matched_db, matched_value? },
      raca: { value, confidence },
      resultado: { value, confidence },
      obs: { value, confidence }
    }
  ],
  metadata: {
    pagina: string,         // "1/2" se detectado
    total_rows: number
  }
}
```

### Prompts por Tipo

Cada report_type tem um prompt especifico que diz ao Gemini:
- Que tipo de relatorio esperar
- Que formato de resultado interpretar na coluna RESULTADO
- Lista de animais conhecidos para desambiguacao
- Correcoes anteriores como referencia

O prompt inclui:
- Instrucoes gerais de OCR para escrita a mao
- Formato JSON de retorno esperado
- Animais conhecidos da fazenda (para fuzzy match no Gemini)
- Top 20 correcoes recentes (few-shot learning)

Deploy: `supabase functions deploy report-ocr --no-verify-jwt`

---

## Fluxo de Cada Servico no Escritorio

### DG — Diagnostico de Gestacao

**Modo OCR:**
1. Upload foto(s) do relatorio
2. OCR detecta servico = DG, le fazenda + data
3. Sistema identifica protocolo: query TE por fazenda+data
4. Carrega receptoras esperadas (que receberam embriao nessa TE)
5. OCR faz match: registro lido vs receptoras esperadas
6. Tela de revisao: foto esquerda, grid direita
   - Cada linha: receptora (pre-matched) + resultado (P/V/R) + confidence
   - Verde = alta confianca, Amarelo = revisar, Vermelho = nao reconhecido
7. Usuario corrige o necessario
8. Preenche campos manuais: data do DG, veterinario, tecnico
9. Salva via RPC `registrar_dg_batch` (atomico)
10. Registra em report_imports + salva correcoes em ocr_corrections

**Modo Manual:**
1. Seleciona fazenda + data da TE
2. Sistema carrega receptoras aptas (mesmo que OCR)
3. Grid com todas as receptoras listadas
4. Atalhos de teclado: P, V, R por linha (auto-avanca)
5. "Marcar restantes como Prenhe" para trabalhar por excecao
6. Salva via mesma RPC

**Tempo estimado (30 receptoras): OCR ~2min, Manual ~1min**

### Sexagem

Identico ao DG, mas:
- Filtro: receptoras com status PRENHE ou PRENHE_RETOQUE
- Resultados: F (Femea), M (Macho), S (Sem sexo), D (Dois sexos), V (Vazia)
- Atalhos: F, M, S, D, V
- RPC: `registrar_sexagem_batch`

### P2 — Confirmacao de Protocolo

**Modo OCR:**
1. OCR le registros + resultado (check/X)
2. Sistema carrega receptoras do P1 correspondente
3. Match + revisao

**Modo Manual:**
1. Seleciona protocolo
2. Todas as receptoras aparecem como "Apta" por padrao
3. Usuario busca registro da perda → marca como perda
4. Trabalho por excecao (so marca perdas)
5. RPC: `confirmar_p2_batch`

**Tempo estimado: 30seg (tipicamente 2-3 perdas)**

### TE — Transferencia de Embrioes

**Modo OCR:**
1. OCR le registro da receptora + codigo do embriao (campo texto)
2. Match receptoras contra P2 confirmadas
3. Match embrioes contra lote FIV selecionado

**Modo Manual:**
1. Seleciona protocolo + lote FIV
2. Grid: receptoras pre-carregadas, campo embriao editavel
3. Autocomplete de embrioes disponiveis no lote
4. Tab navega entre campos de embriao
5. RPC: `registrar_te_batch`

### Aspiracao

**Modo OCR (relatorio externo — folha rosa ou similar):**
1. OCR tenta ler formato desconhecido
2. Prompt generico para aspiracao (busca registro + numeros de oocitos)
3. Match doadoras contra BD (~80% match)
4. Doadoras nao encontradas: flag como "nova" para criacao
5. Revisao com atencao especial nos numeros

**Modo OCR (bloco PassaGene):**
1. Template conhecido, posicoes previsíveis
2. Confianca mais alta

**Modo Manual:**
1. Seleciona fazenda
2. Grid: digita registro → autocomplete → Tab → campos numericos
3. ATR → DEG → EXP → DES → VIA (Tab entre campos)
4. Total calcula automatico
5. Enter → proxima doadora
6. RPC: `registrar_aspiracao_batch`

### P1 — Protocolo (1o Passo)

O mais complexo. Receptoras podem ser novas.

**Modo OCR (melhor esforco):**
1. OCR tenta ler nomes/registros do relatorio (pode ser caotico)
2. Confianca geralmente baixa — tudo vai para revisao
3. Serve como ponto de partida, nao como resultado final

**Modo Manual (principal):**
1. Seleciona fazenda
2. Grid: digita registro → autocomplete sugere receptoras da fazenda
3. Se encontrou no BD: preenche raca automaticamente
4. Se nao encontrou: marca como "Nova", campo raca editavel
5. Enter → proxima linha
6. Ao salvar: cria receptoras novas + protocolo via RPC existente

---

## Tela de Revisao OCR (componente core)

Layout split-screen fixo:

```
+----------------------------+------------------------------+
|                            |                              |
|    FOTO ORIGINAL           |    DADOS EXTRAIDOS           |
|                            |                              |
|    - Zoom/pan              |    Grid editavel             |
|    - Pode rotacionar       |    Cada campo: editavel      |
|                            |    Cores de confianca:       |
|                            |      Verde  = alta (>90%)    |
|                            |      Amarelo = media (70-90%)|
|                            |      Vermelho = baixa (<70%) |
|                            |                              |
|                            |    Campos manuais:           |
|                            |      Data, Vet, Tecnico      |
|                            |                              |
|                            |    [Salvar]  [Cancelar]      |
+----------------------------+------------------------------+
```

Upload de multiplas paginas suportado:
- Botao "+ Adicionar pagina" para relatorios que usam mais de 1 folha
- Paginas processadas separadamente e concatenadas
- Numeracao Pag ___/___ do bloco ajuda a identificar ordem

---

## Sistema de Aprendizado

### Fluxo

1. OCR extrai dados com confidence scores
2. Usuario corrige campos errados na tela de revisao
3. Ao salvar, sistema compara dados originais vs corrigidos
4. Diferencas sao salvas em `ocr_corrections`
5. Proximas leituras incluem top 20 correcoes recentes no prompt do Gemini
6. O Gemini "aprende" padroes via few-shot examples no prompt

### O que e salvo

| Campo | Exemplo |
|-------|---------|
| report_type | 'dg' |
| field_type | 'registro' |
| raw_value | 'REC-0285' |
| corrected_value | 'REC-0235' |
| fazenda_id | uuid da fazenda |
| veterinario | 'Dr. Silva' |

### Consulta para enriquecer prompt

```sql
SELECT raw_value, corrected_value, field_type
FROM ocr_corrections
WHERE fazenda_id = $1
  AND report_type = $2
ORDER BY created_at DESC
LIMIT 20
```

### Evolucao esperada

- Primeiras importacoes: ~70-85% acuracia (depende da caligrafia)
- Apos 10-20 correcoes: ~85-92% (padroes por fazenda/vet aprendidos)
- Com blocos PassaGene padronizados: ~92-97% (template conhecido)

---

## Historico e Rollback

### Historico de Importacoes

Pagina `/escritorio/historico` mostra todas as importacoes:

- Data, tipo de servico, fazenda, qtd de registros
- Status: processando | revisao | completo | desfeito
- Link para ver foto original
- Botao "Desfazer" (disponivel por 48h)

### Rollback — Como Funciona

Cenario: usuario importou DG com fazenda errada.

1. Vai ao historico, encontra a importacao
2. Clica "Desfazer importacao" → confirmacao
3. Sistema executa RPC `reverter_import`:
   - Le `final_data` do report_imports (JSON com tudo que foi salvo)
   - Deleta os diagnosticos criados por essa importacao
   - Reverte status das receptoras para o estado anterior
   - Marca import como `reverted`
4. Tudo atomico — reverte tudo ou nada
5. Usuario pode reimportar com dados corretos

Prazo de 48h porque apos isso os dados podem ter sido usados
em etapas seguintes (ex: DG alimenta Sexagem).

---

## Dependencias / Pacotes Novos

| Pacote | Finalidade | Tamanho |
|--------|-----------|---------|
| `@react-pdf/renderer` | Gerar PDFs dos blocos para grafica | ~500KB |

Removido do plano: `fuse.js` — substituido por funcao customizada de match
(prefixo exato + tolerancia numerica) mais precisa para registros de animais.

Infraestrutura existente reutilizada:
- Gemini API (chave em embryo_score_secrets)
- Supabase Edge Functions
- Supabase Storage
- Supabase Database (PostgreSQL)

---

## Rotas

```
/escritorio                  → EscritorioHome
/escritorio/dg               → EscritorioDG
/escritorio/sexagem          → EscritorioSexagem
/escritorio/protocolo-p1     → EscritorioP1
/escritorio/protocolo-p2     → EscritorioP2
/escritorio/te               → EscritorioTE
/escritorio/aspiracao        → EscritorioAspiracao
/escritorio/historico        → EscritorioHistorico
```

Hub no banco:
```sql
INSERT INTO hubs (id, code, name, description, routes, display_order)
VALUES (
  gen_random_uuid(),
  'escritorio',
  'Escritorio',
  'Cadastro de relatorios de campo',
  ARRAY[
    '/escritorio',
    '/escritorio/dg',
    '/escritorio/sexagem',
    '/escritorio/protocolo-p1',
    '/escritorio/protocolo-p2',
    '/escritorio/te',
    '/escritorio/aspiracao',
    '/escritorio/historico'
  ],
  3
);
```

---

## Custo Operacional

| Item | Custo estimado |
|------|---------------|
| Gemini 2.0 Flash por scan | ~R$ 0,01 |
| 50 relatorios/mes | ~R$ 0,50 |
| 200 relatorios/mes | ~R$ 2,00 |
| Supabase Edge Functions | Gratis (plano atual) |
| Supabase Storage (fotos) | ~R$ 0,12/GB/mes |
| **Total estimado** | **< R$ 5/mes** |

---

## Riscos Identificados e Mitigacoes

### R1: RPCs existentes podem nao estar nos migrations
`criar_protocolo_passo1_atomico` e `encerrar_sessao_te` sao referenciadas
no codigo mas NAO existem nos arquivos de migration. Podem ter sido criadas
manualmente no Dashboard.
**Acao:** Verificar existencia no Dashboard antes de implementar. Exportar SQL.

### R2: RLS bloqueia inserts se RPCs nao forem SECURITY DEFINER
Todas as tabelas alvo tem RLS ativo. Writes exigem is_admin_or_operacional().
**Acao:** Todas as RPCs batch devem ser SECURITY DEFINER com validacao interna
de permissao. Padrao: SECURITY DEFINER + IF NOT is_admin_or_operacional() THEN RAISE.

### R3: Transicoes de status devem ser validadas em dois lugares
Frontend valida antes de chamar RPC (UX). RPC valida dentro da transacao (seguranca).
Se receptora nao esta no status correto, RPC aborta transacao inteira.

### R4: Constraint unica de embriao na TE
`unq_embriao_te_realizada` impede transferir mesmo embriao duas vezes.
**Acao:** Validar no frontend E na RPC antes do insert batch.

### R5: database.types.ts precisa ser regenerado
Apos criar tabelas e RPCs novas, regenerar types:
`supabase gen types typescript --project-id twsnzfzjtjdamwwembzp > src/lib/database.types.ts`

### R6: Edge Function deploy com --no-verify-jwt
Sem essa flag, invocacao retorna 401 silencioso (bug documentado na MEMORY.md).
**Acao:** SEMPRE deploiar com `--no-verify-jwt`.

### R7: Invocar Edge Function com fetch direto (nao supabase.functions.invoke)
O projeto ja documentou bugs com `supabase.functions.invoke` (ver useDailySummary).
**Acao:** Usar fetch direto com headers manuais para maior confiabilidade.

### R8: Ordem de execucao SQL importa
Tabelas antes de indices, indices antes de RPCs, RPCs antes do hub.
**Acao:** Entregar SQL unico com ordem correta.

### R9: TanStack Query cache invalidation
Apos salvar batch no escritorio, invalidar mesmas query keys que o Hub Campo usa.
Se nao invalidar, dados ficam stale nas paginas existentes.

### R10: Fuzzy match customizado em vez de fuse.js
Registros de animais sao semi-estruturados (prefixo + numero).
Match customizado (prefixo exato + tolerancia numerica) e mais preciso
e elimina dependencia externa.

---

## Checklist Pre-Implementacao

- [ ] Verificar no Supabase Dashboard se `criar_protocolo_passo1_atomico` existe
- [ ] Verificar se `encerrar_sessao_te` existe
- [ ] Exportar ambas (se existirem) para `saved_migrations/`
- [ ] Verificar que `GEMINI_API_KEY` esta como secret das Edge Functions
- [ ] Confirmar que bucket `report-images` pode ser criado no Storage

---

## Checklist Pos-Cada-Fase

- [ ] NENHUMA funcionalidade existente quebrou (navegar todos os hubs)
- [ ] Paginas do Hub Campo funcionam normalmente
- [ ] Login/logout funciona
- [ ] Permissoes respeitadas (admin ve tudo, operacional ve o permitido, cliente nao ve escritorio)
- [ ] Build passa sem erros de TypeScript

---

## Fases de Implementacao

### Fase 1 — Estrutura Base
Objetivo: hub navegavel com paginas placeholder. Zero logica de negocio.

Arquivos EXISTENTES a modificar (4 arquivos, apenas adicoes):
- `src/App.tsx` — 8 lazy imports + 8 routes dentro de MainLayout
- `src/components/layout/HubTabs.tsx` — 1 entry em hubIcons (escritorio: FileText)
- `src/components/layout/Sidebar.tsx` — 8 entries em routeIcons + routeLabels
- `src/components/layout/MobileNav.tsx` — 8 entries em routeIcons + routeLabels

Arquivos NOVOS a criar (8 paginas placeholder):
- `src/pages/escritorio/EscritorioHome.tsx`
- `src/pages/escritorio/EscritorioDG.tsx`
- `src/pages/escritorio/EscritorioSexagem.tsx`
- `src/pages/escritorio/EscritorioP1.tsx`
- `src/pages/escritorio/EscritorioP2.tsx`
- `src/pages/escritorio/EscritorioTE.tsx`
- `src/pages/escritorio/EscritorioAspiracao.tsx`
- `src/pages/escritorio/EscritorioHistorico.tsx`

SQL a executar no Dashboard:
- CREATE TABLE report_imports (com FKs para fazendas, profiles)
- CREATE TABLE ocr_corrections (com FK para fazendas)
- CREATE INDEX idx_ocr_corrections_lookup
- CREATE INDEX idx_report_imports_status
- INSERT INTO hubs (escritorio)

Verificacao pos-fase:
- [ ] Hub aparece na navegacao para admin
- [ ] Todas as 8 paginas carregam sem erro
- [ ] NENHUM hub existente foi afetado
- [ ] Build passa sem erros TypeScript

### Fase 2 — RPCs Atomicas
Objetivo: logica de negocio no banco, testada isoladamente.

SQL a executar no Dashboard (ordem importa):
1. `registrar_dg_batch` — SECURITY DEFINER + validacao status SERVIDA
2. `registrar_sexagem_batch` — SECURITY DEFINER + validacao status PRENHE/PRENHE_RETOQUE
3. `confirmar_p2_batch` — SECURITY DEFINER + validacao status EM_SINCRONIZACAO
4. `registrar_te_batch` — SECURITY DEFINER + validacao embriao unico + status SINCRONIZADA
5. `registrar_aspiracao_batch` — SECURITY DEFINER
6. `reverter_import` — SECURITY DEFINER + validacao prazo 48h
7. GRANT EXECUTE de todas para role authenticated

Cada RPC deve:
- Ser SECURITY DEFINER com SET search_path = public
- Validar is_admin_or_operacional() no inicio
- Validar status de cada receptora/embriao antes de operar
- RAISE EXCEPTION em caso de violacao (reverte transacao inteira)

Teste: executar cada RPC manualmente no SQL Editor com dados reais.
Apos testar: regenerar database.types.ts

### Fase 3 — Edge Function report-ocr
Objetivo: OCR funcional para pelo menos 1 tipo de relatorio.

Implementacao:
- Criar `supabase/functions/report-ocr/index.ts`
- Copiar boilerplate CORS/error do `daily-summary` (padrao mais limpo)
- Usar Supabase client com SERVICE_ROLE_KEY
- Receber image_path (string), baixar do Storage (server-to-server)
- API key: Deno.env.get('GEMINI_API_KEY') || fallback embryo_score_secrets
- Gemini 2.0 Flash com response_mime_type: 'application/json'
- Timeout de 30s via AbortController
- Pos-processamento: fuzzy match customizado (sem fuse.js)

Deploy: `supabase functions deploy report-ocr --no-verify-jwt`

Frontend (hook):
- Usar fetch direto (nao supabase.functions.invoke)
- Upload imagem para Storage primeiro, enviar so o path

Teste: usar foto `relatorio aspiracao.jpeg` da raiz do projeto.

### Fase 4 — Componentes Compartilhados
Objetivo: componentes reutilizaveis para todas as paginas de servico.

Componentes:
- `ReportScanner.tsx` — upload foto + barra de progresso com etapas
- `OcrReviewGrid.tsx` — split foto esquerda + grid dados direita + confidence
- `ManualEntryGrid.tsx` — grid editavel com Tab/Enter/atalhos de teclado
- `AnimalAutocomplete.tsx` — typeahead contra BD (receptoras ou doadoras)
- `ConfidenceBadge.tsx` — badge verde (>90%) / amarelo (70-90%) / vermelho (<70%)
- `MultiPageUpload.tsx` — upload multiplas fotos + concatenar resultados
- `EntryModeSwitch.tsx` — toggle entre modo Foto e modo Manual

Utilidades:
- `src/utils/escritorio/matchRegistro.ts` — fuzzy match customizado
- `src/utils/escritorio/postProcess.ts` — pos-processamento OCR

Regra: nenhum componente depende de servico especifico.
Todos sao genericos e parametrizaveis.

### Fase 5 — DG (primeiro servico completo)
Objetivo: pipeline inteiro funcionando end-to-end para um servico.

Pagina EscritorioDG:
- Toggle Foto/Manual
- Modo OCR: upload → processamento → revisao side-by-side → salvar
- Modo Manual: seleciona fazenda + data_te → carrega receptoras → P/V/R por linha
- Atalhos de teclado: P, V, R (auto-avanca para proxima)
- "Marcar restantes como Prenhe" (trabalho por excecao)
- Campos manuais: data DG, veterinario, tecnico
- Salva via RPC registrar_dg_batch
- Registra em report_imports
- Salva correcoes em ocr_corrections
- Invalida query keys do TanStack: ['receptoras'], ['diagnosticos']

Teste end-to-end:
- [ ] Foto → OCR → revisao → salvar → verificar no BD
- [ ] Manual → preencher → salvar → verificar no BD
- [ ] Verificar que pagina DG do Hub Campo mostra dados novos (cache invalidado)
- [ ] Rollback via historico funciona

### Fase 6 — P2 + Sexagem
Mesma estrutura do DG, com diferencas:

P2:
- Carrega receptoras do P1 correspondente
- Todas marcadas como "Apta" por padrao
- Usuario so marca perdas (logica de excecao)
- RPC: confirmar_p2_batch
- Invalidar: ['protocolos'], ['receptoras']

Sexagem:
- Carrega receptoras PRENHE/PRENHE_RETOQUE
- Atalhos: F, M, S, D, V (auto-avanca)
- Logica de calculo de status final (calcularStatusFinal)
- RPC: registrar_sexagem_batch
- Invalidar: ['receptoras'], ['diagnosticos']

### Fase 7 — TE
- Selecao de protocolo + lote FIV
- Grid: receptoras do P2 + campo embriao editavel
- Autocomplete de embrioes disponiveis no lote
- Validacao: embriao nao pode estar em duas linhas (duplicata no batch)
- Validacao: embriao nao pode ter sido transferido antes (constraint BD)
- RPC: registrar_te_batch
- Invalidar: ['transferencias'], ['embrioes'], ['receptoras']

### Fase 8 — Aspiracao
OCR para relatorios externos (folha rosa e similares):
- Prompt generico para aspiracao
- Match doadoras contra BD (~80%)
- Flag doadoras nao encontradas como "nova"

OCR para bloco PassaGene:
- Template conhecido, confianca mais alta

Manual:
- Grid: registro → autocomplete → Tab → campos numericos
- ATR → DEG → EXP → DES → VIA (Tab navega)
- Total calcula automatico (soma dos 5 campos)
- Enter → proxima doadora
- Criacao inline de doadoras novas (marcadas como isNew)

RPC: registrar_aspiracao_batch
Invalidar: ['aspiracoes'], ['doadoras']

### Fase 9 — P1 Manual
O mais complexo em termos de UX:

- Grid: digita registro → autocomplete contra receptoras da fazenda
- Se encontrou: preenche raca auto
- Se nao encontrou: marca como "Nova", campo raca editavel
- Ao salvar: cria receptoras novas + receptora_fazenda_historico + protocolo
- Usa RPC existente criar_protocolo_passo1_atomico (verificar existencia primeiro!)
- OCR como melhor esforco (confianca geralmente baixa para relatorios caoticos)
- Invalidar: ['protocolos'], ['receptoras']

### Fase 10 — PDFs dos Blocos
- Instalar @react-pdf/renderer
- Gerar PDF master do Bloco Universal (5 colunas, 25 linhas, A4)
- Gerar PDF master do Bloco Aspiracao (colunas oocitos, 20 linhas, A4)
- Pagina de download na EscritorioHome
- Design em alta resolucao para offset/grafica
- Versao v1.0 no rodape de cada bloco

### Fase 11 — Aprendizado + Historico
- Salvamento automatico de correcoes ao confirmar revisao
- Enriquecimento de prompts: top 20 correcoes por fazenda+tipo
- Pagina EscritorioHistorico com fotos originais linkadas
- Rollback de importacoes (botao desfazer, prazo 48h)
- Estatisticas de acuracia por servico/fazenda (opcional, baixa prioridade)

### Fase 12 — Relatorios Pre-preenchidos (Premium)
- Gerar relatorios com dados do BD (receptoras ja listadas por nome)
- QR code com ID do protocolo (identificacao instantanea pelo OCR)
- Impressao sob demanda na pagina do protocolo/sessao
- OCR otimizado: detecta QR → carrega contexto completo → confianca maxima
