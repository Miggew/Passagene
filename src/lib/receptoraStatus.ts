import { supabase } from './supabase';
import type { VTentativaTeStatus, VProtocoloReceptoraStatus } from './types';

/**
 * Calculate the real-world status of a receptora using views
 * Priority order:
 * 1. Check v_tentativas_te_status (most recent TE attempt)
 * 2. Check protocolo_receptoras for active protocols (not PASSO2_FECHADO)
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

    // 2) Check protocolo_receptoras for ACTIVE protocols (not PASSO2_FECHADO)
    // Receptoras APTA/INICIADA em protocolos ativos não devem ser elegíveis
    const { data: protocoloReceptoras, error: protocoloError } = await supabase
      .from('protocolo_receptoras')
      .select('status, protocolo_id')
      .eq('receptora_id', receptoraId);

    if (protocoloError) {
      console.error('Error fetching protocolo_receptoras:', protocoloError);
    }

    if (protocoloReceptoras && protocoloReceptoras.length > 0) {
      // Buscar status dos protocolos relacionados
      const protocoloIds = protocoloReceptoras.map(pr => pr.protocolo_id);
      const { data: protocolos, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, status')
        .in('id', protocoloIds);

      if (protocolosError) {
        console.error('Error fetching protocolos_sincronizacao:', protocolosError);
      }

      // Criar mapa de status dos protocolos
      const protocoloStatusMap = new Map(
        (protocolos || []).map((p: any) => [p.id, p.status])
      );

      // Verificar se há protocolo ATIVO (não fechado) com receptora APTA ou INICIADA
      const protocolosAtivos = protocoloReceptoras.filter((pr) => {
        const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
        const receptoraStatus = pr.status;
        
        // Protocolo fechado não bloqueia elegibilidade (pode entrar em novo protocolo)
        if (protocoloStatus === 'PASSO2_FECHADO') {
          return false;
        }
        
        // Receptoras APTA ou INICIADA em protocolos ativos bloqueiam elegibilidade
        if ((receptoraStatus === 'APTA' || receptoraStatus === 'INICIADA') && 
            protocoloStatus !== 'PASSO2_FECHADO') {
          return true;
        }
        
        return false;
      });

      if (protocolosAtivos.length > 0) {
        // Receptoras APTA em protocolos ativos estão em sincronização
        const temApta = protocolosAtivos.some((pr) => pr.status === 'APTA');
        if (temApta) {
          return 'SINCRONIZADA'; // Receptora aprovada aguardando TE
        }
        return 'EM SINCRONIZAÇÃO'; // Receptora em protocolo ativo
      }

      // Verificar se há protocolo fechado com receptora APTA (já foi aprovada mas protocolo fechou)
      // Receptoras APTA em protocolos fechados não devem entrar em novo protocolo até terem TE
      const protocolosFechadosComApta = protocoloReceptoras.filter((pr) => {
        const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
        return protocoloStatus === 'PASSO2_FECHADO' && pr.status === 'APTA';
      });

      if (protocolosFechadosComApta.length > 0) {
        // Receptora foi aprovada em protocolo fechado - verificar se teve TE
        // Se não teve TE ainda, ainda está "aguardando" mesmo com protocolo fechado
        // Por segurança, vamos retornar SINCRONIZADA para não permitir novo protocolo
        return 'SINCRONIZADA';
      }
    }

    // 3) Default - receptora disponível
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