import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import type { LoteTEBase, LoteFormDataBase } from '@/lib/gestacao';

interface LoteHeaderProps<T extends LoteTEBase> {
  loteSelecionado: T;
  receptorasCount: number;
  loteFormData: LoteFormDataBase;
  onFormChange: (data: LoteFormDataBase) => void;
  veterinarioLabel: string;
  tecnicoLabel: string;
  onSalvarLote: () => void;
  submitting: boolean;
  canSave: boolean;
}

export function LoteHeader<T extends LoteTEBase>({
  loteSelecionado,
  receptorasCount,
  loteFormData,
  onFormChange,
  veterinarioLabel,
  tecnicoLabel,
  onSalvarLote,
  submitting,
  canSave,
}: LoteHeaderProps<T>) {
  const isClosed = loteSelecionado.status === 'FECHADO';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>
          Receptoras do Lote - {receptorasCount} {receptorasCount === 1 ? 'receptora' : 'receptoras'}
          {isClosed && (
            <span className="ml-2 text-sm text-slate-500">(Lote Fechado - Somente Leitura)</span>
          )}
        </CardTitle>
        {!isClosed && (
          <Button
            onClick={onSalvarLote}
            disabled={!canSave || submitting}
          >
            <Lock className="w-4 h-4 mr-2" />
            {submitting ? 'Salvando...' : 'Salvar Lote Completo'}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div className="space-y-2">
          <Label htmlFor="veterinario_lote">{veterinarioLabel} *</Label>
          <Input
            id="veterinario_lote"
            value={loteFormData.veterinario_responsavel}
            onChange={(e) => onFormChange({
              ...loteFormData,
              veterinario_responsavel: e.target.value,
            })}
            placeholder="Nome do veterinário"
            disabled={isClosed}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tecnico_lote">{tecnicoLabel} *</Label>
          <Input
            id="tecnico_lote"
            value={loteFormData.tecnico_responsavel}
            onChange={(e) => onFormChange({
              ...loteFormData,
              tecnico_responsavel: e.target.value,
            })}
            placeholder="Nome do técnico"
            disabled={isClosed}
          />
        </div>
      </div>
    </div>
  );
}
