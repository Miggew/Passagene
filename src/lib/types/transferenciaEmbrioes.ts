/**
 * Tipos e interfaces para Transferencia de Embrioes
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 */

import type { TransferenciaSessao, Fazenda, Cliente } from '@/lib/types';

// Re-export for convenience (tipos simplificados para queries)
export type { Fazenda, Cliente };

// Sessão persistida no banco
export interface SessaoPersistida extends TransferenciaSessao {
  filtro_cliente_id?: string;
  filtro_raca?: string;
  data_passo2?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  incluir_cio_livre?: boolean;
}

// Item de query de transferência com receptora
export interface TransferenciaComReceptora {
  id: string;
  receptora_id: string;
  protocolo_receptora_id?: string;
  receptoras?: {
    id: string;
    identificacao: string;
    status_reprodutivo?: string;
  } | Array<{
    id: string;
    identificacao: string;
    status_reprodutivo?: string;
  }>;
}

export interface ReceptoraSincronizada {
  receptora_id: string;
  brinco: string;
  protocolo_id?: string;
  protocolo_receptora_id?: string;
  pr_id?: string;
  identificacao?: string;
  data_te_prevista?: string;
  data_limite_te?: string;
  quantidade_embrioes?: number;
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
  observacoes?: string | null;
  origem?: 'PROTOCOLO' | 'CIO_LIVRE';
  data_cio?: string;
  status_reprodutivo?: string | null;
}

export interface EmbrioCompleto {
  id: string;
  identificacao?: string;
  classificacao?: string;
  status_atual: string;
  localizacao_atual?: string;
  doadora_registro?: string;
  touro_nome?: string;
  doadora_raca?: string;
  touro_raca?: string;
  cliente_nome?: string;
  d7_pronto?: boolean;
  d8_limite?: boolean;
  created_at?: string;
}

export interface PacoteAspiracaoInfo {
  id: string;
  data_aspiracao: string;
  fazenda_nome?: string;
  quantidade_doadoras: number;
  horario_inicio?: string;
  veterinario_responsavel?: string;
  total_oocitos?: number;
}

export interface PacoteEmbrioes {
  id: string;
  lote_fiv_id: string;
  data_despacho: string;
  fazendas_destino_ids: string[];
  fazendas_destino_nomes: string[];
  pacote_info: PacoteAspiracaoInfo;
  embrioes: EmbrioCompleto[];
  total: number;
  frescos: number;
  congelados: number;
}

export type SessaoTransferenciaStorage = {
  fazenda_id?: string;
  pacote_id?: string;
  data_passo2?: string;
  data_te?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  transferenciasIdsSessao?: string[];
  transferenciasSessao?: string[];
  embrioes_page?: number;
  origem_embriao?: 'PACOTE' | 'CONGELADO';
  filtro_cliente_id?: string;
  filtro_raca?: string;
  incluir_cio_livre?: boolean;
};

export type RelatorioTransferenciaItem = {
  numero_embriao: string;
  doadora: string;
  touro: string;
  classificacao: string;
  receptora_brinco: string;
  receptora_nome: string;
  data_te?: string | null;
  veterinario: string;
  tecnico: string;
  observacoes?: string;
};

export type TransferenciaRelatorioData = {
  embrioes?: {
    identificacao?: string | null;
    lote_fiv_acasalamento_id?: string | null;
    classificacao?: string | null;
  } | null;
  receptoras?: {
    identificacao?: string | null;
    nome?: string | null;
  } | null;
  data_te?: string | null;
  veterinario_responsavel?: string | null;
  tecnico_responsavel?: string | null;
  observacoes?: string | null;
  embriao_id?: string | null;
};

export type DoseComTouro = {
  id: string;
  touro?: {
    nome?: string | null;
    raca?: string | null;
  } | Array<{
    nome?: string | null;
    raca?: string | null;
  }> | null;
};

export type EmbriaoComLote = {
  lote_fiv_id?: string | null;
};

export interface TransferenciaFormData {
  fazenda_id: string;
  pacote_id: string;
  protocolo_id: string;
  receptora_id: string;
  protocolo_receptora_id: string;
  embriao_id: string;
  data_te: string;
  veterinario_responsavel: string;
  tecnico_responsavel: string;
  observacoes: string;
}

export interface CamposPacote {
  data_te: string;
  veterinario_responsavel: string;
  tecnico_responsavel: string;
}
