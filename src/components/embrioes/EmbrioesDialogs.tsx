import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import DatePickerBR from '@/components/shared/DatePickerBR';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate } from '@/lib/utils';
import type { Fazenda, Cliente } from '@/lib/types';
import type { EmbrioCompleto, PacoteEmbrioes, HistoricoEmbriao } from '@/hooks/embrioes';
import { ClassificarForm } from './ClassificarForm';

// Types for dialog data
export interface CongelarData {
  data_congelamento: string;
  localizacao_atual: string;
  cliente_id: string; // Cliente dono do embrião congelado
}

export interface DescartarData {
  data_descarte: string;
  observacoes: string;
}

export interface DirecionarClienteData {
  cliente_id: string;
}

// Classification Dialog (Individual)
interface ClassificarDialogIndividualProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embriao: EmbrioCompleto | null;
  classificacao: string;
  onClassificacaoChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function ClassificarDialogIndividual({
  open,
  onOpenChange,
  embriao,
  classificacao,
  onClassificacaoChange,
  onSubmit,
  submitting,
}: ClassificarDialogIndividualProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Classificar Embrião</DialogTitle>
          <DialogDescription>
            {embriao?.identificacao || 'Embrião selecionado'}
          </DialogDescription>
        </DialogHeader>
        <ClassificarForm
          value={classificacao}
          onChange={onClassificacaoChange}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          submitting={submitting}
          buttonLabel="Salvar Classificação"
        />
      </DialogContent>
    </Dialog>
  );
}

// Classification Dialog (Batch)
interface ClassificarDialogBatchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  classificacao: string;
  onClassificacaoChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function ClassificarDialogBatch({
  open,
  onOpenChange,
  count,
  classificacao,
  onClassificacaoChange,
  onSubmit,
  submitting,
}: ClassificarDialogBatchProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Classificar {count} Embrião(ões)</DialogTitle>
          <DialogDescription>Mesma classificação para todos</DialogDescription>
        </DialogHeader>
        <ClassificarForm
          value={classificacao}
          onChange={onClassificacaoChange}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          submitting={submitting}
          buttonLabel={`Classificar ${count}`}
        />
      </DialogContent>
    </Dialog>
  );
}

