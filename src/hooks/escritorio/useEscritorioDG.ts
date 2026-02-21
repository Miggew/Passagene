import { useEscritorioService } from './useEscritorioService';
import type { DGEntryRow } from '@/lib/types/escritorio';

interface UseDGOptions {
  fazendaId?: string;
  /** Filtrar receptoras por data da TE */
  dataTE?: string;
}

/** Carrega receptoras SERVIDAS/UTILIZADAS para DG + salva batch */
export function useEscritorioDG({ fazendaId, dataTE }: UseDGOptions) {
  const service = useEscritorioService<DGEntryRow>({
    serviceKey: 'dg',
    fazendaId,
    statuses: ['SERVIDA', 'UTILIZADA'],
    dataTE,
    rpcFunction: 'registrar_dg_batch',
    dateParamName: 'p_data_diagnostico',
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
    save: async (params: { dataDiagnostico: string; veterinario: string; tecnico: string; resultados: DGEntryRow[] }) =>
      service.save({ date: params.dataDiagnostico, veterinario: params.veterinario, tecnico: params.tecnico, resultados: params.resultados }),
  };
}
