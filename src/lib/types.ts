// ========================================
// Tipos para Sistema de Hubs e Permissões
// ========================================

export interface Hub {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  routes: string[];
  display_order: number;
  created_at?: string;
}

export type UserType = 'admin' | 'cliente' | 'operacional';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  user_type: UserType;
  cliente_id?: string;
  active: boolean;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  profile_slug?: string;
  profile_public?: boolean;
  telefone?: string;
  localizacao?: string;
  profile_roles?: string[];
  specialties?: string[];
  service_description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserHubPermission {
  id: string;
  user_id: string;
  hub_code: string;
  can_access: boolean;
  created_at?: string;
}

export interface UserPermissions {
  profile: UserProfile;
  allowedHubs: string[];
  isAdmin: boolean;
  isCliente: boolean;
}

// ========================================
// Database Types
// ========================================

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  endereco?: string;
  logo_url?: string;
  created_at?: string;
}

export interface Fazenda {
  id: string;
  cliente_id: string;
  nome: string;
  sigla?: string;
  responsavel?: string;
  contato_responsavel?: string;
  localizacao?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface FazendaProfile {
  id: string;
  fazenda_id: string;
  owner_id: string;
  slug?: string;
  foto_url?: string;
  descricao?: string;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
  fazenda?: Fazenda;
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
  is_cio_livre?: boolean;
  status_cio_livre?: 'PENDENTE' | 'CONFIRMADA' | 'REJEITADA' | 'SUBSTITUIDA' | null;
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
  embrioes_clivados_d3?: number; // D3 - embriões clivados (opcional, usado como limite para D6/D7/D8)
  quantidade_embrioes?: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export type ClassificacaoEmbriao = 'BE' | 'BN' | 'BX' | 'BL' | 'BI' | 'Mo' | 'Dg';

export interface Embriao {
  id: string;
  lote_fiv_id: string;
  lote_fiv_acasalamento_id?: string;
  acasalamento_media_id?: string;
  queue_id?: string;
  identificacao?: string;
  numero_lote?: number; // Número sequencial do embrião dentro do lote (1, 2, 3, ...)
  classificacao?: ClassificacaoEmbriao | string;
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
  estrela?: boolean; // Embrião top/excelente (marcado com estrela pela bióloga)
  created_at?: string;
  updated_at?: string;
  embryo_analysis_queue?: {
    plate_frame_path?: string | null;
  } | null;
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

// EmbryoScore — análise por IA
export interface EmbryoScore {
  id: string;
  embriao_id: string;
  media_id?: string;

  // Score final
  embryo_score: number;
  classification: 'Excelente' | 'Bom' | 'Regular' | 'Borderline' | 'Inviavel';
  transfer_recommendation: 'priority' | 'recommended' | 'conditional' | 'second_opinion' | 'discard';
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
  gemini_classification?: string | null;
  gemini_reasoning?: string | null;
  kinetic_assessment?: string | null;

  // @deprecated Morfologia v1 — pipeline v6 uses visual_features instead
  icm_description?: string;
  te_description?: string;
  zp_status?: string;
  fragmentation?: string;

  // @deprecated Cinética v1 — pipeline v6 uses kinetic_intensity/harmony/symmetry/stability instead
  global_motion?: string;
  icm_activity?: string;
  te_activity?: string;
  blastocele_pulsation?: string;
  blastocele_pattern?: string;
  expansion_observed?: boolean;
  stability?: string;
  motion_asymmetry?: string;
  most_active_region?: string;
  viability_indicators?: string[];

  // Posição no vídeo
  position_description?: string;
  bbox_x_percent?: number;
  bbox_y_percent?: number;
  bbox_width_percent?: number;
  bbox_height_percent?: number;
  crop_image_path?: string;

  // Meta
  model_used?: string;
  morph_weight?: number;
  kinetic_weight?: number;
  prompt_version?: string;
  processing_time_ms?: number;

  // Histórico de versões
  is_current?: boolean;
  analysis_version?: number;

  // Feedback do biólogo (Sprint 5)
  biologo_concorda?: boolean | null;
  biologo_nota?: string | null;
  biologo_score?: number | null;
  biologo_estagio?: string | null;
  biologo_descricao_erros?: string[] | null;

  // @deprecated v3: Activity Score — pipeline v6 uses kinetic_intensity instead
  activity_score?: number;

  // @deprecated v3: Perfil cinético — pipeline v6 uses kinetic_* fields at top level
  temporal_analysis?: {
    core_activity?: number;
    periphery_activity?: number;
    peak_zone?: string;
    temporal_pattern?: string;
    activity_timeline?: number[];
    temporal_variability?: number;
    activity_symmetry?: number;
    focal_activity_detected?: boolean;
  };

  // v3: Predição de viabilidade (preparado para contexto futuro)
  viability_prediction?: {
    morph_based?: string;
    activity_based?: string;
    context_adjusted?: string | null;
    risk_factors?: string[];
    positive_factors?: string[];
    notes?: string;
  };

  // v3: Checklist binária de qualidade (5 critérios)
  quality_checklist?: {
    mci_distinct?: boolean;
    te_continuous?: boolean;
    spherical_shape?: boolean;
    no_fragmentation?: boolean;
    zp_uniform?: boolean;
    checklist_score?: string;
  };

  // Resposta bruta da IA (inclui _meta com info de divergência)
  raw_response?: {
    total_embryos_detected?: number;
    _meta?: {
      embryos_in_db: number;
      embryos_detected_by_ai: number;
      count_mismatch: boolean;
    };
    [key: string]: unknown;
  };

  // @deprecated v2: KNN + DINOv2 + MLP — pipeline v6 uses gemini_classification directly
  knn_classification?: string | null;
  knn_confidence?: number | null;
  knn_votes?: Record<string, number> | null;
  knn_neighbor_ids?: string[] | null;
  knn_real_bovine_count?: number | null;
  embedding?: number[] | null;
  kinetic_intensity?: number | null;
  kinetic_harmony?: number | null;
  kinetic_symmetry?: number | null;
  kinetic_stability?: number | null;
  kinetic_bg_noise?: number | null;
  motion_map_path?: string | null;
  composite_path?: string | null;
  biologist_classification?: string | null;
  biologist_agreed?: boolean | null;
  // @deprecated v2: MLP fields — pipeline v6 uses gemini_classification directly
  mlp_classification?: string | null;
  mlp_confidence?: number | null;
  mlp_probabilities?: Record<string, number> | null;
  // @deprecated v2: Combined KNN+MLP fields — pipeline v6 uses gemini_classification directly
  combined_source?: 'knn' | 'knn_mlp_agree' | 'knn_mlp_disagree' | 'mlp_only' | 'insufficient' | null;
  combined_classification?: string | null;
  combined_confidence?: number | null;

  // v2.1: IETS Grading (Gemini VLM)
  stage_code?: number | null;
  quality_grade?: number | null;
  visual_features?: {
    extruded_cells?: boolean;
    dark_cytoplasm?: boolean;
    zona_pellucida_intact?: boolean;
    debris_in_zona?: boolean;
    shape?: 'spherical' | 'oval' | 'irregular';
    [key: string]: any;
  } | null;
  ai_confidence?: number | null;

  created_at?: string;
}

export interface DetectedBbox {
  x_percent: number;      // centro X como % da largura do frame (0-100)
  y_percent: number;      // centro Y como % da altura do frame (0-100)
  width_percent: number;  // largura bbox como % (= diâmetro, quadrado)
  height_percent: number; // altura bbox como % (= diâmetro, quadrado)
  radius_px: number;      // raio original em pixels (para debug/ranking)
  per_bbox_confidence?: 'high' | 'medium' | 'low'; // confiança por bbox (multi-frame)
  detection_count?: number; // em quantos frames foi detectado (1-3)
}

export interface EmbryoAnalysisQueue {
  id: string;
  media_id: string;
  lote_fiv_acasalamento_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  retry_count?: number;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  // OpenCV circle detection (do browser)
  detected_bboxes?: DetectedBbox[] | null;
  detection_confidence?: 'high' | 'medium' | 'low' | null;
  expected_count?: number | null;
  // Crop JPEG paths no Storage (bússola visual para Gemini)
  crop_paths?: string[] | null;
  // v2: frame completo da placa no Storage (bucket: embryoscore)
  plate_frame_path?: string | null;
  // Real-time progress from Cloud Run pipeline
  progress_message?: string | null;
}

export interface EmbryoScoreConfig {
  id: string;
  morph_weight: number;
  kinetic_weight: number;
  model_name: string;
  prompt_version: string;
  active: boolean;
  notes?: string;
  calibration_prompt?: string;  // System prompt (NULL = usar padrão hardcoded)
  analysis_prompt?: string;     // User prompt de análise (NULL = usar padrão hardcoded)
  created_at?: string;
}

export interface EmbryoScoreSecret {
  id: string;
  key_name: string;
  key_value: string;
  updated_at?: string;
  updated_by?: string;
}

// EmbryoScore v2 — Referência do atlas (DINOv2 + classificação do biólogo)
export interface EmbryoReference {
  id: string;
  created_at?: string;
  lab_id: string;
  lote_fiv_id?: string | null;
  acasalamento_id?: string | null;
  embriao_id?: string | null;
  classification: ClassificacaoEmbriao;
  stage_iets?: number | null;
  embedding?: number[];
  kinetic_intensity?: number | null;
  kinetic_harmony?: number | null;
  kinetic_symmetry?: number | null;
  kinetic_stability?: number | null;
  kinetic_bg_noise?: number | null;
  best_frame_path?: string | null;
  motion_map_path?: string | null;
  composite_path?: string | null;
  crop_image_path?: string | null;
  pregnancy_result?: boolean | null;
  pregnancy_checked_at?: string | null;
  ai_suggested_class?: string | null;
  ai_confidence?: number | null;
  biologist_agreed?: boolean | null;
  review_mode?: 'standard' | 'quick' | 'expert';
  species: 'bovine_real' | 'bovine_rocha' | 'human';
  source: 'lab' | 'dataset_rocha' | 'dataset_kromp' | 'dataset_kaggle';
}

// KNN neighbor returned from match_embryos RPC
export interface KNNNeighbor {
  id: string;
  classification: string;
  similarity: number;
  species: string;
  kinetic_intensity?: number | null;
  kinetic_harmony?: number | null;
  pregnancy_result?: boolean | null;
  best_frame_path?: string | null;
  motion_map_path?: string | null;
}

// Embrião com score (para listagens)
export interface EmbriaoComScore extends Embriao {
  score?: EmbryoScore | null;
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

export interface Animal {
  id: string;
  embriao_id?: string;
  receptora_id?: string;
  fazenda_id?: string;
  cliente_id?: string;
  data_nascimento?: string;
  sexo?: 'FEMEA' | 'MACHO' | 'SEM_SEXO';
  raca?: string;
  pai_nome?: string;
  mae_nome?: string;
  observacoes?: string;
  created_at?: string;
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

// ========================================
// Tipos para dados com relacionamentos (joins do Supabase)
// ========================================

// Embrião com dados de acasalamento e lote expandidos
export interface EmbriaoComRelacionamentos extends Embriao {
  acasalamento?: LoteFIVAcasalamento & {
    aspiracao_doadora_id?: string;
    dose_semen_id?: string;
    doadora_registro?: string;
    touro_nome?: string;
  };
  lote_fiv?: LoteFIV & {
    pacote_aspiracao_id?: string;
  };
  doadora_registro?: string;
  touro_nome?: string;
}

// Dose de sêmen com dados do touro expandidos
export interface DoseSemenComTouro extends DoseSemen {
  touro?: Touro | {
    id: string;
    nome: string;
    registro?: string;
    raca?: string;
  };
}

// Protocolo receptora com dados do protocolo expandidos
export interface ProtocoloReceptoraComProtocolo extends ProtocoloReceptora {
  protocolos_sincronizacao?: ProtocoloSincronizacao;
}

// ========================================
// Tipos para inserção/atualização no banco
// ========================================

// Diagnóstico de gestação para inserção (sem id e created_at)
export interface DiagnosticoGestacaoInsert {
  receptora_id: string;
  data_te: string;
  tipo_diagnostico: string;
  data_diagnostico: string;
  resultado: string;
  sexagem?: string;
  numero_gestacoes?: number;
  observacoes?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
}

// Diagnóstico de gestação para atualização (com id)
export interface DiagnosticoGestacaoUpdate extends DiagnosticoGestacaoInsert {
  id: string;
}

// Dose de sêmen para inserção
export interface DoseSemenInsert {
  touro_id: string;
  cliente_id: string;
  tipo_semen?: 'CONVENCIONAL' | 'SEXADO';
  quantidade?: number;
}

// Touro para inserção
export interface TouroInsert {
  registro: string;
  nome: string;
  raca?: string;
  data_nascimento?: string;
  proprietario?: string;
  fazenda_nome?: string;
  pai_registro?: string;
  pai_nome?: string;
  mae_registro?: string;
  mae_nome?: string;
  genealogia_texto?: string;
  link_catalogo?: string;
  foto_url?: string;
  link_video?: string;
  dados_geneticos?: Record<string, unknown>;
  dados_producao?: Record<string, unknown>;
  dados_conformacao?: Record<string, unknown>;
  medidas_fisicas?: Record<string, unknown>;
  dados_saude_reproducao?: Record<string, unknown>;
  caseinas?: Caseinas;
  outros_dados?: OutrosDados;
  observacoes?: string;
  disponivel?: boolean;
}

// ========================================
// Tipos para sessões de transferência
// ========================================

export interface TransferenciaSessao {
  id?: string;
  fazenda_id?: string;
  status?: 'ABERTA' | 'ENCERRADA';
  transferencias_ids?: string[];
  protocolo_receptora_ids?: string[];
  origem_embriao?: 'PACOTE' | 'CONGELADO';
  data_te?: string;
  updated_at?: string;
}

// ========================================
// Tipos auxiliares para queries
// ========================================

// Aspiração com dados da doadora
export interface AspiracaoComDoadora extends AspiracaoDoadora {
  doadora_id: string;
  doadora_nome?: string;
  doadora_registro?: string;
}

// Acasalamento com dados relacionados
export interface AcasalamentoComDados extends LoteFIVAcasalamento {
  aspiracao_doadora_id: string;
  dose_semen_id: string;
}

// Lote FIV com dados do pacote
export interface LoteFIVComPacote extends LoteFIV {
  pacote_aspiracao?: PacoteAspiracao;
}

// Tipo genérico para erros do Supabase
export interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

// ========================================
// Tipos para queries específicas (evita uso de 'any')
// ========================================

// Embrião com campos específicos para query (DiagnosticoGestacao, FazendaDetail)
export interface EmbriaoQuery {
  id: string;
  identificacao?: string;
  classificacao?: string;
  lote_fiv_id: string;
  lote_fiv_acasalamento_id?: string;
}

// Dose de sêmen com join de touro (retorno do Supabase)
export interface DoseComTouroQuery {
  id: string;
  touro_id?: string;
  touro?: {
    id: string;
    nome: string;
    registro?: string;
    raca?: string;
  } | Array<{
    id: string;
    nome: string;
    registro?: string;
    raca?: string;
  }> | null;
}

// Protocolo receptora com join de protocolo_sincronizacao
export interface ProtocoloReceptoraQuery {
  id: string;
  protocolo_id: string;
  receptora_id?: string;
  status: string;
  motivo_inapta?: string;
  data_inclusao?: string;
  protocolos_sincronizacao?: {
    id: string;
    status?: string;
    data_inicio?: string;
    fazenda_id?: string;
  } | null;
}

// Item de view/query de transferência
export interface ItemTransferenciaQuery {
  id?: string;
  receptora_id?: string;
  embriao_id?: string;
  data_te?: string;
  status_te?: string;
  brinco?: string;
  nome?: string;
  [key: string]: unknown;
}

// ========================================
// Tipos para Perfil e Marketplace C2C
// ========================================

export type ProfileSectionType = 'text' | 'animal_showcase' | 'photo_gallery' | 'stats' | 'fazenda_highlight' | 'production_stats' | 'service_stats' | 'specialties' | 'service_portfolio' | 'fazenda_links';

export interface ProfileSection {
  id: string;
  user_id: string;
  section_type: ProfileSectionType;
  title: string;
  content: ProfileSectionContent;
  sort_order: number;
  is_public: boolean;
  active: boolean;
  fazenda_profile_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Conteúdo JSONB por tipo de seção
export type ProfileSectionContent =
  | TextSectionContent
  | AnimalShowcaseContent
  | PhotoGalleryContent
  | StatsSectionContent
  | FazendaHighlightContent
  | ProductionStatsContent
  | ServiceStatsContent
  | SpecialtiesContent
  | ServicePortfolioContent
  | FazendaLinksContent;

export interface TextSectionContent {
  body: string;
}

export interface AnimalShowcaseContent {
  animals: Array<{
    type: 'doadora' | 'touro';
    id: string;
    nome: string;
    foto_url?: string;
  }>;
  layout?: 'grid' | 'carousel';
}

export interface PhotoGalleryContent {
  photos: Array<{
    url: string;
    caption?: string;
  }>;
  layout?: 'grid' | 'masonry';
}

export interface StatsSectionContent {
  show_doadoras?: boolean;
  show_receptoras?: boolean;
  show_embrioes?: boolean;
  custom_stats?: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
}

export interface FazendaHighlightContent {
  fazenda_id: string;
  show_map?: boolean;
  show_animal_count?: boolean;
  custom_description?: string;
}

export interface ProductionStatsContent {
  fazenda_id: string;
  visibility: Record<string, boolean>;
}

export interface ServiceStatsContent {
  user_id: string;
  visibility: Record<string, boolean>;
}

export interface SpecialtiesContent {
  description: string;
  specialties: string[];
}

export interface ServicePortfolioContent {
  items: Array<{
    foto_url: string;
    caption?: string;
    resultado?: string;
  }>;
}

export interface FazendaLinksContent {
  show_stats?: boolean;
}

export interface FazendaStats {
  total_doadoras: number;
  total_receptoras: number;
  total_embrioes: number;
  total_aspiracoes: number;
  taxa_prenhez: number;
}

export interface ProviderStats {
  total_aspiracoes: number;
  total_tes: number;
  total_embrioes: number;
  total_clientes: number;
  taxa_aproveitamento: number;
}

export type AnuncioTipo = 'doadora' | 'touro' | 'embriao' | 'dose' | 'outro';
export type AnuncioStatus = 'RASCUNHO' | 'ATIVO' | 'PAUSADO' | 'VENDIDO' | 'REMOVIDO';

export interface AnuncioUsuario {
  id: string;
  user_id: string;
  cliente_id?: string;
  tipo: AnuncioTipo;
  titulo: string;
  descricao?: string;
  preco?: number;
  preco_negociavel?: boolean;
  doadora_id?: string;
  touro_id?: string;
  foto_principal?: string;
  fotos_galeria?: string[];
  status: AnuncioStatus;
  created_at?: string;
  updated_at?: string;
  // Campos enriquecidos (joins)
  vendedor_nome?: string;
  vendedor_avatar?: string;
  vendedor_slug?: string;
  vendedor_localizacao?: string;
}