import { PacoteAspiracao } from '../types';

export interface PacoteComNomes extends PacoteAspiracao {
    fazenda_nome?: string;
    fazendas_destino_nomes?: string[];
    quantidade_doadoras?: number;
}

export interface FazendaSelect {
    id: string;
    nome: string;
}

export interface DoadoraLocal {
    id?: string; // undefined se for nova doadora criada localmente
    doadora_id: string;
    registro: string;
    nome?: string;
    raca?: string;
    isNew?: boolean; // true se for doadora criada localmente (não existe no banco ainda)
    // Dados da aspiração
    horario_aspiracao: string;
    hora_final: string;
    // Oócitos: A (Atrésicos), D (Degenerados), E (Expandidos), Dn (Desnudos), V (Viáveis)
    atresicos: number;
    degenerados: number;
    expandidos: number;
    desnudos: number;
    viaveis: number;
    total_oocitos: number;
    recomendacao_touro: string;
    observacoes: string;
}

export interface RascunhoAspiracao {
    formData: {
        fazenda_id: string;
        data_aspiracao: string;
        horario_inicio: string;
        veterinario_responsavel: string;
        tecnico_responsavel: string;
    };
    fazendas_destino_ids: string[];
    doadoras: DoadoraLocal[];
    timestamp: number;
}
