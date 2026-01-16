import { supabase } from './supabase';
import type { VTentativaTeStatus, VProtocoloReceptoraStatus } from './types';

/**
 * Tipos de status possíveis para receptoras
 */
export type StatusReceptora = 
  | 'VAZIA'
  | 'EM_SINCRONIZACAO'
  | 'SINCRONIZADA'
  | 'SERVIDA'
  | 'PRENHE'
  | 'PRENHE_RETOQUE'
  | 'PRENHE_FEMEA'
  | 'PRENHE_MACHO'
  | 'PRENHE_SEM_SEXO'
  | 'PRENHE_2_SEXOS';

/**
 * Calcula o status real de uma receptora baseado no status_reprodutivo armazenado
 * Se o status não estiver definido, calcula usando a lógica legada das views
 */
export async function calcularStatusReceptora(receptoraId: string): Promise<string> {
  try {
    // Primeiro, tentar buscar o status_reprodutivo diretamente da tabela
    const { data: receptoraData, error: receptoraError } = await supabase
      .from('receptoras')
      .select('status_reprodutivo')
      .eq('id', receptoraId)
      .single();

    if (!receptoraError && receptoraData?.status_reprodutivo) {
      // Se há status definido, usar ele (mas pode ser null ou vazio)
      return receptoraData.status_reprodutivo;
    }

    // Se não há status definido, usar lógica legada para calcular
    // (mantido para compatibilidade com dados antigos)
    return await calcularStatusReceptoraLegado(receptoraId);
  } catch (error) {
    console.error('Error calculating receptora status:', error);
    return 'VAZIA';
  }
}

/**
 * Lógica legada para calcular status (usado quando status_reprodutivo não está definido)
 */
async function calcularStatusReceptoraLegado(receptoraId: string): Promise<string> {
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
        'PRENHE_FEMEA': 'PRENHE_FEMEA',
        'PRENHE_MACHO': 'PRENHE_MACHO',
        'PRENHE_SEM_SEXO': 'PRENHE_SEM_SEXO',
        'PRENHE_2_SEXOS': 'PRENHE_2_SEXOS',
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
    const { data: protocoloReceptoras, error: protocoloError } = await supabase
      .from('protocolo_receptoras')
      .select('status, protocolo_id')
      .eq('receptora_id', receptoraId);

    if (protocoloError) {
      console.error('Error fetching protocolo_receptoras:', protocoloError);
    }

    if (protocoloReceptoras && protocoloReceptoras.length > 0) {
      const protocoloIds = protocoloReceptoras.map(pr => pr.protocolo_id);
      const { data: protocolos, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, status')
        .in('id', protocoloIds);

      if (protocolosError) {
        console.error('Error fetching protocolos_sincronizacao:', protocolosError);
      }

      interface ProtocoloStatus {
        id: string;
        status: string;
      }
      const protocoloStatusMap = new Map(
        (protocolos || []).map((p: ProtocoloStatus) => [p.id, p.status])
      );

      const protocolosAtivos = protocoloReceptoras.filter((pr) => {
        const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
        const receptoraStatus = pr.status;
        
        if (protocoloStatus === 'PASSO2_FECHADO') {
          return false;
        }
        
        if ((receptoraStatus === 'APTA' || receptoraStatus === 'INICIADA') && 
            protocoloStatus !== 'PASSO2_FECHADO') {
          return true;
        }
        
        return false;
      });

      if (protocolosAtivos.length > 0) {
        const temApta = protocolosAtivos.some((pr) => pr.status === 'APTA');
        if (temApta) {
          return 'SINCRONIZADA';
        }
        return 'EM_SINCRONIZACAO';
      }

      const protocolosFechadosComApta = protocoloReceptoras.filter((pr) => {
        const protocoloStatus = protocoloStatusMap.get(pr.protocolo_id);
        return protocoloStatus === 'PASSO2_FECHADO' && pr.status === 'APTA';
      });

      if (protocolosFechadosComApta.length > 0) {
        return 'SINCRONIZADA';
      }
    }

    // 3) Default - receptora disponível
    return 'VAZIA';
  } catch (error) {
    console.error('Error calculating receptora status (legacy):', error);
    return 'VAZIA';
  }
}

/**
 * Calculate status for multiple receptoras in batch (optimized)
 * Primeiro tenta buscar status_reprodutivo da tabela, depois usa lógica legada
 */
