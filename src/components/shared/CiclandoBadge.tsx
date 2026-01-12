import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, X } from 'lucide-react';

interface CiclandoBadgeProps {
  value: 'N' | 'CL' | null | undefined;
  onChange?: (value: 'N' | 'CL' | null) => void;
  disabled?: boolean;
  variant?: 'display' | 'editable';
}

export default function CiclandoBadge({ 
  value, 
  onChange, 
  disabled = false,
  variant = 'display'
}: CiclandoBadgeProps) {
  // Se não tem onChange, sempre é display
  const isEditable = variant === 'editable' && onChange && !disabled;

  // Display mode (read-only)
  if (!isEditable) {
    if (value === 'N') {
      return <Badge variant="outline" className="bg-slate-100 text-slate-700 text-xs">N</Badge>;
    }
    if (value === 'CL') {
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">CL</Badge>;
    }
    // Se value é null/undefined, mostrar vazio ou "—" discreto
    return <span className="text-slate-300 text-xs">—</span>;
  }

  // Editable mode
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3"
          disabled={disabled}
        >
          {value === 'N' && (
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-0">N</Badge>
          )}
          {value === 'CL' && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0">CL</Badge>
          )}
          {!value && (
            <span className="text-slate-400 text-sm">Selecionar</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex flex-col gap-2">
          <Button
            variant={value === 'N' ? 'default' : 'outline'}
            size="sm"
            className="justify-start"
            onClick={() => onChange!('N')}
          >
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-0 mr-2">N</Badge>
            {value === 'N' && <Check className="w-4 h-4 ml-auto" />}
          </Button>
          <Button
            variant={value === 'CL' ? 'default' : 'outline'}
            size="sm"
            className="justify-start"
            onClick={() => onChange!('CL')}
          >
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0 mr-2">CL</Badge>
            {value === 'CL' && <Check className="w-4 h-4 ml-auto" />}
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-slate-500"
              onClick={() => onChange!(null)}
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
