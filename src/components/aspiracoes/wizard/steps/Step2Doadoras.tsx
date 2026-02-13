import { useState, useEffect, useMemo } from 'react';
import { Button, Card, Badge } from '@/components/ui/mobile-atoms';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Trash2, Edit2 } from 'lucide-react';
import { DoadoraWizard } from '../AspiracaoWizard';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function Step2Doadoras({ setup, doadoras, setDoadoras, onNext }: any) {
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [disponiveis, setDisponiveis] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoadora, setEditingDoadora] = useState<DoadoraWizard | null>(null);

  // Form state
  const [formOocitos, setFormOocitos] = useState({ viaveis: '', imature: '', degenerados: '' });

  useEffect(() => {
    if (setup.fazenda_id) {
      supabase.from('doadoras').select('*').eq('fazenda_id', setup.fazenda_id)
        .then(({ data }) => setDisponiveis(data || []));
    }
  }, [setup.fazenda_id]);

  const filtradas = useMemo(() => {
    if (!busca) return [];
    return disponiveis.filter(d => 
      d.registro.toLowerCase().includes(busca.toLowerCase()) || 
      (d.nome && d.nome.toLowerCase().includes(busca.toLowerCase()))
    ).slice(0, 5); // Max 5 sugestões
  }, [busca, disponiveis]);

  const openEdit = (doadora: DoadoraWizard) => {
    setEditingDoadora(doadora);
    setFormOocitos({
      viaveis: String(doadora.oocitos.viaveis || ''),
      imature: String(doadora.oocitos.imature || ''),
      degenerados: String(doadora.oocitos.degenerados || '')
    });
    setModalOpen(true);
  };

  const openNew = (baseDoadora: any) => {
    const newDoadora: DoadoraWizard = {
      id: Math.random().toString(36),
      realId: baseDoadora.id,
      registro: baseDoadora.registro,
      nome: baseDoadora.nome,
      raca: baseDoadora.raca,
      oocitos: { viaveis: 0, imature: 0, degenerados: 0 }
    };
    openEdit(newDoadora);
  };

  const saveDoadora = () => {
    if (!editingDoadora) return;
    
    const updated = {
      ...editingDoadora,
      oocitos: {
        viaveis: Number(formOocitos.viaveis) || 0,
        imature: Number(formOocitos.imature) || 0,
        degenerados: Number(formOocitos.degenerados) || 0
      }
    };

    // Update or Add
    const exists = doadoras.find((d: any) => d.id === updated.id);
    if (exists) {
      setDoadoras(doadoras.map((d: any) => d.id === updated.id ? updated : d));
    } else {
      setDoadoras([...doadoras, updated]);
    }

    setModalOpen(false);
    setBusca('');
    setEditingDoadora(null);
  };

  const removeDoadora = (id: string) => {
    setDoadoras(doadoras.filter((d: any) => d.id !== id));
  };

  const totalOocitos = useMemo(() => doadoras.reduce((acc: number, d: any) => 
    acc + d.oocitos.viaveis + d.oocitos.imature + d.oocitos.degenerados, 0), [doadoras]);

  return (
    <div className="space-y-6 pb-20">
      {/* Search Bar Sticky */}
      <div className="sticky top-0 bg-background pt-2 pb-4 z-10 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar Doadora (Registro ou Nome)" 
            className="pl-9 h-12 text-base"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        
        {/* Sugestões */}
        {busca && (
          <div className="absolute top-16 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-20 overflow-hidden">
            {filtradas.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Nenhuma doadora encontrada</div>
            ) : (
              filtradas.map(d => (
                <button 
                  key={d.id}
                  onClick={() => openNew(d)}
                  className="w-full text-left p-3 hover:bg-muted border-b border-border/50 last:border-0 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-foreground">{d.registro}</div>
                    <div className="text-xs text-muted-foreground">{d.nome}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{d.raca}</Badge>
                </button>
              ))
            )}
            <Button variant="ghost" className="w-full text-primary text-xs h-10 border-t border-border" onClick={() => {
               // Logica para criar nova doadora rápida
               toast({ title: "Criar doadora rápida", description: "Funcionalidade futura (use 'Nova Doadora' no menu)" });
            }}>
              <Plus className="w-3 h-3 mr-1" /> Criar "{busca}"
            </Button>
          </div>
        )}
      </div>

      {/* Lista de Adicionadas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider font-bold text-muted-foreground px-1">
          <span>Lançadas ({doadoras.length})</span>
          <span>Total: {totalOocitos}</span>
        </div>

        {doadoras.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
            <p className="text-muted-foreground text-sm">Nenhuma doadora lançada.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Busque acima para adicionar.</p>
          </div>
        )}

        {doadoras.map((d: DoadoraWizard) => (
          <Card key={d.id} className="p-4 flex justify-between items-center active:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(d)}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tighter text-foreground">{d.registro}</span>
                {d.raca && <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5 uppercase tracking-wider">{d.raca}</Badge>}
              </div>
              <div className="text-xs font-sans text-muted-foreground">{d.nome || 'Sem nome'}</div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-display font-extrabold text-primary leading-none tracking-tighter">
                  {d.oocitos.viaveis + d.oocitos.imature + d.oocitos.degenerados}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase mt-1 tracking-widest">Viáveis: <span className="text-primary font-bold">{d.oocitos.viaveis}</span></div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground/30 hover:text-destructive transition-colors"
                onClick={(e) => { e.stopPropagation(); removeDoadora(d.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button size="lg" fullWidth onClick={onNext} disabled={doadoras.length === 0} className="shadow-lg shadow-primary/20">
          Revisar e Finalizar ({doadoras.length})
        </Button>
      </div>

      {/* Modal Edição Oócitos */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="top-[20%] translate-y-0 sm:translate-y-[-50%] sm:top-[50%]">
          <DialogHeader>
            <DialogTitle>{editingDoadora?.registro}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="space-y-1 text-center">
              <label className="text-xs font-bold uppercase text-primary">Viáveis</label>
              <Input 
                type="number" inputMode="numeric" pattern="[0-9]*"
                className="h-14 text-center text-xl font-bold border-primary/50 bg-primary/5 focus:ring-primary"
                value={formOocitos.viaveis}
                onChange={e => setFormOocitos({...formOocitos, viaveis: e.target.value})}
                autoFocus
              />
            </div>
            <div className="space-y-1 text-center">
              <label className="text-xs font-bold uppercase text-muted-foreground">Imat/Dn</label>
              <Input 
                type="number" inputMode="numeric" pattern="[0-9]*"
                className="h-14 text-center text-xl"
                value={formOocitos.imature}
                onChange={e => setFormOocitos({...formOocitos, imature: e.target.value})}
              />
            </div>
            <div className="space-y-1 text-center">
              <label className="text-xs font-bold uppercase text-muted-foreground">Degen</label>
              <Input 
                type="number" inputMode="numeric" pattern="[0-9]*"
                className="h-14 text-center text-xl"
                value={formOocitos.degenerados}
                onChange={e => setFormOocitos({...formOocitos, degenerados: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveDoadora} size="lg" fullWidth>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
