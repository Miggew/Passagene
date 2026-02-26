/**
 * Dialog multi-step para criar anúncio C2C.
 * Steps: tipo → detalhes (título, descrição, preço) → publicar
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { useCriarAnuncio } from '@/hooks/useAnuncios';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { AnuncioTipo } from '@/lib/types';

interface CriarAnuncioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tipoOptions: Array<{ value: AnuncioTipo; label: string; desc: string }> = [
  { value: 'doadora', label: 'Doadora', desc: 'Vaca doadora de oócitos ou embriões' },
  { value: 'touro', label: 'Touro', desc: 'Touro para reprodução' },
  { value: 'embriao', label: 'Embrião', desc: 'Embriões congelados ou frescos' },
  { value: 'dose', label: 'Dose de Sêmen', desc: 'Doses de sêmen congelado' },
  { value: 'outro', label: 'Outro', desc: 'Outro tipo de material genético' },
];

export default function CriarAnuncioDialog({ open, onOpenChange }: CriarAnuncioDialogProps) {
  const criarAnuncio = useCriarAnuncio();
  const { clienteId } = usePermissions();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    tipo: 'doadora' as AnuncioTipo,
    titulo: '',
    descricao: '',
    preco: '',
    preco_negociavel: false,
    publicar: true,
  });

  const resetForm = () => {
    setStep(0);
    setForm({
      tipo: 'doadora',
      titulo: '',
      descricao: '',
      preco: '',
      preco_negociavel: false,
      publicar: true,
    });
  };

  const handlePublicar = async () => {
    try {
      await criarAnuncio.mutateAsync({
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        preco: form.preco ? parseFloat(form.preco.replace(',', '.')) : undefined,
        preco_negociavel: form.preco_negociavel,
        cliente_id: clienteId || undefined,
        status: form.publicar ? 'ATIVO' : 'RASCUNHO',
      });
      toast.success(form.publicar ? 'Anúncio publicado!' : 'Rascunho salvo!');
      resetForm();
      onOpenChange(false);
    } catch {
      // handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 0 ? 'Tipo do Anúncio' : 'Detalhes do Anúncio'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 0: Tipo */}
        {step === 0 && (
          <div className="space-y-3 mt-2">
            {tipoOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setForm(f => ({ ...f, tipo: opt.value }))}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  form.tipo === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}

            <Button onClick={() => setStep(1)} className="w-full mt-2">
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 1: Detalhes + Publicar */}
        {step === 1 && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Doadora Holandesa A2A2 com 3 estrelas"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes sobre o animal ou material..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  value={form.preco}
                  onChange={(e) => setForm(f => ({ ...f, preco: e.target.value }))}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.preco_negociavel}
                    onCheckedChange={(v) => setForm(f => ({ ...f, preco_negociavel: v }))}
                  />
                  <Label className="text-xs">Negociável</Label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <Label>Publicar agora</Label>
                <p className="text-xs text-muted-foreground">Ou salvar como rascunho</p>
              </div>
              <Switch
                checked={form.publicar}
                onCheckedChange={(v) => setForm(f => ({ ...f, publicar: v }))}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <Button
                onClick={handlePublicar}
                disabled={criarAnuncio.isPending || !form.titulo.trim()}
                className="flex-1"
              >
                {criarAnuncio.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    {form.publicar ? 'Publicar' : 'Salvar'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
