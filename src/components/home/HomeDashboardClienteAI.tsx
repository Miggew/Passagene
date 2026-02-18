/**
 * Dashboard do Cliente — Cockpit V2 (No-Scroll, Expandable)
 */

import { useState } from 'react';
import { Sparkles, X, Maximize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { WeatherWidget } from './widgets/WeatherWidget';
import { MarketWidget } from './widgets/MarketWidget';
import { NewsWidget } from './widgets/NewsWidget';
import { FarmSummaryWidget } from './widgets/FarmSummaryWidget';

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

  // Wrapper para tornar qualquer widget clicável/expansível
  const WidgetWrapper = ({ id, children, className = '' }: { id: string, children: React.ReactNode, className?: string }) => (
    <motion.div
      layoutId={`widget-${id}`}
      onClick={() => setExpandedWidget(id)}
      className={`relative cursor-pointer group ${className}`}
      whileHover={{ scale: 1.01 }}
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
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34d399]/20 to-[#34d399]/5 border border-[#34d399]/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#34d399]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-heading leading-tight">
            {getSaudacao()}, {primeiroNome}!
          </h1>
          <p className="text-xs text-[#8a9e94]">
            Visão geral da fazenda
          </p>
        </div>
      </div>

      {/* Grid Cockpit Principal - 2x2 (4 cantos) */}
      <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1 min-h-0">

        {/* Canto Superior Esquerdo: Fazenda */}
        <WidgetWrapper id="farm" className="h-full">
          <FarmSummaryWidget compact={true} clienteId={clienteId} />
        </WidgetWrapper>

        {/* Canto Superior Direito: Clima */}
        <WidgetWrapper id="weather" className="h-full">
          <WeatherWidget compact={true} />
        </WidgetWrapper>

        {/* Canto Inferior Esquerdo: Mercado */}
        <WidgetWrapper id="market" className="h-full">
          <MarketWidget compact={true} />
        </WidgetWrapper>

        {/* Canto Inferior Direito: Notícias */}
        <WidgetWrapper id="news" className="h-full">
          <NewsWidget compact={true} />
        </WidgetWrapper>
      </div>

      {/* Overlay de Expansão */}
      <AnimatePresence>
        {expandedWidget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setExpandedWidget(null)}>
            <motion.div
              layoutId={`widget-${expandedWidget}`}
              className="w-full max-w-4xl h-[80vh] bg-[#0a0f0d] rounded-2xl border border-[#1e2e28] overflow-hidden relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedWidget(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="h-full p-8 overflow-y-auto">
                <h2 className="text-2xl font-bold text-white mb-6">Detalhamento Completo</h2>
                {expandedWidget === 'farm' && <FarmSummaryWidget clienteId={clienteId} />}
                {expandedWidget === 'weather' && <WeatherWidget />}
                {expandedWidget === 'market' && <MarketWidget />}
                {expandedWidget === 'news' && <NewsWidget />}

                <div className="mt-8 p-4 bg-[#131c18] rounded-xl border border-[#1e2e28] text-[#8a9e94] text-sm">
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
