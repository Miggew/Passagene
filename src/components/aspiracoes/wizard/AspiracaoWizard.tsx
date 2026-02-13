import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/mobile-atoms';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Step1Setup from './steps/Step1Setup';
import Step2Doadoras from './steps/Step2Doadoras';
import Step3Resumo from './steps/Step3Resumo';

// Tipos para o Wizard
export interface AspiracaoDraft {
  step: number;
  setup: {
    fazenda_id: string;
    data: string;
    horario: string;
    veterinario: string;
    tecnico: string;
    fazendas_destino_ids: string[];
  };
  doadoras: DoadoraWizard[];
}

export interface DoadoraWizard {
  id: string; // tempId ou realId
  realId?: string; // ID do banco se existir
  registro: string;
  nome?: string;
  raca?: string;
  isNew?: boolean;
  oocitos: {
    viaveis: number;
    imature: number; // vn/dn
    degenerados: number;
    // outros se precisar
  };
  touro?: string;
  obs?: string;
}

const DRAFT_KEY = 'passagene_wizard_aspiracao_v1';

export default function AspiracaoWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<AspiracaoDraft>({
    step: 1,
    setup: {
      fazenda_id: '',
      data: new Date().toISOString().split('T')[0],
      horario: '',
      veterinario: '',
      tecnico: '',
      fazendas_destino_ids: [],
    },
    doadoras: [],
  });

  // Carregar Rascunho
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDraft(parsed);
        setStep(parsed.step || 1);
        toast({
          title: "Rascunho recuperado",
          description: "Continuando de onde você parou.",
        });
      } catch (e) {
        console.error("Erro ao carregar rascunho", e);
      }
    }
  }, []);

  // Salvar Rascunho (Auto-save)
  useEffect(() => {
    const toSave = { ...draft, step };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave));
  }, [draft, step]);

  const updateSetup = (data: Partial<AspiracaoDraft['setup']>) => {
    setDraft(prev => ({ ...prev, setup: { ...prev.setup, ...data } }));
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      {/* Header Wizard */}
      <div className="flex items-center px-4 py-3 border-b border-border/50 bg-card/30 backdrop-blur-md sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => step > 1 ? prevStep() : navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 text-center">
          <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.15em] mb-0.5">
            Passo {step} de 3
          </div>
          <h2 className="text-base font-display font-bold text-foreground tracking-tighter leading-none">
            {step === 1 && "Configuração da Sessão"}
            {step === 2 && "Entrada de Doadoras"}
            {step === 3 && "Revisão e Envio"}
          </h2>
        </div>
        <div className="w-9" />
      </div>

      {/* Conteúdo do Passo */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === 1 && (
          <Step1Setup 
            data={draft.setup} 
            onChange={updateSetup} 
            onNext={nextStep} 
          />
        )}
        {step === 2 && (
          <Step2Doadoras 
            setup={draft.setup}
            doadoras={draft.doadoras}
            setDoadoras={(d) => setDraft(prev => ({ ...prev, doadoras: d }))}
            onNext={nextStep}
          />
        )}
        {step === 3 && (
          <Step3Resumo 
            draft={draft}
            onBack={prevStep}
            onClear={() => {
              localStorage.removeItem(DRAFT_KEY);
              navigate(0); // Reload para limpar estado
            }}
          />
        )}
      </div>
    </div>
  );
}
