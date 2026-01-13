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

export interface DoseSemen {
  id: string;
  cliente_id?: string;
  nome: string;
  raca?: string;
  tipo_semen?: string;
  quantidade?: number;
  created_at?: string;
}

export interface LoteFIV {
  id: string;
  pacote_aspiracao_id: string;
  data_abertura: string;
  status: 'ABERTO' | 'FECHADO';
  observacoes?: string;
  doses_selecionadas?: string[];
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
  identificacao?: string;
  classificacao?: string;
  tipo_embriao?: string;
  status_atual: string;
  data_envase?: string;
  data_congelamento?: string;
  data_saida_laboratorio?: string;
  data_descarte?: string;
  localizacao_atual?: string;
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
}

// Timeline event for receptora history
export interface ReceptoraHistoryEvent {
  tipo: 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM';
  data: string;
  descricao: string;
  detalhes?: string;
}