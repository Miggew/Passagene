import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';
import type { LoteTEBase, LoteFormDataBase } from '@/lib/gestacao';

interface AbrirLoteFormProps<T extends LoteTEBase> {
  title: string;
  loteSelecionado: T;
  loteFormData: LoteFormDataBase;
  onFormChange: (data: LoteFormDataBase) => void;
  onAbrirLote: () => void;
  onCancelar: () => void;
}

export function AbrirLoteForm<T extends LoteTEBase>({
  title,
  loteSelecionado,
  loteFormData,
  onFormChange,
  onAbrirLote,
  onCancelar,
}: AbrirLoteFormProps<T>) {
  const isValid = loteFormData.veterinario_responsavel.trim() !== '' &&
                  loteFormData.tecnico_responsavel.trim() !== '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-600">
          Lote de TE em {new Date(loteSelecionado.data_te).toLocaleDateString('pt-BR')} - {loteSelecionado.quantidade_receptoras} receptoras
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="veterinario">Veterinário Responsável *</Label>
            <Input
              id="veterinario"
              value={loteFormData.veterinario_responsavel}
              onChange={(e) => onFormChange({
                ...loteFormData,
                veterinario_responsavel: e.target.value,
              })}
              placeholder="Nome do veterinário"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tecnico">Técnico Responsável *</Label>
            <Input
              id="tecnico"
              value={loteFormData.tecnico_responsavel}
              onChange={(e) => onFormChange({
                ...loteFormData,
                tecnico_responsavel: e.target.value,
              })}
              placeholder="Nome do técnico"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onAbrirLote}
            disabled={!isValid}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Abrir Lote
          </Button>
          <Button
            variant="outline"
            onClick={onCancelar}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
