import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatStatusLabel } from '@/lib/statusLabels';

interface StatusBadgeProps {
  status: string;
  count?: number;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Sistema de cores semânticas para badges de status
 * Padrão: bg-[cor]/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]/30
 */
const statusConfig: Record<string, string> = {
  // ═══════════════════════════════════════════════════════════════
  // ESTADOS NEUTROS - Cinza (aguardando/inicial)
  // ═══════════════════════════════════════════════════════════════
  VAZIA: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30', // Perda/negativo
  NAO_UTILIZADA: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  DISPONIVEL: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',

  // ═══════════════════════════════════════════════════════════════
  // EM PROCESSO - Teal/Emerald (sincronização)
  // ═══════════════════════════════════════════════════════════════
  EM_SINCRONIZACAO: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
  SINCRONIZANDO: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
  SINCRONIZADA: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  SINCRONIZADO: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',

  // ═══════════════════════════════════════════════════════════════
  // INICIADO/SERVIDA - Sky/Violet (ação tomada)
  // ═══════════════════════════════════════════════════════════════
  INICIADA: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  SERVIDA: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  UTILIZADA: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',

  // ═══════════════════════════════════════════════════════════════
  // PRENHEZ - Semiótica: verde=sucesso, rosa=fêmea, azul=macho
  // ═══════════════════════════════════════════════════════════════
  PRENHE: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  PRENHE_RETOQUE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  // Sexadas: rosa=fêmea, azul=macho (semiótica universal)
  PRENHE_FEMEA: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
  PRENHE_MACHO: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  PRENHE_SEM_SEXO: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  PRENHE_2_SEXOS: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',

  // ═══════════════════════════════════════════════════════════════
  // SEXAGEM - Resultados de sexagem (sem prefixo PRENHE_)
  // ═══════════════════════════════════════════════════════════════
  FEMEA: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
  MACHO: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  SEM_SEXO: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  '2_SEXOS': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',

  // ═══════════════════════════════════════════════════════════════
  // PROTOCOLOS - Blue/Slate (etapas do protocolo)
  // ═══════════════════════════════════════════════════════════════
  PASSO1_FECHADO: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  FECHADO: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  EM_TE: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  EM_PROTOCOLO: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',

  // ═══════════════════════════════════════════════════════════════
  // STATUS DE PROPRIEDADE - Vermelho/Cinza (descarte/venda)
  // ═══════════════════════════════════════════════════════════════
  DESCARTE: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  VENDIDA: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',

  // ═══════════════════════════════════════════════════════════════
  // APTIDÃO - Verde/Vermelho (apto/inapto)
  // ═══════════════════════════════════════════════════════════════
  APTA: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  INAPTA: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',

  // ═══════════════════════════════════════════════════════════════
  // EMBRIÕES - Cyan/Violet (estado do embrião)
  // ═══════════════════════════════════════════════════════════════
  CONGELADO: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  TRANSFERIDO: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',

  // ═══════════════════════════════════════════════════════════════
  // CONCLUSÃO - Verde/Amber (finalizado/retoque)
  // ═══════════════════════════════════════════════════════════════
  REALIZADA: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  RETOQUE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
};

// Fallback para status não mapeados
const defaultConfig = 'bg-muted text-muted-foreground border-border';

export default function StatusBadge({ status, count, className, size = 'default' }: StatusBadgeProps) {
  const colorClasses = statusConfig[status] || defaultConfig;
  const label = formatStatusLabel(status);
  const display = count && count > 1 ? `${label} (${count})` : label;

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0 h-4'
    : 'text-xs px-2 py-0.5';

  return (
    <Badge
      variant="outline"
      className={cn(colorClasses, sizeClasses, className)}
    >
      {display}
    </Badge>
  );
}

/**
 * Exporta as cores para uso direto quando necessário
 * Ex: em renderCell de DataTables
 */
export function getStatusColor(status: string): string {
  return statusConfig[status] || defaultConfig;
}
