import { useState } from 'react';
import { Sparkles, Maximize2, X, Dna } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { WeatherWidget } from './widgets/WeatherWidget';
import { MarketWidget } from './widgets/MarketWidget';
import { NewsWidget } from './widgets/NewsWidget';
import { MarketNewsWidget } from './widgets/MarketNewsWidget';
import { AITeaserWidget } from './widgets/AITeaserWidget';

interface Props {
  clienteId?: string;
  clienteNome?: string;
}

export default function HomeDashboardClienteAI({ clienteNome, clienteId }: Props) {
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const primeiroNome = clienteNome?.split(' ')[0] || 'Cliente';

  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Wrapper para tornar qualquer widget clicável/expansível (2x2 grid style)
  const WidgetWrapper = ({ id, children, className = '' }: { id: string, children: React.ReactNode, className?: string }) => (
    <motion.div
      layoutId={`widget-${id}`}
      onClick={() => setExpandedWidget(id)}
      className={`relative cursor-pointer group rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${className}`}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <Maximize2 className="w-4 h-4 text-white/50" />
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full w-full px-1 py-1 overflow-hidden">
      {/* Header Saudação */}
      <div className="flex items-center justify-between mb-4 shrink-0 px-2 mt-1">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white font-heading leading-tight drop-shadow-sm">
              {getSaudacao()}, {primeiroNome}!
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Cockpit Cliente
            </p>
          </div>
        </div>
      </div>

      {/* Mini Banner Genética (Compacto para não gerar scroll) */}
      <div className="mb-3 shrink-0 px-1">
        <div className="relative w-full rounded-xl overflow-hidden min-h-[50px] bg-gradient-to-r from-card to-card/50 border border-border flex items-center px-4 py-2 justify-between cursor-pointer hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Dna className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Bolsa de Genética</h3>
              <p className="text-[10px] text-muted-foreground">Compre e venda prenhezes elite</p>
            </div>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary-light px-2 py-0.5 rounded border border-primary/20 font-bold uppercase tracking-wider">
            Em Breve
          </span>
        </div>
      </div>

      {/* Grid Cockpit Principal - Elegante e Estruturado */}
      <div className="flex flex-col gap-4 md:gap-5 flex-1 min-h-0 px-2 pb-4">

        {/* Topo (Largura Total): Teaser Geno AI com Premium Glassmorphism */}
        <WidgetWrapper id="farm" className="w-full h-auto border-none bg-transparent shrink-0">
          <AITeaserWidget clienteId={clienteId} compact={true} />
        </WidgetWrapper>

        {/* Base: Lado a Lado forçado em TODAS as telas (CSS Grid 2 colunas) */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 mt-2">
          {/* Base Esquerda: Fusão Mercado + Notícias */}
          <WidgetWrapper id="market_news" className="w-full min-w-0 border-none bg-transparent">
            <MarketNewsWidget compact={true} />
          </WidgetWrapper>

          {/* Base Direita: Clima Expandido */}
          <WidgetWrapper id="weather" className="w-full min-w-0 border-none bg-transparent">
            <WeatherWidget compact={true} />
          </WidgetWrapper>
        </div>
      </div>

      {/* Overlay de Expansão */}
      <AnimatePresence>
        {expandedWidget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setExpandedWidget(null)}>
            <motion.div
              layoutId={`widget-${expandedWidget}`}
              className="w-full max-w-4xl h-[80vh] bg-card rounded-2xl border border-border overflow-hidden relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedWidget(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="h-full p-8 overflow-y-auto custom-scrollbar">
                <h2 className="text-2xl font-bold text-foreground mb-6">Detalhamento Completo</h2>
                {expandedWidget === 'farm' && <AITeaserWidget clienteId={clienteId} compact={false} />}
                {expandedWidget === 'weather' && <WeatherWidget />}
                {expandedWidget === 'market_news' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MarketWidget />
                    <NewsWidget />
                  </div>
                )}

                <div className="mt-8 p-4 bg-muted/30 rounded-xl border border-border text-muted-foreground text-sm">
                  Em breve: Gráficos históricos e relatórios detalhados nesta visualização expandida.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
