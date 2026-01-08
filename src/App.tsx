import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteForm from './pages/ClienteForm';
import ClienteDetail from './pages/ClienteDetail';
import Fazendas from './pages/Fazendas';
import FazendaDetail from './pages/FazendaDetail';
import Doadoras from './pages/Doadoras';
import Receptoras from './pages/Receptoras';
import ReceptoraHistorico from './pages/ReceptoraHistorico';
import Protocolos from './pages/Protocolos';
import ProtocoloForm from './pages/ProtocoloForm';
import ProtocoloDetail from './pages/ProtocoloDetail';
import ProtocoloPasso2 from './pages/ProtocoloPasso2';
import Aspiracoes from './pages/Aspiracoes';
import DosesSemen from './pages/DosesSemen';
import LotesFIV from './pages/LotesFIV';
import Embrioes from './pages/Embrioes';
import TransferenciaEmbrioes from './pages/TransferenciaEmbrioes';
import DiagnosticoGestacao from './pages/DiagnosticoGestacao';
import Sexagem from './pages/Sexagem';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <HashRouter>
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

            {/* Receptoras */}
            <Route path="/receptoras" element={<Receptoras />} />
            <Route path="/receptoras/:id/historico" element={<ReceptoraHistorico />} />

            {/* Protocolos */}
            <Route path="/protocolos" element={<Protocolos />} />
            <Route path="/protocolos/novo" element={<ProtocoloForm />} />
            <Route path="/protocolos/:id" element={<ProtocoloDetail />} />
            <Route path="/protocolos/:id/passo2" element={<ProtocoloPasso2 />} />

            {/* Aspirações */}
            <Route path="/aspiracoes" element={<Aspiracoes />} />

            {/* Doses de Sêmen */}
            <Route path="/doses-semen" element={<DosesSemen />} />

            {/* Lotes FIV */}
            <Route path="/lotes-fiv" element={<LotesFIV />} />

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
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
