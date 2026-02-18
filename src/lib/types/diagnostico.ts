
import type { EmbriaoTransferido } from '@/lib/gestacao';

export interface ReceptoraServida {
    receptora_id: string;
    brinco: string;
    nome?: string;
    status_reprodutivo?: string | null;
    data_te: string;
    embrioes: EmbriaoTransferido[];
    data_abertura_lote: string;
    dias_gestacao: number;
    diagnostico_existente?: {
        id: string;
        data_diagnostico: string;
        resultado: string;
        numero_gestacoes?: number;
        observacoes?: string;
    };
}

export interface DiagnosticoFormData {
    [receptora_id: string]: {
        resultado: 'PRENHE' | 'VAZIA' | 'RETOQUE' | '';
        numero_gestacoes: string;
        observacoes: string;
        data_diagnostico: string;
    };
}

export interface HistoricoDG {
    id: string;
    receptora_id: string;
    receptora_brinco: string;
    receptora_nome?: string;
    fazenda_nome: string;
    fazenda_id?: string;
    data_te: string;
    data_diagnostico: string;
    resultado: string;
    numero_gestacoes?: number;
    observacoes?: string;
    veterinario_responsavel?: string;
    tecnico_responsavel?: string;
    data_provavel_parto?: string;
}

export interface SessaoDG {
    id: string;
    fazenda_nome: string;
    fazenda_id: string;
    data_te: string;
    data_diagnostico: string;
    veterinario_responsavel?: string;
    tecnico_responsavel?: string;
    total_receptoras: number;
    prenhes: number;
    vazias: number;
    retoques: number;
    receptoras: HistoricoDG[];
}
