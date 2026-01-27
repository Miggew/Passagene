/**
 * Utilitários para o histórico de receptoras
 */

import { Calendar, Syringe, Activity, Baby, MapPin, UserPlus, Tag } from 'lucide-react';
import { createElement } from 'react';

export interface HistoricoItem {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA' | 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM' | 'CIO_LIVRE' | 'PARICAO';
  resumo: string;
  detalhes?: string;
}

export interface HistoricoAdmin {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA';
  resumo: string;
}

export interface Estatisticas {
  totalCiclos: number;
  totalGestacoes: number;
  ciclosDesdeUltimaGestacao: number;
}

/**
 * Normaliza uma string de data para o formato YYYY-MM-DD
 */
export const normalizarData = (dataString: string): string => {
  if (!dataString) return dataString;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    return dataString;
  }

  const match = dataString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  try {
    const date = new Date(dataString);
    if (isNaN(date.getTime())) {
      return dataString;
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dataString;
  }
};

/**
 * Formata uma data para exibição no formato brasileiro
 */
export const formatarData = (data: string): string => {
  try {
    return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return data;
  }
};

/**
 * Configuração de ícones por tipo de evento
 */
export const tipoIconConfig: Record<string, { icon: typeof Calendar; className: string }> = {
  'CADASTRO': { icon: UserPlus, className: 'w-4 h-4 text-indigo-600' },
  'MUDANCA_FAZENDA': { icon: MapPin, className: 'w-4 h-4 text-orange-600' },
  'PROTOCOLO': { icon: Calendar, className: 'w-4 h-4 text-blue-600' },
  'TE': { icon: Syringe, className: 'w-4 h-4 text-green-600' },
  'DG': { icon: Activity, className: 'w-4 h-4 text-purple-600' },
  'SEXAGEM': { icon: Baby, className: 'w-4 h-4 text-pink-600' },
  'PARICAO': { icon: Baby, className: 'w-4 h-4 text-teal-600' },
  'CIO_LIVRE': { icon: Tag, className: 'w-4 h-4 text-amber-600' },
};

/**
 * Configuração de badges por tipo de evento
 */
export const tipoBadgeConfig: Record<string, { label: string; className: string }> = {
  'CADASTRO': { label: 'Cadastro', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'MUDANCA_FAZENDA': { label: 'Fazenda', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  'PROTOCOLO': { label: 'Protocolo', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  'TE': { label: 'TE', className: 'bg-green-50 text-green-700 border-green-200' },
  'DG': { label: 'DG', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  'SEXAGEM': { label: 'Sexagem', className: 'bg-pink-50 text-pink-700 border-pink-200' },
  'PARICAO': { label: 'Parição', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  'CIO_LIVRE': { label: 'Cio Livre', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/**
 * Configuração de badges para status de cio livre
 */
export const cioLivreBadgeConfig: Record<string, { label: string; className: string }> = {
  'CONFIRMADA': { label: 'Confirmada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'REJEITADA': { label: 'Rejeitada', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  'SUBSTITUIDA': { label: 'Substituída', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  'PENDENTE': { label: 'Pendente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/**
 * Retorna a configuração do badge de cio livre
 */
export const getCioLivreBadgeConfig = (status?: string | null) => {
  return cioLivreBadgeConfig[status || 'PENDENTE'] || cioLivreBadgeConfig['PENDENTE'];
};
