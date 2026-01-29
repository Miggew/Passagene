import { Button } from '@/components/ui/button';
import { Snowflake, Tag, Trash2, X, Package } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClassificar: () => void;
  onCongelar: () => void;
  onDescartar: () => void;
  onCancelar: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClassificar,
  onCongelar,
  onDescartar,
  onCancelar,
}: BulkActionsBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-card border-t border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-primary-subtle text-primary-subtle-foreground px-3 py-1.5 rounded-full">
                <Package className="w-4 h-4" />
                <span className="font-medium text-sm">{selectedCount} selecionado(s)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelar}
                className="text-muted-foreground hover:text-foreground h-8"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onClassificar}
                className="h-9 border-primary/30 text-primary hover:bg-primary-subtle"
              >
                <Tag className="w-4 h-4 mr-2" />
                Classificar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCongelar}
                className="h-9 border-primary/20 text-foreground hover:bg-secondary"
              >
                <Snowflake className="w-4 h-4 mr-2 text-blue-500" />
                Congelar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDescartar}
                className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Descartar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
