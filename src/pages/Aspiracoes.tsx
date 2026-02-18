import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Fazenda, Doadora } from '@/lib/types';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { AspiracaoFormNova } from '@/components/aspiracoes/AspiracaoFormNova';
import { AspiracaoDoadoras } from '@/components/aspiracoes/AspiracaoDoadoras';
import { useAspiracaoSessao } from '@/hooks/useAspiracaoSessao';

export default function Aspiracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Custom Hook for Session State
  const {
    currentStep,
    setCurrentStep,
    submitting,
    formData,
    setFormData,
    fazendasDestinoIds,
    setFazendasDestinoIds,
    doadoras,
    setDoadoras,
    handleContinuar,
    handleFinalizar,
    showRestaurarDialog,
    setShowRestaurarDialog,
    restaurarRascunho,
    descartarRascunho,
    temDadosNaoSalvos
  } = useAspiracaoSessao();

  // Shared Data State
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loadingFazendas, setLoadingFazendas] = useState(false);
  const [doadorasDisponiveis, setDoadorasDisponiveis] = useState<Doadora[]>([]);
  const [loadingDoadoras, setLoadingDoadoras] = useState(false);

  // Load Fazendas on mount
  useEffect(() => {
    loadFazendas();
  }, []);

  // Load Doadoras when fazenda changes and step is doadoras
  useEffect(() => {
    if (formData.fazenda_id && currentStep === 'doadoras') {
      loadDoadorasDisponiveis();
    }
  }, [formData.fazenda_id, currentStep]);

  const loadFazendas = async () => {
    try {
      setLoadingFazendas(true);
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingFazendas(false);
    }
  };

  const loadDoadorasDisponiveis = async () => {
    if (!formData.fazenda_id) return;

    try {
      setLoadingDoadoras(true);
      const { data, error } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', formData.fazenda_id)
        .order('registro', { ascending: true });

      if (error) throw error;

      // Filter out already added donors
      const idsAdicionados = doadoras.map(d => d.doadora_id);
      const disponiveis = (data || []).filter(d => !idsAdicionados.includes(d.id));
      setDoadorasDisponiveis(disponiveis);
    } catch (error) {
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingDoadoras(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aspiração Folicular"
        description="Registre novas sessões de aspiração de oócitos (OPU)"
      />

      {currentStep === 'form' && (
        <AspiracaoFormNova
          formData={formData}
          setFormData={setFormData}
          fazendas={fazendas}
          loadingFazendas={loadingFazendas}
          onContinuar={handleContinuar}
          temDadosNaoSalvos={temDadosNaoSalvos}
          onRestaurarRascunho={() => setShowRestaurarDialog(true)}
        />
      )}

      {currentStep === 'doadoras' && (
        <AspiracaoDoadoras
          formData={formData}
          fazendasDestinoIds={fazendasDestinoIds}
          setFazendasDestinoIds={setFazendasDestinoIds}
          doadoras={doadoras}
          setDoadoras={setDoadoras}
          doadorasDisponiveis={doadorasDisponiveis}
          loadingDoadoras={loadingDoadoras}
          onVoltar={() => setCurrentStep('form')}
          onFinalizar={handleFinalizar}
          submitting={submitting}
        />
      )}

      {/* Dialog Restaurar Rascunho */}
      <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rascunho Encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              Existe uma sessão de aspiração não finalizada salva em seu navegador.
              Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={descartarRascunho}>Descartar</AlertDialogCancel>
            <AlertDialogAction onClick={restaurarRascunho}>Restaurar Sessão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
