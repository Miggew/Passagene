import { useEscritorioService } from './useEscritorioService';
import type { SexagemEntryRow } from '@/lib/types/escritorio';

interface UseSexagemOptions {
  fazendaId?: string;
}

/** Carrega receptoras PRENHE/PRENHE_RETOQUE para sexagem + salva batch */
export function useEscritorioSexagem({ fazendaId }: UseSexagemOptions) {
  const service = useEscritorioService<SexagemEntryRow>({
    serviceKey: 'sexagem',
    fazendaId,
    statuses: ['PRENHE', 'PRENHE_RETOQUE'],
    rpcFunction: 'registrar_sexagem_batch',
    dateParamName: 'p_data_sexagem',
    rowMapper: (pr: Record<string, unknown>) => {
      const rec = pr.receptoras as { identificacao?: string; nome?: string; raca?: string } | null;
      return {
        protocolo_receptora_id: pr.id as string,
        receptora_id: pr.receptora_id as string,
        registro: rec?.identificacao || '',
        nome: rec?.nome,
        raca: rec?.raca,
        resultado: '' as const,
        observacoes: '',
      };
    },
  });

  return {
    ...service,
    save: async (params: { dataSexagem: string; veterinario: string; tecnico: string; resultados: SexagemEntryRow[] }) =>
      service.save({ date: params.dataSexagem, veterinario: params.veterinario, tecnico: params.tecnico, resultados: params.resultados }),
  };
}
