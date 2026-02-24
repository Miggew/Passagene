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
  VAZIA: 'bg-danger/10 text-danger border-transparent', // Perda/negativo
  NAO_UTILIZADA: 'bg-bg-subtle text-text-secondary border-border-default',
  DISPONIVEL: 'bg-green/15 text-green border-transparent glow-green font-bold',

  // ═══════════════════════════════════════════════════════════════
  // EM PROCESSO
  // ═══════════════════════════════════════════════════════════════
  EM_SINCRONIZACAO: 'bg-info/10 text-info border-transparent',
  SINCRONIZANDO: 'bg-info/10 text-info border-transparent',
  SINCRONIZADA: 'bg-green/15 text-green border-transparent glow-green',
  SINCRONIZADO: 'bg-green/15 text-green border-transparent glow-green',

  // ═══════════════════════════════════════════════════════════════
  // INICIADO/SERVIDA
  // ═══════════════════════════════════════════════════════════════
  INICIADA: 'bg-info/10 text-info border-transparent',
  SERVIDA: 'bg-gold/15 text-gold border-transparent',
  UTILIZADA: 'bg-green/15 text-green border-transparent glow-green',

  // ═══════════════════════════════════════════════════════════════
  // PRENHEZ
  // ═══════════════════════════════════════════════════════════════
  PRENHE: 'bg-green/20 text-green border-transparent glow-green font-bold',
  PRENHE_RETOQUE: 'bg-warning/15 text-warning border-transparent',
  PRENHE_FEMEA: 'bg-pink-500/15 text-pink-400 border-transparent',
  PRENHE_MACHO: 'bg-blue-500/15 text-blue-400 border-transparent',
  PRENHE_SEM_SEXO: 'bg-purple-500/15 text-purple-400 border-transparent',
  PRENHE_2_SEXOS: 'bg-indigo-500/15 text-indigo-400 border-transparent',

  // ═══════════════════════════════════════════════════════════════
  // SEXAGEM - Resultados de sexagem (sem prefixo PRENHE_)
  // ═══════════════════════════════════════════════════════════════
  FEMEA: 'bg-pink-500/15 text-pink-400 border-transparent',
  MACHO: 'bg-blue-500/15 text-blue-400 border-transparent',
  SEM_SEXO: 'bg-purple-500/15 text-purple-400 border-transparent',
  '2_SEXOS': 'bg-indigo-500/15 text-indigo-400 border-transparent',

  // ═══════════════════════════════════════════════════════════════
  // PROTOCOLOS
  // ═══════════════════════════════════════════════════════════════
  PASSO1_FECHADO: 'bg-info/15 text-info border-transparent',
  FECHADO: 'bg-bg-subtle text-text-secondary border-border-default',
  EM_TE: 'bg-bg-subtle text-text-secondary border-border-default',
  EM_PROTOCOLO: 'bg-info/15 text-info border-transparent',

  // ═══════════════════════════════════════════════════════════════
  // STATUS DE PROPRIEDADE
  // ═══════════════════════════════════════════════════════════════
  DESCARTE: 'bg-danger/15 text-danger border-transparent',
  VENDIDA: 'bg-danger/15 text-danger border-transparent',
  ESGOTADO: 'bg-danger/15 text-danger border-transparent',
  RESERVADO: 'bg-warning/15 text-warning border-transparent',

  // ═══════════════════════════════════════════════════════════════
  // APTIDÃO - Verde/Vermelho (apto/inapto)
  // ═══════════════════════════════════════════════════════════════
  APTA: 'bg-green/15 text-green border-transparent glow-green',
  INAPTA: 'bg-danger/15 text-danger border-transparent',

  // ═══════════════════════════════════════════════════════════════
  // EMBRIÕES
  // ═══════════════════════════════════════════════════════════════
  CONGELADO: 'bg-gold/15 text-gold border-transparent',
  TRANSFERIDO: 'bg-green/15 text-green border-transparent glow-green',

  // ═══════════════════════════════════════════════════════════════
  // CONCLUSÃO - Verde/Amber (finalizado/retoque)
  // ═══════════════════════════════════════════════════════════════
  REALIZADA: 'bg-green/15 text-green border-transparent glow-green',
  RETOQUE: 'bg-warning/15 text-warning border-transparent',

  VERIFICADO: 'bg-gold text-[#080B0A] border-transparent glow-gold font-bold',
};

// Fallback para status não mapeados
const defaultConfig = 'bg-bg-subtle text-text-muted border-border-default';

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
