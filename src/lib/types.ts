// Database Types
export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  endereco?: string;
  created_at?: string;
}

export interface Fazenda {
  id: string;
  cliente_id: string;
  nome: string;
  responsavel?: string;
  contato_responsavel?: string;
  localizacao?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface Doadora {
  id: string;
  created_at?: string;
  fazenda_id: string;
  nome?: string;
  registro: string;
  raca?: string;
  gpta?: number;
  controle_leiteiro?: number;
  beta_caseina?: string;
  pai_registro?: string;
  pai_nome?: string;
  mae_registro?: string;
  mae_nome?: string;
  genealogia_texto?: string;
  link_abcz?: string;
  foto_url?: string;
  disponivel_aspiracao?: boolean;
  classificacao_genetica?: '1_estrela' | '2_estrelas' | '3_estrelas' | 'diamante' | null;
}

export interface Receptora {
  id: string;
  identificacao: string;
  nome?: string;
  status_reprodutivo?: string;
  fazenda_atual_id?: string;
  data_provavel_parto?: string;
  created_at?: string;
}

export interface ProtocoloSincronizacao {
  id: string;
  fazenda_id: string;
  data_inicio: string;
  data_retirada?: string;
  responsavel_inicio: string;
  responsavel_retirada?: string;
  status?: string;
  pacote_producao_id?: string;
  observacoes?: string;
  passo2_data?: string;
  passo2_tecnico_responsavel?: string;
  created_at?: string;
}

export interface ProtocoloReceptora {
  id: string;
  protocolo_id: string;
  receptora_id: string;
  evento_fazenda_id?: string; // Renomeado de fazenda_atual_id: apenas para auditoria, não usado na lógica
  data_inclusao: string;
  data_retirada?: string;
  status: string;
  motivo_inapta?: string;
  observacoes?: string;
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
  created_at?: string;
}

export interface PacoteAspiracao {
  id: string;
  fazenda_id: string;
  fazenda_destino_id: string;
  data_aspiracao: string;
  horario_inicio?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  status: 'EM_ANDAMENTO' | 'FINALIZADO';
  total_oocitos?: number;
  usado_em_lote_fiv?: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AspiracaoDoadora {
  id: string;
  pacote_aspiracao_id?: string;
  doadora_id: string;
  fazenda_id: string;
  data_aspiracao: string;
  horario_aspiracao?: string;
  hora_final?: string;
  atresicos?: number;
  degenerados?: number;
  expandidos?: number;
  desnudos?: number;
  viaveis?: number;
  total_oocitos?: number;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  recomendacao_touro?: string;
  observacoes?: string;
  created_at?: string;
}

// Campos dinâmicos em JSONB - estruturas por raça
export interface DadosGeneticosHolandesa {
  nm_dolares?: number; // NM$ (Net Merit Dollars)
  tpi?: number; // TPI (Total Performance Index)
  ptat?: number; // PTAT (Predicted Transmitting Ability - Type)
  udc?: number; // UDC (Udder Composite)
  flc?: number; // FLC (Foot & Leg Composite)
  bwc?: number; // BWC (Body Weight Composite)
  gpa_lpi?: number; // GPA LPI
  pro_dolar?: number; // PRO$ (Profit Dollars)
  [key: string]: unknown; // Permite campos adicionais
}

export interface DadosProducaoHolandesa {
  leite_kg?: number;
  gordura_kg?: number;
  gordura_porcent?: number;
  proteina_kg?: number;
  proteina_porcent?: number;
  eficiencia_alimentar?: number;
  bmr?: number; // Body Maintenance Requirement
  eficiencia_metano?: number;
  [key: string]: unknown;
}

export interface DadosConformacaoHolandesa {
  conformacao_geral?: number;
  forca_leiteira?: number;
  sistema_mamario?: number;
  pernas_pes?: number;
  garupa?: number;
  estatura?: number;
  largura_peito?: number;
  profundidade_corpo?: number;
  angularidade?: number;
  [key: string]: unknown;
}

export interface DadosSaudeReproducaoHolandesa {
  perm_rebanho?: number; // Permanência no Rebanho
  ccs?: number; // Contagem de Células Somáticas
  facilidade_parto?: number;
  fertilidade_filhas?: number;
  facilidade_parto_materna?: number;
  velocidade_ordenha?: number;
  temperamento?: number;
  persistencia_lactacao?: number;
  resistencia_mastite?: number;
  resistencia_doencas_metabolicas?: number;
  immunity_bezerra?: number;
  escore_condicao_corporal?: number;
  [key: string]: unknown;
}

export interface DadosGeneticosNelore {
  // SUMÁRIO ANCP
  sumario_ancp?: {
    mp120?: number;
    dpn?: number;
    dp210?: number;
    dp365?: number;
    dp450?: number;
    dpe365?: number;
    dpe450?: number;
    dipp?: number;
    dstay?: number;
    d3p?: number;
    daol?: number;
    dacab?: number;
    mgete?: number;
    mgetecr?: number;
    mgetere?: number;
    mgetecd?: number;
    mgetef1?: number;
  };
  // SUMÁRIO ABCZ PMGZ
  sumario_abcz_pmgz?: {
    pm_em?: number;
    pn_ed?: number;
    pd_ed?: number;
    pa_ed?: number;
    ps_ed?: number;
    ipp?: number; // DIAS
    pe365?: number; // cm
    pe450?: number; // cm
    stay?: number; // %
    ec?: number;
    prec?: number;
    musc_s?: number;
    adl?: number; // cm
    acab?: number; // mm
    marm?: number; // %
    abcz?: number;
  };
  // GENEPLUS
  genepius?: {
    pn?: number;
    p120?: number;
    tm120?: number;
    pd?: number;
    tmd?: number;
    ps?: number;
    gpd?: number;
    stay?: number;
    pes?: number;
    ipp?: number;
    aol?: number;
    egs?: number;
    mar?: number;
    car?: number;
    iqg?: number;
  };
  [key: string]: unknown;
}

export interface MedidasFisicasNelore {
  cc?: number; // Circunferência do Coração
  ag?: number; // Altura da Garupa
  cg?: number; // Circunferência da Garupa
  lg?: number; // Largura da Garupa
  pt?: number; // Perímetro Torácico
  pc?: number; // Profundidade do Corpo
  ce?: number; // Comprimento Escápula
  idade_medicao?: number; // Meses
  peso_medicao?: number; // kg
  [key: string]: unknown;
}

export interface DadosGeneticosGirolando {
  gpta_leite?: number; // GPTA Leite (kg)
  ipplg?: number; // Índice de Produção e Persistência na Lactação
  ietg?: number; // Índice de Eficiência Tropical
  ifpg?: number; // Índice Facilidade de Parto
  ireg?: number; // Composto Reprodução
  csmg?: number; // Composto Sistema Mamário
  esug?: number; // Composto Sistema Locomotor
  ptapn?: number; // PTA Peso ao Nascimento (kg)
  ptapg?: number; // PTA Período Gestacional (dias) - ou "ROBUSTO"
  idade_primeiro_parto?: number; // dias
  intervalo_partos?: number; // dias
  longevidade?: number;
  tolerancia_estresse?: number; // TE
  [key: string]: unknown;
}

export interface DadosProducaoGirolando {
  leite_kg?: number;
  gordura_kg?: number;
  gordura_porcent?: number;
  proteina_kg?: number;
  proteina_porcent?: number;
  [key: string]: unknown;
}

export interface Caseinas {
  beta_caseina?: string; // "A1A1", "A1A2", "A2A2"
  kappa_caseina?: string; // "AA", "AB", "BB"
  beta_lactoglobulina?: string; // "AA", "AB", "BB"
  [key: string]: unknown;
}

export interface OutrosDados {
  composicao_genetica?: string; // Ex: "5/8 HOLANDÊS + 3/8 GIR", "3/4 HOLANDÊS + 1/4 GIR"
  badges?: string[]; // Ex: ["A2A2", "GENOMAX", "SEMEXX", "GRAZINGPRO", "ROBOTREADY"]
  [key: string]: unknown;
}

export interface Touro {
  id: string;
  registro: string;
  nome: string;
  raca?: string;
  data_nascimento?: string;
  
