import { Button } from '@/components/ui/button';
import { Snowflake, Tag, Trash2, User, X, Package } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClassificar: () => void;
  onCongelar: () => void;
  onDirecionar: () => void;
  onDescartar: () => void;
  onCancelar: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClassificar,
  onCongelar,
  onDirecionar,
  onDescartar,
  onCancelar,
}: BulkActionsBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
                <Package className="w-4 h-4" />
                <span className="font-medium text-sm">{selectedCount} selecionado(s)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelar}
                className="text-slate-500 hover:text-slate-700 h-8"
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
                className="h-9 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
              >
                <Tag className="w-4 h-4 mr-2" />
                Classificar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCongelar}
                className="h-9 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
              >
                <Snowflake className="w-4 h-4 mr-2" />
                Congelar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDirecionar}
                className="h-9 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
              >
                <User className="w-4 h-4 mr-2" />
                Direcionar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDescartar}
                className="h-9 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
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
