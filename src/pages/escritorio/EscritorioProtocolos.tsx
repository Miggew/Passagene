import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Syringe } from 'lucide-react';
import EscritorioP1 from './EscritorioP1';
import EscritorioP2 from './EscritorioP2';

export default function EscritorioProtocolos() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeStep, setActiveStep] = useState<'1' | '2'>(
        searchParams.get('step') === '2' ? '2' : '1'
    );

    // Sync tab with URL
    useEffect(() => {
        const step = searchParams.get('step');
        if (step === '1' || step === '2') {
            setActiveStep(step);
        }
    }, [searchParams]);

    const handleStepChange = (value: '1' | '2') => {
        setActiveStep(value);
        setSearchParams({ step: value });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title="Protocolos Sincronização"
                description="Cadastrar e consultar histórico de passos 1 (implante) e 2 (diagnóstico)"
                icon={Syringe}
            />

            <div className="rounded-xl border border-border bg-card p-1.5 w-fit">
                <div className="flex gap-1">
                    <button
                        onClick={() => handleStepChange('1')}
                        className={`
              relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${activeStep === '1'
                                ? 'bg-muted/80 text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                            }
            `}
                    >
                        {activeStep === '1' && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                        )}
                        1º Passo (Implante)
                    </button>

                    <button
                        onClick={() => handleStepChange('2')}
                        className={`
              relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${activeStep === '2'
                                ? 'bg-muted/80 text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                            }
            `}
                    >
                        {activeStep === '2' && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                        )}
                        2º Passo (Confirmação)
                    </button>
                </div>
            </div>

            <div className="mt-6">
                {activeStep === '1' ? (
                    <EscritorioP1 hideHeader />
                ) : (
                    <EscritorioP2 hideHeader />
                )}
            </div>
        </div>
    );
}
