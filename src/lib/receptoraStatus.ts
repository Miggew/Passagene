import { supabase } from './supabase';

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