export async function calcularStatusReceptoras(receptoraIds: string[]): Promise<Map<string, string>> {
  if (receptoraIds.length === 0) return new Map();

  const statusMap = new Map<string, string>();

  try {
    // 1. Buscar status_reprodutivo diretamente da tabela receptoras
    const { data: receptorasData, error: receptorasError } = await supabase
      .from('receptoras')
      .select('id, status_reprodutivo')
      .in('id', receptoraIds);

    if (!receptorasError && receptorasData) {
      receptorasData.forEach(r => {
        if (r.status_reprodutivo) {
          statusMap.set(r.id, r.status_reprodutivo);
        }
      });
    }

    // 2. Para receptoras sem status definido, usar lógica legada
    const receptorasSemStatus = receptoraIds.filter(id => !statusMap.has(id));
    
    if (receptorasSemStatus.length > 0) {
      const statusLegado = await calcularStatusReceptorasLegado(receptorasSemStatus);
      statusLegado.forEach((status, id) => {
        statusMap.set(id, status);
      });
    }

  } catch (error) {
    console.error('Error calculating receptoras status:', error);
    // Em caso de erro, definir todos como VAZIA
    receptoraIds.forEach(id => statusMap.set(id, 'VAZIA'));
  }

  return statusMap;
}

/**
 * Lógica legada para calcular status em batch
 */
async function calcularStatusReceptorasLegado(receptoraIds: string[]): Promise<Map<string, string>> {
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
      'PRENHE_FEMEA': 'PRENHE_FEMEA',
      'PRENHE_MACHO': 'PRENHE_MACHO',
      'PRENHE_SEM_SEXO': 'PRENHE_SEM_SEXO',
      'PRENHE_2_SEXOS': 'PRENHE_2_SEXOS',
      'PRENHE_RETOQUE': 'PRENHE_RETOQUE',
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
          : 'EM_SINCRONIZACAO');
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
    console.error('Error calculating receptoras status (legacy):', error);
    receptoraIds.forEach(id => statusMap.set(id, 'VAZIA'));
  }

  return statusMap;
}

/**
 * Atualiza o status_reprodutivo de uma receptora
 */
export async function atualizarStatusReceptora(
  receptoraId: string, 
  novoStatus: StatusReceptora
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('receptoras')
      .update({ status_reprodutivo: novoStatus })
      .eq('id', receptoraId);

    if (error) {
      console.error('Error updating receptora status:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Erro desconhecido');
    console.error('Error updating receptora status:', err);
    return { error: err };
  }
}

/**
 * Valida se uma receptora pode fazer uma transição de estado
 */
export function validarTransicaoStatus(
  statusAtual: string,
  acao: 'ENTRAR_PASSO1' | 'FINALIZAR_PASSO1' | 'FINALIZAR_PASSO2' | 'REALIZAR_TE' | 'REALIZAR_DG' | 'REALIZAR_SEXAGEM'
): { valido: boolean; mensagem?: string } {
  switch (acao) {
    case 'ENTRAR_PASSO1':
      if (statusAtual !== 'VAZIA') {
        return { 
          valido: false, 
          mensagem: `A receptora precisa estar VAZIA para entrar no primeiro passo de um protocolo. Status atual: ${statusAtual}` 
        };
      }
      return { valido: true };

    case 'FINALIZAR_PASSO1':
      // Pode finalizar passo 1 se estiver vazia (vai para EM_SINCRONIZACAO)
      if (statusAtual !== 'VAZIA') {
        return { 
          valido: false, 
          mensagem: `A receptora precisa estar VAZIA para finalizar o primeiro passo. Status atual: ${statusAtual}` 
        };
      }
      return { valido: true };

    case 'FINALIZAR_PASSO2':
      if (statusAtual !== 'EM_SINCRONIZACAO') {
        return { 
          valido: false, 
          mensagem: `A receptora precisa estar EM_SINCRONIZACAO para finalizar o segundo passo. Status atual: ${statusAtual}` 
        };
      }
      return { valido: true };

    case 'REALIZAR_TE':
      if (statusAtual !== 'SINCRONIZADA') {
        return { 
          valido: false, 
          mensagem: `A receptora precisa estar SINCRONIZADA para realizar transferência de embriões. Status atual: ${statusAtual}` 
        };
      }
      return { valido: true };

    case 'REALIZAR_DG':
      if (statusAtual !== 'SERVIDA') {
        return { 
          valido: false, 
          mensagem: `A receptora precisa estar SERVIDA para realizar diagnóstico de gestação. Status atual: ${statusAtual}` 
        };
      }
      return { valido: true };

    case 'REALIZAR_SEXAGEM':
      if (statusAtual !== 'PRENHE' && statusAtual !== 'PRENHE_RETOQUE') {
        return { 
          valido: false, 
          mensagem: `A receptora precisa estar PRENHE ou PRENHE_RETOQUE para realizar sexagem. Status atual: ${statusAtual}` 
        };
      }
      return { valido: true };

    default:
      return { valido: false, mensagem: 'Ação desconhecida' };
  }
}
