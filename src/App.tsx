import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import MainLayout from './components/layout/MainLayout';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { ReactElement } from 'react';

const queryClient = new QueryClient();

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const ClienteForm = lazy(() => import('./pages/ClienteForm'));
const ClienteDetail = lazy(() => import('./pages/ClienteDetail'));
const Fazendas = lazy(() => import('./pages/Fazendas'));
const FazendaDetail = lazy(() => import('./pages/FazendaDetail'));
const Doadoras = lazy(() => import('./pages/Doadoras'));
const Receptoras = lazy(() => import('./pages/Receptoras'));
const ReceptoraHistorico = lazy(() => import('./pages/ReceptoraHistorico'));
const Protocolos = lazy(() => import('./pages/Protocolos'));
const ProtocoloForm = lazy(() => import('./pages/ProtocoloForm'));
const ProtocoloDetail = lazy(() => import('./pages/ProtocoloDetail'));
const ProtocoloPasso2 = lazy(() => import('./pages/ProtocoloPasso2'));
const Aspiracoes = lazy(() => import('./pages/Aspiracoes'));
const DosesSemen = lazy(() => import('./pages/DosesSemen'));
const LotesFIV = lazy(() => import('./pages/LotesFIV'));
const Embrioes = lazy(() => import('./pages/Embrioes'));
const TransferenciaEmbrioes = lazy(() => import('./pages/TransferenciaEmbrioes'));
const DiagnosticoGestacao = lazy(() => import('./pages/DiagnosticoGestacao'));
const Sexagem = lazy(() => import('./pages/Sexagem'));
const NotFound = lazy(() => import('./pages/NotFound'));

const withSuspense = (element: ReactElement) => (
  <Suspense fallback={<LoadingSpinner />}>{element}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <HashRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={withSuspense(<Dashboard />)} />

            {/* Clientes */}
            <Route path="/clientes" element={withSuspense(<Clientes />)} />
            <Route path="/clientes/novo" element={withSuspense(<ClienteForm />)} />
            <Route path="/clientes/:id" element={withSuspense(<ClienteDetail />)} />
            <Route path="/clientes/:id/editar" element={withSuspense(<ClienteForm />)} />

            {/* Fazendas */}
            <Route path="/fazendas" element={withSuspense(<Fazendas />)} />
            <Route path="/fazendas/:id" element={withSuspense(<FazendaDetail />)} />

            {/* Doadoras */}
            <Route path="/doadoras" element={withSuspense(<Doadoras />)} />

            {/* Receptoras */}
            <Route path="/receptoras" element={withSuspense(<Receptoras />)} />
            <Route path="/receptoras/:id/historico" element={withSuspense(<ReceptoraHistorico />)} />

            {/* Protocolos */}
            <Route path="/protocolos" element={withSuspense(<Protocolos />)} />
            <Route path="/protocolos/novo" element={withSuspense(<ProtocoloForm />)} />
            <Route path="/protocolos/:id" element={withSuspense(<ProtocoloDetail />)} />
            <Route path="/protocolos/:id/passo2" element={withSuspense(<ProtocoloPasso2 />)} />

            {/* Aspirações */}
            <Route path="/aspiracoes" element={withSuspense(<Aspiracoes />)} />

            {/* Doses de Sêmen */}
            <Route path="/doses-semen" element={withSuspense(<DosesSemen />)} />

            {/* Lotes FIV */}
            <Route path="/lotes-fiv" element={withSuspense(<LotesFIV />)} />

            {/* Embriões */}
            <Route path="/embrioes" element={withSuspense(<Embrioes />)} />

            {/* Transferência de Embriões */}
            <Route path="/transferencia" element={withSuspense(<TransferenciaEmbrioes />)} />

            {/* Diagnóstico de Gestação */}
            <Route path="/dg" element={withSuspense(<DiagnosticoGestacao />)} />

            {/* Sexagem */}
            <Route path="/sexagem" element={withSuspense(<Sexagem />)} />
          </Route>
          <Route path="*" element={withSuspense(<NotFound />)} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
