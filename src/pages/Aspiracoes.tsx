import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao, Fazenda, Doadora } from '@/lib/types';
import { Button, Card, Badge } from '@/components/ui/mobile-atoms'; // Usando os átomos do DS v4
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import {
  PlayCircle,
  Smartphone,
  LayoutGrid,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import AspiracaoWizard from '@/components/aspiracoes/wizard/AspiracaoWizard';
import { useIsMobile } from '@/hooks/use-mobile';

// ==================== TYPES ====================

interface DoadoraLocal {
  id: string;
  doadora_id: string;
  registro: string;
  nome?: string;
  viaveis: number;
  imature: number;
  degenerados: number;
  total_oocitos: number;
}

const RASCUNHO_KEY = 'passagene_aspiracao_classic_rascunho';

export default function Aspiracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobileSize = useIsMobile();
  const [mode, setMode] = useState<'classic' | 'wizard'>(isMobileSize ? 'wizard' : 'classic');

  // ========== ESTADOS ==========
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'doadoras'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);

  const [formData, setFormData] = useState({
    fazenda_id: '',
    data_aspiracao: new Date().toISOString().split('T')[0],
    horario_inicio: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  const [doadoras, setDoadoras] = useState<DoadoraLocal[]>([]);

  // ========== COMPUTED ==========
  const totalOocitos = useMemo(() => doadoras.reduce((sum, d) => sum + d.total_oocitos, 0), [doadoras]);
  const canFinalizar = doadoras.length > 0 && formData.fazenda_id;

  // ========== EFEITOS ==========
  useEffect(() => {
    supabase.from('fazendas').select('id, nome').order('nome').then(({ data }) => {
      if (data) setFazendas(data);
    });
  }, []);

  // ========== FUNÇÕES ==========
  const handleUpdateDoadora = (index: number, field: keyof DoadoraLocal, value: any) => {
    setDoadoras(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      const d = copy[index];
      copy[index].total_oocitos = Number(d.viaveis||0) + Number(d.imature||0) + Number(d.degenerados||0);
      return copy;
    });
  };

  const handleFinalizar = async () => {
    setSubmitting(true);
    try {
      const { data: pacote, error: errP } = await supabase.from('pacotes_aspiracao').insert({
        fazenda_id: formData.fazenda_id,
        data_aspiracao: formData.data_aspiracao,
        veterinario_responsavel: formData.veterinario_responsavel,
        tecnico_responsavel: formData.tecnico_responsavel,
        total_oocitos: totalOocitos,
        status: 'FINALIZADO'
      }).select().single();

      if (errP) throw errP;

      const { error: errA } = await supabase.from('aspiracoes_doadoras').insert(
        doadoras.map(d => ({
          pacote_aspiracao_id: pacote.id,
          doadora_id: d.doadora_id,
          viaveis: d.viaveis,
          total_oocitos: d.total_oocitos
        }))
      );

      if (errA) throw errA;

      toast({ title: "Sucesso", description: "Aspiração salva com sucesso." });
      setDoadoras([]);
      setCurrentStep('form');
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== RENDER WIZARD ==========
  if (mode === 'wizard') {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/30 backdrop-blur-md">
           <h1 className="font-display font-bold text-lg tracking-tightest">Nova Aspiração</h1>
           <Button variant="ghost" size="sm" onClick={() => setMode('classic')} className="font-mono text-[10px] uppercase tracking-widest text-primary">
             <LayoutGrid className="w-3.5 h-3.5 mr-2" />
             Modo Desktop
           </Button>
        </div>
        <AspiracaoWizard />
      </div>
    );
  }

  // ========== RENDER CLASSIC ==========
  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Aspirações" description="Gerenciar sessões de coleta e biotecnologia" />
        <Button variant="secondary" onClick={() => setMode('wizard')} className="shadow-glow border-primary/20">
          <Smartphone className="w-4 h-4 mr-2" />
          Alternar para Modo Wizard
        </Button>
      </div>

      {/* Configuração da Sessão */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Fazenda Origem</Label>
            <Select value={formData.fazenda_id} onValueChange={v => setFormData({...formData, fazenda_id: v})}>
              <SelectTrigger className="h-12 bg-background border-border/50 font-sans text-sm">
                <SelectValue placeholder="Selecione a fazenda..." />
              </SelectTrigger>
              <SelectContent>
                {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Veterinário</Label>
            <Input className="h-12 bg-background border-border/50 font-sans text-sm" placeholder="Nome do profissional" value={formData.veterinario_responsavel} onChange={e => setFormData({...formData, veterinario_responsavel: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Técnico</Label>
            <Input className="h-12 bg-background border-border/50 font-sans text-sm" placeholder="Nome do assistente" value={formData.tecnico_responsavel} onChange={e => setFormData({...formData, tecnico_responsavel: e.target.value})} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => setCurrentStep('doadoras')} fullWidth size="lg" className="h-12" disabled={!formData.fazenda_id}>
              <PlayCircle className="w-4 h-4 mr-2" /> Começar Coleta
            </Button>
          </div>
        </div>
      </Card>

      {/* Grid de Lançamento (Visível após iniciar) */}
      {currentStep === 'doadoras' && (
        <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-glow">
          <div className="p-4 bg-primary/10 border-b border-primary/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-base tracking-tight">Lançamento de Oócitos</h3>
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground block">Doadoras</span>
                <span className="font-display font-black text-xl leading-none">{doadoras.length}</span>
              </div>
              <div className="h-8 w-px bg-primary/20" />
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary block">Total Oócitos</span>
                <span className="font-display font-black text-xl leading-none text-primary">{totalOocitos}</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="text-center py-12 border-2 border-dashed border-primary/20 rounded-xl bg-background/50">
              <p className="font-sans text-muted-foreground text-sm mb-4">
                O modo clássico está sendo otimizado. 
                Para lançar doadoras com rapidez e suporte offline:
              </p>
              <Button variant="secondary" onClick={() => setMode('wizard')}>
                <Smartphone className="w-4 h-4 mr-2" /> Usar Modo Wizard (Recomendado)
              </Button>
            </div>

            {/* Ações de Rodapé corrigidas com tipografia DS v4 */}
            <div className="flex justify-between items-center pt-6 border-t border-border/50">
              <Button variant="ghost" onClick={() => setCurrentStep('form')} className="font-mono text-[11px] uppercase tracking-widest">
                ← Voltar para Configuração
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" className="font-mono text-[11px] uppercase tracking-widest" onClick={() => navigate('/lab/aspiracoes')}>
                  Cancelar
                </Button>
                <Button loading={submitting} disabled={!canFinalizar} onClick={handleFinalizar} className="px-8 font-display font-bold text-base tracking-tight">
                  Finalizar Sessão
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Dialog de Rascunho */}
      <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
        <AlertDialogContent className="bg-card border-border shadow-glow">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold text-xl tracking-tight">Rascunho Detectado</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-muted-foreground">
              Existe uma sessão de aspiração que não foi concluída. Deseja retomar os dados?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => localStorage.removeItem(RASCUNHO_KEY)} className="font-mono text-[10px] uppercase tracking-widest">Descartar</AlertDialogCancel>
            <AlertDialogAction className="font-mono text-[10px] uppercase tracking-widest bg-primary text-primary-foreground">Restaurar Sessão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
