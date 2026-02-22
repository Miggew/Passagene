import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { scrollToFirstInvalid } from '@/lib/formUtils';
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
  const formRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleAbrir = () => {
    const camposFaltantes: string[] = [];
    if (!loteFormData.veterinario_responsavel.trim()) camposFaltantes.push('Veterinário Responsável');
    if (!loteFormData.tecnico_responsavel.trim()) camposFaltantes.push('Técnico Responsável');

    if (scrollToFirstInvalid(formRef, camposFaltantes)) return;

    onAbrirLote();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" ref={formRef}>
        <p className="text-muted-foreground">
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
          <Button onClick={handleAbrir}>
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
