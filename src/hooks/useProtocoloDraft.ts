import { useState, useRef, useEffect, useCallback } from 'react';

const RASCUNHO_PASSO1_KEY = 'passagene_protocolo_passo1_rascunho';
const RASCUNHO_PASSO2_KEY = 'passagene_protocolo_passo2_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

export interface RascunhoPasso1 {
    protocoloData: {
        fazenda_id: string;
        data_inicio: string;
        veterinario: string;
        tecnico: string;
        observacoes: string;
    };
    receptorasLocais: Array<{
        id?: string;
        identificacao: string;
        nome?: string;
        observacoes?: string;
        ciclando_classificacao?: 'N' | 'CL' | null;
        qualidade_semaforo?: 1 | 2 | 3 | null;
    }>;
    currentStep: 'form' | 'receptoras';
    timestamp: number;
}

export interface RascunhoPasso2 {
    protocoloSelecionadoId: string;
    passo2Form: {
        data: string;
        tecnico: string;
    };
    motivosInapta: Record<string, string>;
    statusAlterados: Record<string, 'APTA' | 'INAPTA' | 'INICIADA'>;
    timestamp: number;
}

export function useProtocoloDraft() {
    const [showRestaurarPasso1Dialog, setShowRestaurarPasso1Dialog] = useState(false);
    const [showRestaurarPasso2Dialog, setShowRestaurarPasso2Dialog] = useState(false);
    const [rascunhoPasso2Pendente, setRascunhoPasso2Pendente] = useState<RascunhoPasso2 | null>(null);

    // Passo 1
    const getRascunhoPasso1 = useCallback((): RascunhoPasso1 | null => {
        try {
            const raw = localStorage.getItem(RASCUNHO_PASSO1_KEY);
            if (!raw) return null;
            const rascunho: RascunhoPasso1 = JSON.parse(raw);
            const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
            if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
                localStorage.removeItem(RASCUNHO_PASSO1_KEY);
                return null;
            }
            return rascunho;
        } catch {
            return null;
        }
    }, []);

    const salvarRascunhoPasso1 = useCallback((data: Omit<RascunhoPasso1, 'timestamp'>) => {
        const rascunho: RascunhoPasso1 = {
            ...data,
            timestamp: Date.now(),
        };
        localStorage.setItem(RASCUNHO_PASSO1_KEY, JSON.stringify(rascunho));
    }, []);

    const limparRascunhoPasso1 = useCallback(() => {
        localStorage.removeItem(RASCUNHO_PASSO1_KEY);
    }, []);

    const descartarRascunhoPasso1 = useCallback(() => {
        limparRascunhoPasso1();
        setShowRestaurarPasso1Dialog(false);
    }, [limparRascunhoPasso1]);

    // Passo 2
    const getRascunhoPasso2 = useCallback((): RascunhoPasso2 | null => {
        try {
            const raw = localStorage.getItem(RASCUNHO_PASSO2_KEY);
            if (!raw) return null;
            const rascunho: RascunhoPasso2 = JSON.parse(raw);
            const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
            if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
                localStorage.removeItem(RASCUNHO_PASSO2_KEY);
                return null;
            }
            return rascunho;
        } catch {
            return null;
        }
    }, []);

    const salvarRascunhoPasso2 = useCallback((data: Omit<RascunhoPasso2, 'timestamp'>) => {
        const rascunho: RascunhoPasso2 = {
            ...data,
            timestamp: Date.now(),
        };
        localStorage.setItem(RASCUNHO_PASSO2_KEY, JSON.stringify(rascunho));
    }, []);

    const limparRascunhoPasso2 = useCallback(() => {
        localStorage.removeItem(RASCUNHO_PASSO2_KEY);
    }, []);

    const descartarRascunhoPasso2 = useCallback(() => {
        limparRascunhoPasso2();
        setRascunhoPasso2Pendente(null);
        setShowRestaurarPasso2Dialog(false);
    }, [limparRascunhoPasso2]);

    return {
        showRestaurarPasso1Dialog,
        setShowRestaurarPasso1Dialog,
        getRascunhoPasso1,
        salvarRascunhoPasso1,
        limparRascunhoPasso1,
        descartarRascunhoPasso1,

        showRestaurarPasso2Dialog,
        setShowRestaurarPasso2Dialog,
        rascunhoPasso2Pendente,
        setRascunhoPasso2Pendente,
        getRascunhoPasso2,
        salvarRascunhoPasso2,
        limparRascunhoPasso2,
        descartarRascunhoPasso2
    };
}
