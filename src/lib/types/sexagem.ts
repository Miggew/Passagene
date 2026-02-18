
import type { EmbriaoTransferido } from '@/lib/gestacao';

export type ResultadoSexagem = 'FEMEA' | 'MACHO' | 'SEM_SEXO' | 'VAZIA';

export interface ReceptoraPrenhe {
    receptora_id: string;
    brinco: string;
    nome?: string;
    data_te: string;
    embrioes: EmbriaoTransferido[];
    data_abertura_lote: string;
    dias_gestacao: number;
    numero_gestacoes: number;
    diagnostico_existente?: {
        id: string;
        data_diagnostico: string;
        resultado: string;
        numero_gestacoes?: number;
        observacoes?: string;
    };
}

export interface SexagemFormData {
    [receptora_id: string]: {
        data_sexagem: string;
        sexagens: string[];
        observacoes: string;
    };
}

export interface HistoricoSexagem {
    id: string;
    receptora_id: string;
    receptora_brinco: string;
    receptora_nome?: string;
    fazenda_nome: string;
    fazenda_id?: string;
    data_te: string;
    data_diagnostico: string;
    resultado: string;
    sexagem?: string;
    numero_gestacoes?: number;
    observacoes?: string;
    veterinario_responsavel?: string;
    tecnico_responsavel?: string;
    data_provavel_parto?: string;
}

export interface SessaoSexagem {
    id: string;
    fazenda_nome: string;
    fazenda_id: string;
    data_te: string;
    data_sexagem: string;
    veterinario_responsavel?: string;
    tecnico_responsavel?: string;
    total_receptoras: number;
    femeas: number;
    machos: number;
    sem_sexo: number;
    vazias: number;
    receptoras: HistoricoSexagem[];
}