  // Proprietário e fazenda
  proprietario?: string;
  fazenda_nome?: string;
  
  // Pedigree
  pai_registro?: string;
  pai_nome?: string;
  mae_registro?: string;
  mae_nome?: string;
  genealogia_texto?: string;
  
  // Links e mídia
  link_catalogo?: string;
  foto_url?: string;
  link_video?: string;
  
  // Campos dinâmicos (JSONB)
  dados_geneticos?: DadosGeneticosHolandesa | DadosGeneticosNelore | DadosGeneticosGirolando | Record<string, unknown>;
  dados_producao?: DadosProducaoHolandesa | DadosProducaoGirolando | Record<string, unknown>;
  dados_conformacao?: DadosConformacaoHolandesa | Record<string, unknown>;
  medidas_fisicas?: MedidasFisicasNelore | Record<string, unknown>;
  dados_saude_reproducao?: DadosSaudeReproducaoHolandesa | Record<string, unknown>;
  caseinas?: Caseinas;
  outros_dados?: OutrosDados;
  
  // Outros
  observacoes?: string;
  disponivel?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DoseSemen {
  id: string;
  touro_id: string; // Referência ao touro do catálogo
  cliente_id: string; // Cliente que possui a dose
  tipo_semen?: 'CONVENCIONAL' | 'SEXADO';
  quantidade?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LoteFIV {
  id: string;
  pacote_aspiracao_id: string;
  data_abertura: string;
  status: 'ABERTO' | 'FECHADO';
  observacoes?: string;
  doses_selecionadas?: string[];
  disponivel_para_transferencia?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoteFIVAcasalamento {
  id: string;
  lote_fiv_id: string;
  aspiracao_doadora_id: string;
  dose_semen_id: string;
  quantidade_fracionada: number;
  quantidade_oocitos?: number;
  quantidade_embrioes?: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Embriao {
  id: string;
  lote_fiv_id: string;
  lote_fiv_acasalamento_id?: string;
  acasalamento_media_id?: string;
  identificacao?: string;
  numero_lote?: number; // Número sequencial do embrião dentro do lote (1, 2, 3, ...)
  classificacao?: string;
  tipo_embriao?: string;
  status_atual: 'FRESCO' | 'CONGELADO' | 'TRANSFERIDO' | 'DESCARTADO';
  cliente_id?: string; // ID do cliente dono do estoque (apenas para embriões congelados)
  fazenda_destino_id?: string;
  data_classificacao?: string;
  data_envase?: string;
  data_congelamento?: string;
  data_saida_laboratorio?: string;
  data_descarte?: string;
  localizacao_atual?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AcasalamentoEmbrioesMedia {
  id: string;
  lote_fiv_acasalamento_id: string;
  tipo_media: 'VIDEO' | 'IMAGEM';
  arquivo_url: string;
  arquivo_path: string;
  arquivo_nome: string;
  arquivo_tamanho?: number;
  mime_type?: string;
  duracao_segundos?: number;
  largura?: number;
  altura?: number;
  descricao?: string;
  data_gravacao?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoEmbriao {
  id: string;
  embriao_id: string;
  status_anterior?: string;
  status_novo: string;
  fazenda_id?: string;
  data_mudanca?: string;
  tipo_operacao?: 'CLASSIFICACAO' | 'DESTINACAO' | 'CONGELAMENTO' | 'DESCARTE' | 'TRANSFERENCIA';
  observacoes?: string;
  created_at?: string;
}

export interface TransferenciaEmbriao {
  id: string;
  embriao_id: string;
  receptora_id: string;
  evento_fazenda_id?: string; // Renomeado de fazenda_id: apenas para auditoria, não usado na lógica
  protocolo_receptora_id?: string;
  data_te: string;
  tipo_te?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  status_te: string;
  observacoes?: string;
  created_at?: string;
}

export interface DiagnosticoGestacao {
  id: string;
  receptora_id: string;
  data_te: string;
  tipo_diagnostico: string;
  data_diagnostico: string;
  resultado: string;
  sexagem?: string;
  numero_gestacoes?: number;
  observacoes?: string;
  veterinario_responsavel?: string; // Veterinário responsável pelo DG (diferente do da TE)
  tecnico_responsavel?: string; // Técnico responsável pelo DG (diferente do da TE)
  created_at?: string;
}

// View Types
export interface VProtocoloReceptoraStatus {
  protocolo_id: string;
  receptora_id: string;
  brinco: string;
  fase_ciclo: string;
  status_efetivo: string;
  motivo_efetivo?: string;
  data_te_prevista?: string;
  data_limite_te?: string;
}

export interface VTentativaTeStatus {
  receptora_id: string;
  brinco: string;
  status_tentativa: string;
  data_te: string;
  data_dg?: string;
  resultado_dg?: string;
  sexagem?: string;
}

export interface VEmbrioDisponivelTE {
  embriao_id: string;
  identificacao?: string;
  classificacao?: string;
  tipo_embriao?: string;
  lote_fiv_id?: string;
  d7_pronto?: boolean;
  d8_limite?: boolean;
  disponivel_fresco_hoje?: boolean;
  disponivel_congelado?: boolean;
  localizacao_atual?: string;
  status_atual: string;
}

// Histórico de fazendas da receptora
export interface ReceptoraFazendaHistorico {
  id: string;
  receptora_id: string;
  fazenda_id: string;
  data_inicio: string;
  data_fim?: string | null;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

// View: Fazenda atual da receptora
export interface VReceptoraFazendaAtual {
  receptora_id: string;
  fazenda_id_atual: string;
  data_inicio_atual: string;
  fazenda_nome_atual: string;
  cliente_id: string;
  cliente_nome: string;
}

// Helper type for receptora with calculated status
export interface ReceptoraComStatus extends Receptora {
  status_calculado: string;
  // Fazenda atual (quando carregada via view)
  fazenda_atual_id?: string;
  fazenda_nome_atual?: string;
  // Número de gestações (quando prenhe)
  numero_gestacoes?: number;
}

// Timeline event for receptora history
export interface ReceptoraHistoryEvent {
  tipo: 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM';
  data: string;
  descricao: string;
  detalhes?: string;
}