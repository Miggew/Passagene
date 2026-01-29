import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ScrollToTop from './components/shared/ScrollToTop';
import AppErrorFallback from './components/shared/AppErrorFallback';
import { ErrorBoundary } from 'react-error-boundary';
import LoadingSpinner from './components/shared/LoadingSpinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Paginas de autenticacao
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

// Paginas do app
const Home = lazy(() => import('./pages/Home'));
const Clientes = lazy(() => import('./pages/Clientes'));
const ClienteForm = lazy(() => import('./pages/ClienteForm'));
const ClienteDetail = lazy(() => import('./pages/ClienteDetail'));
const Fazendas = lazy(() => import('./pages/Fazendas'));
const FazendaDetail = lazy(() => import('./pages/FazendaDetail'));
const Doadoras = lazy(() => import('./pages/Doadoras'));
const DoadoraDetail = lazy(() => import('./pages/DoadoraDetail'));
// Receptoras agora fica dentro de FazendaDetail
const ReceptoraHistorico = lazy(() => import('./pages/ReceptoraHistorico'));
const Protocolos = lazy(() => import('./pages/Protocolos'));
const ProtocoloDetail = lazy(() => import('./pages/ProtocoloDetail'));
const ProtocoloRelatorioFechado = lazy(() => import('./pages/ProtocoloRelatorioFechado'));
const Aspiracoes = lazy(() => import('./pages/Aspiracoes'));
const PacoteAspiracaoDetail = lazy(() => import('./pages/PacoteAspiracaoDetail'));
const DosesSemen = lazy(() => import('./pages/DosesSemen'));
const Touros = lazy(() => import('./pages/Touros'));
const TouroDetail = lazy(() => import('./pages/TouroDetail'));
const LotesFIV = lazy(() => import('./pages/LotesFIV'));
const Embrioes = lazy(() => import('./pages/Embrioes'));
const EmbrioesCongelados = lazy(() => import('./pages/EmbrioesCongelados'));
const TransferenciaEmbrioes = lazy(() => import('./pages/TransferenciaEmbrioes'));
const DiagnosticoGestacao = lazy(() => import('./pages/DiagnosticoGestacao'));
const Sexagem = lazy(() => import('./pages/Sexagem'));
const SemAcesso = lazy(() => import('./pages/SemAcesso'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Portal = lazy(() => import('./pages/Portal'));
const NotFound = lazy(() => import('./pages/NotFound'));
const StyleGuide = lazy(() => import('./components/StyleGuide'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente que protege rotas: se nao logado, redireciona para /login
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Enquanto verifica sessao, mostra loading
  if (loading) {
    return <LoadingSpinner />;
  }

  // Se nao esta logado, redireciona para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se logado, mostra o conteudo
  return <>{children}</>;
}

// Componente que impede acesso a paginas de auth se ja estiver logado
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Se ja esta logado, redireciona para o dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => {
  const location = useLocation();
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback} resetKeys={[location.pathname]}>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Rotas publicas (login, cadastro, recuperar senha) */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

          {/* Style Guide (público para testes) */}
          <Route path="/style-guide" element={<StyleGuide />} />

          {/* Página de sem acesso (protegida, mas sem layout) */}
          <Route path="/sem-acesso" element={<ProtectedRoute><SemAcesso /></ProtectedRoute>} />

          {/* Página inicial - seleção de hubs (protegida, sem MainLayout) */}
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

          {/* Rotas protegidas (app principal com MainLayout) */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>

            {/* Clientes */}
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<ClienteForm />} />
            <Route path="/clientes/:id" element={<ClienteDetail />} />
            <Route path="/clientes/:id/editar" element={<ClienteForm />} />

            {/* Usuarios (admin only) */}
            <Route path="/usuarios" element={<Usuarios />} />

            {/* Fazendas */}
            <Route path="/fazendas" element={<Fazendas />} />
            <Route path="/fazendas/:id" element={<FazendaDetail />} />

            {/* Doadoras */}
            <Route path="/doadoras" element={<Doadoras />} />
            <Route path="/doadoras/:id" element={<DoadoraDetail />} />

            {/* Receptoras - agora fica dentro de FazendaDetail, só histórico tem rota própria */}
            <Route path="/receptoras/:id/historico" element={<ReceptoraHistorico />} />

            {/* Protocolos */}
            <Route path="/protocolos" element={<Protocolos />} />
            <Route path="/protocolos/:id" element={<ProtocoloDetail />} />
            <Route path="/protocolos/:id/relatorio" element={<ProtocoloRelatorioFechado />} />
            <Route path="/protocolos/fechados/:id/relatorio" element={<ProtocoloRelatorioFechado />} />

            {/* Aspiracoes */}
            <Route path="/aspiracoes" element={<Aspiracoes />} />
            <Route path="/aspiracoes/:id" element={<PacoteAspiracaoDetail />} />

            {/* Touros */}
            <Route path="/touros" element={<Touros />} />
            <Route path="/touros/:id" element={<TouroDetail />} />

            {/* Doses de Semen */}
            <Route path="/doses-semen" element={<DosesSemen />} />

            {/* Lotes FIV */}
            <Route path="/lotes-fiv" element={<LotesFIV />} />
            <Route path="/lotes-fiv/:id" element={<LotesFIV />} />

            {/* Embrioes */}
            <Route path="/embrioes" element={<Embrioes />} />
            <Route path="/embrioes-congelados" element={<EmbrioesCongelados />} />

            {/* Transferencia de Embrioes */}
            <Route path="/transferencia" element={<TransferenciaEmbrioes />} />

            {/* Diagnostico de Gestacao */}
            <Route path="/dg" element={<DiagnosticoGestacao />} />

            {/* Sexagem */}
            <Route path="/sexagem" element={<Sexagem />} />

            {/* Portal do Cliente */}
            <Route path="/portal" element={<Portal />} />
          </Route>

          {/* Rota 404 */}
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
        {/* AuthProvider envolve tudo para gerenciar estado de login */}
        <AuthProvider>
          <ScrollToTop />
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
