import { useState } from 'react';
import { Button, Card, Badge } from '@/components/ui/mobile-atoms';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Check, Edit, Loader2 } from 'lucide-react';
import { AspiracaoDraft } from '../AspiracaoWizard';

export default function Step3Resumo({ draft, onBack, onClear }: { draft: AspiracaoDraft, onBack: () => void, onClear: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const totalOocitos = draft.doadoras.reduce((acc, d) => 
    acc + d.oocitos.viaveis + d.oocitos.imature + d.oocitos.degenerados, 0);

  const handleFinalizar = async () => {
    setLoading(true);
    try {
      // 1. Criar Pacote
      const { data: pacote, error: errPacote } = await supabase
        .from('pacotes_aspiracao')
        .insert({
          fazenda_id: draft.setup.fazenda_id,
          data_aspiracao: draft.setup.data,
          horario_inicio: draft.setup.horario || null,
          veterinario_responsavel: draft.setup.veterinario,
          tecnico_responsavel: draft.setup.tecnico,
          total_oocitos: totalOocitos,
          status: 'FINALIZADO',
          // Legacy: pega o primeiro destino ou null
          fazenda_destino_id: null 
        })
        .select()
        .single();

      if (errPacote) throw errPacote;

      // 2. Inserir Aspirações (Doadoras)
      const aspiracoes = draft.doadoras.map(d => ({
        pacote_aspiracao_id: pacote.id,
        doadora_id: d.realId || d.id, // Assumindo que realId existe ou id é valido
        fazenda_id: draft.setup.fazenda_id,
        data_aspiracao: draft.setup.data,
        viaveis: d.oocitos.viaveis,
        desnudos: d.oocitos.imature, // Simplificação: imaturos -> desnudos por enquanto
        degenerados: d.oocitos.degenerados,
        total_oocitos: d.oocitos.viaveis + d.oocitos.imature + d.oocitos.degenerados,
        veterinario_responsavel: draft.setup.veterinario,
        tecnico_responsavel: draft.setup.tecnico
      }));

      const { error: errAsp } = await supabase
        .from('aspiracoes_doadoras')
        .insert(aspiracoes);

      if (errAsp) throw errAsp;

      toast({ title: "Sucesso!", description: "Aspiração finalizada e sincronizada." });
      onClear();

    } catch (error: any) {
      toast({ 
        title: "Erro ao finalizar", 
        description: error.message || "Tente novamente.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <Card className="p-4 bg-primary/5 border-primary/20">
        <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Resumo da Sessão</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-primary/10 pb-2">
            <span className="text-muted-foreground">Veterinário</span>
            <span className="font-medium">{draft.setup.veterinario}</span>
          </div>
          <div className="flex justify-between border-b border-primary/10 pb-2">
            <span className="text-muted-foreground">Data</span>
            <span className="font-medium">{new Date(draft.setup.data).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-muted-foreground">Total Doadoras</span>
            <span className="font-display font-bold text-xl text-foreground tracking-tighter">{draft.doadoras.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Oócitos</span>
            <span className="font-display font-bold text-xl text-primary tracking-tighter">{totalOocitos}</span>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Doadoras Adicionadas</span>
          <Button variant="ghost" size="sm" onClick={onBack} className="h-6 text-[10px] font-mono text-primary uppercase tracking-wider">
            <Edit className="w-3 h-3 mr-1" /> Editar
          </Button>
        </div>
        {draft.doadoras.map(d => (
          <div key={d.id} className="flex justify-between items-center py-3 border-b border-border/30 text-sm">
            <div className="font-display font-bold tracking-tight text-foreground">{d.registro}</div>
            <div className="flex gap-4 font-mono text-[10px]">
              <span className="text-primary font-bold">V: {d.oocitos.viaveis}</span>
              <span className="text-muted-foreground/60 font-medium">I: {d.oocitos.imature}</span>
              <span className="text-muted-foreground/60 font-medium">D: {d.oocitos.degenerados}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button 
          size="lg" 
          fullWidth 
          onClick={handleFinalizar} 
          disabled={loading}
          className="shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
          Confirmar e Enviar
        </Button>
      </div>
    </div>
  );
}
