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
  created_at?: string;
}

export interface ProtocoloReceptora {
  id: string;
  protocolo_id: string;
  receptora_id: string;
  fazenda_atual_id?: string;
  data_inclusao: string;
  data_retirada?: string;
  status: string;
  motivo_inapta?: string;
  observacoes?: string;
  created_at?: string;
}

export interface AspiracaoDoadora {
  id: string;
  doadora_id: string;
  fazenda_id: string;
  data_aspiracao: string;
  horario_aspiracao?: string;
  atresicos?: number;
  degenerados?: number;
  expandidos?: number;
  desnudos?: number;
  viaveis?: number;
  total_oocitos?: number;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  observacoes?: string;
  created_at?: string;
}

export interface DoseSemen {
  id: string;
  cliente_id?: string;
  nome: string;
  partida?: string;
  raca?: string;
  tipo_semen?: string;
  created_at?: string;
}

export interface LoteFIV {
  id: string;
  aspiracao_id: string;
  dose_semen_id: string;
  fazenda_destino_id?: string;
  data_fecundacao?: string;
  data_avaliacao?: string;
  oocitos_utilizados?: number;
  observacoes?: string;
  pacote_producao_id?: string;
  created_at?: string;
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
  fazenda_id: string;
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

// Helper type for receptora with calculated status
export interface ReceptoraComStatus extends Receptora {
  status_calculado: string;
}

// Timeline event for receptora history
export interface ReceptoraHistoryEvent {
  tipo: 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM';
  data: string;
  descricao: string;
  detalhes?: string;
}