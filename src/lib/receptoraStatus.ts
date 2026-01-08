import { supabase } from './supabase';
import type { VTentativaTeStatus, VProtocoloReceptoraStatus } from './types';

/**
 * Calculate the real-world status of a receptora using views
 * Priority order:
 * 1. Check v_tentativas_te_status (most recent TE attempt)
 * 2. Check v_protocolo_receptoras_status (active protocol)
 * 3. Default to VAZIA
 */
export async function calcularStatusReceptora(receptoraId: string): Promise<string> {
  try {
    // 1) Check v_tentativas_te_status for most recent TE status
    const { data: tentativas, error: tentativasError } = await supabase
      .from('v_tentativas_te_status')
      .select('*')
      .eq('receptora_id', receptoraId)
      .order('data_te', { ascending: false })
      .limit(1);

    if (tentativasError) {
      console.error('Error fetching v_tentativas_te_status:', tentativasError);
    }

    if (tentativas && tentativas.length > 0) {
      const tentativa = tentativas[0] as VTentativaTeStatus;
      const statusMap: Record<string, string> = {
        'PRENHE_FEMEA': 'PRENHE (FÊMEA)',
        'PRENHE_MACHO': 'PRENHE (MACHO)',
        'PRENHE_SEM_SEXO': 'PRENHE (SEM SEXO)',
        'PRENHE': 'PRENHE',
        'VAZIA': 'VAZIA',
        'RETOQUE': 'SERVIDA',
        'SEM_DIAGNOSTICO': 'SERVIDA',
      };
      
      if (statusMap[tentativa.status_tentativa]) {
        return statusMap[tentativa.status_tentativa];
      }
    }

    // 2) Check v_protocolo_receptoras_status for active protocol
    const { data: protocoloStatus, error: protocoloError } = await supabase
      .from('v_protocolo_receptoras_status')
      .select('*')
      .eq('receptora_id', receptoraId)
      .limit(1);

    if (protocoloError) {
      console.error('Error fetching v_protocolo_receptoras_status:', protocoloError);
    }

    if (protocoloStatus && protocoloStatus.length > 0) {
      const status = protocoloStatus[0] as VProtocoloReceptoraStatus;
      const faseCicloMap: Record<string, string> = {
        'SINCRONIZANDO': 'EM SINCRONIZAÇÃO',
        'SINCRONIZADA': 'SINCRONIZADA',
        'INOVULADA': 'SERVIDA',
        'ENCERRADA': 'VAZIA',
      };
      
      if (faseCicloMap[status.fase_ciclo]) {
        return faseCicloMap[status.fase_ciclo];
      }
    }

    // 3) Default
    return 'VAZIA';
  } catch (error) {
    console.error('Error calculating receptora status:', error);
    return 'VAZIA';
  }
}

/**
 * Calculate status for multiple receptoras in batch
 */
export async function calcularStatusReceptoras(receptoraIds: string[]): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>();
  
  // Process in parallel for better performance
  await Promise.all(
    receptoraIds.map(async (id) => {
      const status = await calcularStatusReceptora(id);
      statusMap.set(id, status);
    })
  );
  
  return statusMap;
}