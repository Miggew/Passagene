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
      interface ProtocoloStatus {
        id: string;
        status: string;
      }
      const protocoloStatusMap = new Map(
        (protocolos || []).map((p: ProtocoloStatus) => [p.id, p.status])
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
 * Calculate status for multiple receptoras in batch (optimized)
 * Uses batch queries instead of calling calcularStatusReceptora multiple times
 */
export async function calcularStatusReceptoras(receptoraIds: string[]): Promise<Map<string, string>> {
  if (receptoraIds.length === 0) return new Map();

  const statusMap = new Map<string, string>();

  try {
    // 1. Buscar todas as tentativas de uma vez
    const { data: tentativas, error: tentativasError } = await supabase
      .from('v_tentativas_te_status')
      .select('receptora_id, status_tentativa, data_te')
      .in('receptora_id', receptoraIds)
      .order('data_te', { ascending: false });

    if (tentativasError) {
      console.error('Error fetching v_tentativas_te_status:', tentativasError);
    }

    // 2. Buscar todos os protocolo_receptoras de uma vez
    const { data: protocoloReceptoras, error: protocoloError } = await supabase
      .from('protocolo_receptoras')
      .select('receptora_id, status, protocolo_id')
      .in('receptora_id', receptoraIds);

    if (protocoloError) {
      console.error('Error fetching protocolo_receptoras:', protocoloError);
    }

    // 3. Buscar todos os protocolos de uma vez
    interface ProtocoloStatus {
      id: string;
      status: string;
    }
    const protocoloIds = [...new Set(protocoloReceptoras?.map(pr => pr.protocolo_id) || [])];
    let protocolos: ProtocoloStatus[] = [];
    if (protocoloIds.length > 0) {
      const { data, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, status')
        .in('id', protocoloIds);

      if (protocolosError) {
        console.error('Error fetching protocolos_sincronizacao:', protocolosError);
      } else {
        protocolos = (data || []) as ProtocoloStatus[];
      }
    }

    // 4. Processar em memória
    const protocoloStatusMap = new Map(protocolos?.map(p => [p.id, p.status]) || []);
    
    // Agrupar tentativas por receptora (mais recente)
    const tentativasPorReceptora = new Map<string, VTentativaTeStatus>();
    tentativas?.forEach(t => {
      if (!tentativasPorReceptora.has(t.receptora_id)) {
        tentativasPorReceptora.set(t.receptora_id, t as VTentativaTeStatus);
      }
    });

    const statusMapLocal: Record<string, string> = {
      'PRENHE_FEMEA': 'PRENHE (FÊMEA)',
      'PRENHE_MACHO': 'PRENHE (MACHO)',
      'PRENHE_SEM_SEXO': 'PRENHE (SEM SEXO)',
      'PRENHE': 'PRENHE',
      'VAZIA': 'VAZIA',
      'RETOQUE': 'SERVIDA',
      'SEM_DIAGNOSTICO': 'SERVIDA',
    };

    // Agrupar protocolo_receptoras por receptora
    const protocoloReceptorasPorReceptora = new Map<string, typeof protocoloReceptoras>();
    protocoloReceptoras?.forEach(pr => {
      if (!protocoloReceptorasPorReceptora.has(pr.receptora_id)) {
        protocoloReceptorasPorReceptora.set(pr.receptora_id, []);
      }
      protocoloReceptorasPorReceptora.get(pr.receptora_id)!.push(pr);
    });

    receptoraIds.forEach(id => {
      // Verificar tentativa mais recente
      const tentativa = tentativasPorReceptora.get(id);
      if (tentativa && statusMapLocal[tentativa.status_tentativa]) {
        statusMap.set(id, statusMapLocal[tentativa.status_tentativa]);
        return;
      }

      // Verificar protocolos ativos
      const prs = protocoloReceptorasPorReceptora.get(id) || [];
      const protocolosAtivos = prs.filter(pr => {
        const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
        return protocoloStatus !== 'PASSO2_FECHADO' && 
               (pr.status === 'APTA' || pr.status === 'INICIADA');
      });

      if (protocolosAtivos.length > 0) {
        statusMap.set(id, protocolosAtivos.some(pr => pr.status === 'APTA') 
          ? 'SINCRONIZADA' 
          : 'EM SINCRONIZAÇÃO');
        return;
      }

      // Verificar protocolos fechados com APTA
      const protocolosFechadosComApta = prs.filter(pr => {
        const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
        return protocoloStatus === 'PASSO2_FECHADO' && pr.status === 'APTA';
      });

      if (protocolosFechadosComApta.length > 0) {
        statusMap.set(id, 'SINCRONIZADA');
        return;
      }

      statusMap.set(id, 'VAZIA');
    });

  } catch (error) {
    console.error('Error calculating receptoras status:', error);
    // Em caso de erro, definir todos como VAZIA
    receptoraIds.forEach(id => statusMap.set(id, 'VAZIA'));
  }

  return statusMap;
}
