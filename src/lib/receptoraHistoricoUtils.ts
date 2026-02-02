/**
 * Utilitários para o histórico de receptoras
 */

import { Calendar, Syringe, Activity, Baby, MapPin, UserPlus, Tag } from 'lucide-react';

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
 * Configuração de ícones por tipo de evento
 */
export const tipoIconConfig: Record<string, { icon: typeof Calendar; className: string }> = {
  'CADASTRO': { icon: UserPlus, className: 'w-4 h-4 text-indigo-600 dark:text-indigo-400' },
  'MUDANCA_FAZENDA': { icon: MapPin, className: 'w-4 h-4 text-orange-600 dark:text-orange-400' },
  'PROTOCOLO': { icon: Calendar, className: 'w-4 h-4 text-blue-600 dark:text-blue-400' },
  'TE': { icon: Syringe, className: 'w-4 h-4 text-emerald-600 dark:text-emerald-400' },
  'DG': { icon: Activity, className: 'w-4 h-4 text-purple-600 dark:text-purple-400' },
  'SEXAGEM': { icon: Baby, className: 'w-4 h-4 text-pink-600 dark:text-pink-400' },
  'PARICAO': { icon: Baby, className: 'w-4 h-4 text-teal-600 dark:text-teal-400' },
  'CIO_LIVRE': { icon: Tag, className: 'w-4 h-4 text-amber-600 dark:text-amber-400' },
};

/**
 * Configuração de badges por tipo de evento - Compatible com dark mode
 */
export const tipoBadgeConfig: Record<string, { label: string; className: string }> = {
  'CADASTRO': {
    label: 'Cadastro',
    className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
  },
  'MUDANCA_FAZENDA': {
    label: 'Fazenda',
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
  },
  'PROTOCOLO': {
    label: 'Protocolo',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
  },
  'TE': {
    label: 'TE',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
  },
  'DG': {
    label: 'DG',
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
  },
  'SEXAGEM': {
    label: 'Sexagem',
    className: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30'
  },
  'PARICAO': {
    label: 'Parição',
    className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
  },
  'CIO_LIVRE': {
    label: 'Cio Livre',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
  },
};

/**
 * Configuração de badges para status de cio livre - Compatible com dark mode
 */
export const cioLivreBadgeConfig: Record<string, { label: string; className: string }> = {
  'CONFIRMADA': {
    label: 'Confirmada',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
  },
  'REJEITADA': {
    label: 'Rejeitada',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
  },
  'SUBSTITUIDA': {
    label: 'Substituída',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
  },
  'PENDENTE': {
    label: 'Pendente',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
  },
};

/**
 * Retorna a configuração do badge de cio livre
 */
export const getCioLivreBadgeConfig = (status?: string | null) => {
  return cioLivreBadgeConfig[status || 'PENDENTE'] || cioLivreBadgeConfig['PENDENTE'];
};
