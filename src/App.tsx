import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ScrollToTop from './components/shared/ScrollToTop';
import AppErrorFallback from './components/shared/AppErrorFallback';
import { ErrorBoundary } from 'react-error-boundary';
import LoadingSpinner from './components/shared/LoadingSpinner';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const ClienteForm = lazy(() => import('./pages/ClienteForm'));
const ClienteDetail = lazy(() => import('./pages/ClienteDetail'));
const Fazendas = lazy(() => import('./pages/Fazendas'));
const FazendaDetail = lazy(() => import('./pages/FazendaDetail'));
const Doadoras = lazy(() => import('./pages/Doadoras'));
const DoadoraDetail = lazy(() => import('./pages/DoadoraDetail'));
const Receptoras = lazy(() => import('./pages/Receptoras'));
const ReceptoraHistorico = lazy(() => import('./pages/ReceptoraHistorico'));
const Protocolos = lazy(() => import('./pages/Protocolos'));
const ProtocoloFormWizard = lazy(() => import('./pages/ProtocoloFormWizard'));
const ProtocoloDetail = lazy(() => import('./pages/ProtocoloDetail'));
const ProtocoloPasso2 = lazy(() => import('./pages/ProtocoloPasso2'));
const ProtocoloRelatorioFechado = lazy(() => import('./pages/ProtocoloRelatorioFechado'));
const Aspiracoes = lazy(() => import('./pages/Aspiracoes'));
const PacoteAspiracaoForm = lazy(() => import('./pages/PacoteAspiracaoForm'));
const PacoteAspiracaoDetail = lazy(() => import('./pages/PacoteAspiracaoDetail'));
const DosesSemen = lazy(() => import('./pages/DosesSemen'));
const Touros = lazy(() => import('./pages/Touros'));
const TouroDetail = lazy(() => import('./pages/TouroDetail'));
const LotesFIV = lazy(() => import('./pages/LotesFIV'));
const Embrioes = lazy(() => import('./pages/Embrioes'));
const TransferenciaEmbrioes = lazy(() => import('./pages/TransferenciaEmbrioes'));
const DiagnosticoGestacao = lazy(() => import('./pages/DiagnosticoGestacao'));
const Sexagem = lazy(() => import('./pages/Sexagem'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppRoutes = () => {
  const location = useLocation();
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback} resetKeys={[location.pathname]}>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />

            {/* Clientes */}
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<ClienteForm />} />
            <Route path="/clientes/:id" element={<ClienteDetail />} />
            <Route path="/clientes/:id/editar" element={<ClienteForm />} />

            {/* Fazendas */}
            <Route path="/fazendas" element={<Fazendas />} />
            <Route path="/fazendas/:id" element={<FazendaDetail />} />

            {/* Doadoras */}
            <Route path="/doadoras" element={<Doadoras />} />
            <Route path="/doadoras/:id" element={<DoadoraDetail />} />

            {/* Receptoras */}
            <Route path="/receptoras" element={<Receptoras />} />
            <Route path="/receptoras/:id/historico" element={<ReceptoraHistorico />} />

            {/* Protocolos */}
            <Route path="/protocolos" element={<Protocolos />} />
            <Route path="/protocolos/novo" element={<ProtocoloFormWizard />} />
            <Route path="/protocolos/:id" element={<ProtocoloDetail />} />
            <Route path="/protocolos/:id/passo2" element={<ProtocoloPasso2 />} />
            <Route path="/protocolos/:id/relatorio" element={<ProtocoloRelatorioFechado />} />
            <Route path="/protocolos/fechados/:id/relatorio" element={<ProtocoloRelatorioFechado />} />

            {/* Aspirações */}
            <Route path="/aspiracoes" element={<Aspiracoes />} />
            <Route path="/aspiracoes/novo" element={<PacoteAspiracaoForm />} />
            <Route path="/aspiracoes/:id" element={<PacoteAspiracaoDetail />} />

            {/* Touros */}
            <Route path="/touros" element={<Touros />} />
            <Route path="/touros/:id" element={<TouroDetail />} />

            {/* Doses de Sêmen */}
            <Route path="/doses-semen" element={<DosesSemen />} />

            {/* Lotes FIV */}
            <Route path="/lotes-fiv" element={<LotesFIV />} />
            <Route path="/lotes-fiv/:id" element={<LotesFIV />} />

            {/* Embriões */}
            <Route path="/embrioes" element={<Embrioes />} />

            {/* Transferência de Embriões */}
            <Route path="/transferencia" element={<TransferenciaEmbrioes />} />

            {/* Diagnóstico de Gestação */}
            <Route path="/dg" element={<DiagnosticoGestacao />} />

            {/* Sexagem */}
            <Route path="/sexagem" element={<Sexagem />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <AppRoutes />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