// Freeze Dialog
interface CongelarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  data: CongelarData;
  clientes: Cliente[];
  onDataChange: (data: CongelarData) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function CongelarDialog({
  open,
  onOpenChange,
  count,
  data,
  clientes,
  onDataChange,
  onSubmit,
  submitting,
}: CongelarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Congelar {count} Embrião(ões)</DialogTitle>
          <DialogDescription>
            Defina os dados do congelamento e o cliente dono do embrião
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data de Congelamento *</Label>
            <DatePickerBR
              value={data.data_congelamento}
              onChange={(v) => onDataChange({ ...data, data_congelamento: v || '' })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Localização (Botijão) *</Label>
            <Input
              value={data.localizacao_atual}
              onChange={(e) => onDataChange({ ...data, localizacao_atual: e.target.value })}
              placeholder="Ex: Botijão 1, Canister A"
            />
          </div>
          <div className="space-y-2">
            <Label>Cliente (Dono do Embrião) *</Label>
            <Select
              value={data.cliente_id}
              onValueChange={(v) => onDataChange({ ...data, cliente_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={onSubmit}
              className="flex-1"
              disabled={submitting || !data.cliente_id}
            >
              {submitting ? 'Congelando...' : 'Congelar'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Discard Dialog
interface DescartarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  data: DescartarData;
  onDataChange: (data: DescartarData) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function DescartarDialog({
  open,
  onOpenChange,
  count,
  data,
  onDataChange,
  onSubmit,
  submitting,
}: DescartarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Descartar {count} Embrião(ões)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data de Descarte *</Label>
            <DatePickerBR
              value={data.data_descarte}
              onChange={(v) => onDataChange({ ...data, data_descarte: v || '' })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Observações / Motivo</Label>
            <Textarea
              value={data.observacoes}
              onChange={(e) => onDataChange({ ...data, observacoes: e.target.value })}
              placeholder="Motivo do descarte (opcional)"
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={onSubmit}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={submitting}
            >
              {submitting ? 'Descartando...' : 'Descartar'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Client Direction Dialog
interface DirecionarClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
  data: DirecionarClienteData;
  onDataChange: (data: DirecionarClienteData) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function DirecionarClienteDialog({
  open,
  onOpenChange,
  clientes,
  data,
  onDataChange,
  onSubmit,
  submitting,
}: DirecionarClienteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Direcionar para Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              value={data.cliente_id}
              onValueChange={(v) => onDataChange({ cliente_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={onSubmit}
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? 'Direcionando...' : 'Direcionar'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// History Sheet
interface HistoricoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embriao: EmbrioCompleto | null;
  historico: HistoricoEmbriao[];
  loading: boolean;
}

const tipoOperacaoConfig: Record<string, { label: string; color: string; icon: string }> = {
  CLASSIFICACAO: { label: 'Classificação', color: 'bg-primary-subtle text-primary-subtle-foreground border-primary/30', icon: '🏷️' },
  CONGELAMENTO: { label: 'Congelamento', color: 'bg-secondary text-secondary-foreground border-primary/20', icon: '❄️' },
  DESCARTE: { label: 'Descarte', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: '🗑️' },
  DESTINACAO: { label: 'Direcionamento', color: 'bg-primary-subtle text-primary-subtle-foreground border-primary/30', icon: '👤' },
  TRANSFERENCIA: { label: 'Transferência', color: 'bg-secondary text-secondary-foreground border-primary/20', icon: '🔄' },
};

export function HistoricoSheet({
  open,
  onOpenChange,
  embriao,
  historico,
  loading,
}: HistoricoSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Histórico do Embrião
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">
              {embriao?.identificacao || embriao?.id?.slice(0, 8)}
            </span>
            {embriao && (
              <StatusBadge status={embriao.status_atual} />
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Embryo info summary */}
        {embriao && (
          <Card className="mt-4 bg-muted border-border">
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Doadora:</span>
                  <span className="ml-2 font-medium text-foreground">{embriao.doadora_registro || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Touro:</span>
                  <span className="ml-2 font-medium text-foreground">{embriao.touro_nome || '-'}</span>
                </div>
                {embriao.classificacao && (
                  <div>
                    <span className="text-muted-foreground">Classificação:</span>
                    <span className="ml-2 font-medium text-foreground">{embriao.classificacao}</span>
                  </div>
                )}
                {embriao.localizacao_atual && (
                  <div>
                    <span className="text-muted-foreground">Localização:</span>
                    <span className="ml-2 font-medium text-foreground">{embriao.localizacao_atual}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-muted-foreground">Nenhum histórico registrado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                As operações realizadas aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-border" />

              {/* Timeline items */}
              <div className="space-y-4">
                {historico.map((item, index) => {
                  const config = tipoOperacaoConfig[item.tipo_operacao] || {
                    label: item.tipo_operacao,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: '📌',
                  };

                  return (
                    <div key={item.id} className="relative flex gap-3">
                      {/* Timeline dot */}
                      <div className={`
                        relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                        ${index === 0 ? 'glass-panel border-2 border-primary' : 'glass-panel border border-border'}
                      `}>
                        <span className="text-sm">{config.icon}</span>
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-4 ${index === historico.length - 1 ? 'pb-0' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
                              {config.label}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.data_mudanca ? formatDate(item.data_mudanca) : '-'}
                            </p>
                          </div>
                          {item.status_novo && (
                            <StatusBadge status={item.status_novo} />
                          )}
                        </div>
                        {item.observacoes && (
                          <p className="text-sm text-foreground mt-2 bg-muted p-2 rounded border border-border">
                            {item.observacoes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Edit Destination Fazendas Dialog
interface EditarFazendasDestinoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacote: PacoteEmbrioes | null;
  fazendas: Fazenda[];
  fazendasSelecionadas: string[];
  onFazendasChange: (ids: string[]) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function EditarFazendasDestinoDialog({
  open,
  onOpenChange,
  pacote,
  fazendas,
  fazendasSelecionadas,
  onFazendasChange,
  onSubmit,
  submitting,
}: EditarFazendasDestinoDialogProps) {
  const handleToggleFazenda = (fazendaId: string, checked: boolean) => {
    if (checked) {
      onFazendasChange([...fazendasSelecionadas, fazendaId]);
    } else {
      onFazendasChange(fazendasSelecionadas.filter((id) => id !== fazendaId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Fazendas Destino</DialogTitle>
          <DialogDescription>Selecione as fazendas destino do pacote</DialogDescription>
        </DialogHeader>
        {pacote && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto border border-border rounded-md p-3">
              {fazendas.map((fazenda) => (
                <label
                  key={fazenda.id}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={fazendasSelecionadas.includes(fazenda.id)}
                    onChange={(e) => handleToggleFazenda(fazenda.id, e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">{fazenda.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
