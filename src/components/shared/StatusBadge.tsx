import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
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
  PRENHE: { variant: 'default', className: 'bg-green-600 hover:bg-green-700' },
  VAZIA: { variant: 'destructive', className: '' },
  RETOQUE: { variant: 'secondary', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  TRANSFERIDO: { variant: 'outline', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  CONGELADO: { variant: 'secondary', className: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
  REALIZADA: { variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { variant: 'outline' as const, className: '' };

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {status}
    </Badge>
  );
}