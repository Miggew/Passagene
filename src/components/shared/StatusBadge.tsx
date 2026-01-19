import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatStatusLabel } from '@/lib/statusLabels';

interface StatusBadgeProps {
  status: string;
  count?: number;
  className?: string;
}

const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  APTA: { variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  INAPTA: { variant: 'destructive', className: '' },
  INICIADA: { variant: 'secondary', className: 'bg-blue-500 hover:bg-blue-600 text-white' },
  UTILIZADA: { variant: 'outline', className: 'bg-purple-100 text-purple-800 border-purple-300' },
  NAO_UTILIZADA: { variant: 'outline', className: 'bg-gray-100 text-gray-800' },
  SINCRONIZANDO: { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  SINCRONIZADA: { variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  // Status de protocolos
  SINCRONIZADO: { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  FECHADO: { variant: 'secondary', className: 'bg-slate-500 hover:bg-slate-600 text-white' },
  PASSO1_FECHADO: { variant: 'secondary', className: 'bg-blue-400 hover:bg-blue-500 text-white' },
  PASSO2_FECHADO: { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700 text-white' }, // Status antigo, será migrado
  EM_TE: { variant: 'secondary', className: 'bg-slate-500 hover:bg-slate-600 text-white' }, // Status antigo, será migrado
  // Estados reprodutivos
  VAZIA: { variant: 'outline', className: 'bg-gray-100 text-gray-800 border-gray-300' },
  EM_SINCRONIZACAO: { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  SERVIDA: { variant: 'secondary', className: 'bg-blue-500 hover:bg-blue-600 text-white' },
  PRENHE: { variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' },
  PRENHE_RETOQUE: { variant: 'secondary', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  PRENHE_FEMEA: { variant: 'default', className: 'bg-pink-600 hover:bg-pink-700 text-white' },
  PRENHE_MACHO: { variant: 'default', className: 'bg-blue-700 hover:bg-blue-800 text-white' },
  PRENHE_SEM_SEXO: { variant: 'default', className: 'bg-purple-600 hover:bg-purple-700 text-white' },
  PRENHE_2_SEXOS: { variant: 'default', className: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  // Outros
  RETOQUE: { variant: 'secondary', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  TRANSFERIDO: { variant: 'outline', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  CONGELADO: { variant: 'secondary', className: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
  REALIZADA: { variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
};

export default function StatusBadge({ status, count, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { variant: 'outline' as const, className: '' };
  const label = formatStatusLabel(status);
  const display = count && count > 1 ? `${label} (${count})` : label;

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {display}
    </Badge>
  );
}