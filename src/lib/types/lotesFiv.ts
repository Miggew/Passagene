/**
 * Tipos específicos para Lotes FIV
 * Extraídos de LotesFIV.tsx para reutilização
 */

import { LoteFIV, LoteFIVAcasalamento, PacoteAspiracao, AspiracaoDoadora } from '@/lib/types';

/**
 * Lote FIV com dados agregados para exibição
 */
export interface LoteFIVComNomes extends LoteFIV {
  pacote_nome?: string;
  pacote_data?: string;
  fazendas_destino_nomes?: string[];
  quantidade_acasalamentos?: number;
  dia_atual?: number;
}

/**
 * Pacote de aspiração com dados agregados para exibição
 */
export interface PacoteComNomes extends PacoteAspiracao {
  fazenda_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_doadoras?: number;
}

/**
 * Acasalamento com dados agregados para exibição
 */
export interface AcasalamentoComNomes extends LoteFIVAcasalamento {
  doadora_nome?: string;
  doadora_registro?: string;
  dose_nome?: string;
  viaveis?: number;
  total_embrioes_produzidos?: number;
}

/**
 * Aspiração com oócitos disponíveis calculados
 */
export interface AspiracaoComOocitosDisponiveis extends AspiracaoDoadora {
  oocitos_disponiveis?: number;
}

/**
 * Lote para exibição no histórico
 */
export interface LoteHistorico {
  id: string;
  data_abertura: string;
  data_fechamento?: string;
  status: string;
  observacoes?: string;
  pacote_aspiracao_id: string;
  pacote_data?: string;
  pacote_nome?: string;
  fazenda_origem_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_acasalamentos: number;
  total_embrioes_produzidos: number;
  total_embrioes_transferidos?: number;
  total_embrioes_congelados?: number;
  total_embrioes_descartados?: number;
  embrioes_por_classificacao: {
    BE?: number;
    BN?: number;
    BX?: number;
    BL?: number;
    BI?: number;
    sem_classificacao?: number;
  };
  total_oocitos?: number;
  total_viaveis?: number;
}

/**
 * Detalhes expandidos de um lote histórico
 */
export interface DetalhesLoteHistorico {
  lote: LoteHistorico;
  pacote?: {
    id: string;
    data_aspiracao: string;
    horario_inicio?: string;
    horario_final?: string;
    veterinario_responsavel?: string;
    tecnico_responsavel?: string;
    total_oocitos?: number;
    observacoes?: string;
  };
  acasalamentos: Array<{
    id: string;
    aspiracao_id?: string;
    doadora?: {
      registro?: string;
      nome?: string;
    };
    aspiracao?: {
      data_aspiracao?: string;
      horario_aspiracao?: string;
      viaveis?: number;
      expandidos?: number;
      total_oocitos?: number;
      atresicos?: number;
      degenerados?: number;
      desnudos?: number;
      veterinario_responsavel?: string;
    };
    dose_semen?: {
      nome?: string;
      raca?: string;
      tipo_semen?: string;
      cliente?: string;
    };
    quantidade_fracionada: number;
    quantidade_oocitos?: number;
    quantidade_embrioes?: number;
    observacoes?: string;
    resumo_embrioes?: {
      total: number;
      porStatus: { [status: string]: number };
      porClassificacao: { [classificacao: string]: number };
    };
  }>;
  embrioes: Array<{
    id: string;
    identificacao?: string;
    classificacao?: string;
    tipo_embriao?: string;
    status_atual?: string;
    acasalamento_id?: string;
  }>;
}

/**
 * Registro de histórico de despacho
 */
export interface HistoricoDespacho {
  id: string;
  data_despacho: string;
  acasalamentos: Array<{
    acasalamento_id: string;
    quantidade: number;
    doadora?: string;
    dose?: string;
  }>;
  pacote_id?: string;
}
