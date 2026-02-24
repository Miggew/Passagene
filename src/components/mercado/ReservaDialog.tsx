/**
 * Dialog/Sheet de reserva de animal do catálogo genético
 * Mobile: Sheet (bottom drawer), Desktop: Dialog
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { CowIcon } from '@/components/icons/CowIcon';
import { Loader2 } from 'lucide-react';

interface AnimalResumo {
  catalogoId: string;
  tipo: 'doadora' | 'touro';
  nome: string;
  registro: string;
  foto: string | null;
  preco: number | null;
}

interface ReservaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animal: AnimalResumo | null;
  onSubmit: (data: {
    catalogo_id: string;
    tipo: 'doadora' | 'touro';
    data_desejada?: string;
    quantidade_embrioes?: number;
    observacoes?: string;
  }) => void;
  loading?: boolean;
}

export function ReservaDialog({
  open,
  onOpenChange,
  animal,
  onSubmit,
  loading,
}: ReservaDialogProps) {
  const [dataDesejada, setDataDesejada] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const handleSubmit = () => {
    if (!animal) return;

    onSubmit({
      catalogo_id: animal.catalogoId,
      tipo: animal.tipo,
      data_desejada: dataDesejada || undefined,
      quantidade_embrioes: quantidade ? parseInt(quantidade, 10) : undefined,
      observacoes: observacoes || undefined,
    });

    // Limpar form
    setDataDesejada('');
    setQuantidade('');
    setObservacoes('');
  };

  if (!animal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Reserva</DialogTitle>
          <DialogDescription>
            Preencha os campos opcionais abaixo para solicitar a reserva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Mini-card resumo */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
              {animal.foto ? (
                <img
                  src={animal.foto}
                  alt={animal.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CowIcon className="w-7 h-7 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{animal.nome}</p>
              <p className="text-xs text-muted-foreground font-mono">{animal.registro}</p>
              {animal.preco && (
                <p className="text-sm font-mono font-bold text-gradient-logo mt-0.5">
                  {animal.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              )}
            </div>
          </div>

          {/* Data desejada */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Data desejada para {animal.tipo === 'doadora' ? 'aspiração' : 'coleta'} (opcional)
            </Label>
            <DatePickerBR
              value={dataDesejada}
              onChange={setDataDesejada}
              placeholder="Selecionar data..."
            />
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Quantidade de {animal.tipo === 'doadora' ? 'embriões' : 'doses'} desejada (opcional)
            </Label>
            <Input
              type="number"
              min={1}
              placeholder="Ex: 5"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observações (opcional)</Label>
            <Textarea
              placeholder="Informações adicionais sobre sua reserva..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full btn-primary-gold border-0"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Solicitar Reserva
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
