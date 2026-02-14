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

// Importação das rotas segregadas por Hub (Lazy)
const LabRoutes = lazy(() => import('./routes/LabRoutes'));
const CampoRoutes = lazy(() => import('./routes/CampoRoutes'));
const ClienteRoutes = lazy(() => import('./routes/ClienteRoutes'));

// Páginas de autenticação
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

// Páginas principais
const Home = lazy(() => import('./pages/Home'));
const Administrativo = lazy(() => import('./pages/Administrativo'));
const FazendaDetail = lazy(() => import('./pages/FazendaDetail'));
const Doadoras = lazy(() => import('./pages/Doadoras'));
const DoadoraDetail = lazy(() => import('./pages/DoadoraDetail'));
const Touros = lazy(() => import('./pages/Touros'));
const TouroDetail = lazy(() => import('./pages/TouroDetail'));
const SemAcesso = lazy(() => import('./pages/SemAcesso'));
const NotFound = lazy(() => import('./pages/NotFound'));
const StyleGuide = lazy(() => import('./components/StyleGuide'));

// Hub Relatórios (Lazy)
const RelatoriosHome = lazy(() => import('./pages/relatorios/RelatoriosHome'));
const RelatoriosServicos = lazy(() => import('./pages/relatorios/RelatoriosServicos'));
const RelatoriosAnimais = lazy(() => import('./pages/relatorios/RelatoriosAnimais'));
const RelatoriosMaterial = lazy(() => import('./pages/relatorios/RelatoriosMaterial'));
const RelatoriosProducao = lazy(() => import('./pages/relatorios/RelatoriosProducao'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => {
  const location = useLocation();
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback} resetKeys={[location.pathname]}>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/style-guide" element={<StyleGuide />} />
          <Route path="/sem-acesso" element={<ProtectedRoute><SemAcesso /></ProtectedRoute>} />

          {/* Rotas Protegidas (App Principal) */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            
            {/* Hubs: Modularizados para performance mobile */}
            <Route path="/lab/*" element={<LabRoutes />} />
            <Route path="/campo/*" element={<CampoRoutes />} />
            <Route path="/cliente/*" element={<ClienteRoutes />} />

            {/* Rotas Globais/Admin */}
            <Route path="/administrativo" element={<Administrativo />} />
            <Route path="/fazendas/:id" element={<FazendaDetail />} />
            <Route path="/doadoras" element={<Doadoras />} />
            <Route path="/doadoras/:id" element={<DoadoraDetail />} />
            <Route path="/touros" element={<Touros />} />
            <Route path="/touros/:id" element={<TouroDetail />} />
            
            {/* Hub Relatórios */}
            <Route path="/relatorios" element={<RelatoriosHome />} />
            <Route path="/relatorios/servicos" element={<RelatoriosServicos />} />
            <Route path="/relatorios/animais" element={<RelatoriosAnimais />} />
            <Route path="/relatorios/material" element={<RelatoriosMaterial />} />
            <Route path="/relatorios/producao" element={<RelatoriosProducao />} />
            
            {/* Redirecionamentos de Compatibilidade */}
            <Route path="/aspiracoes" element={<Navigate to="/lab/aspiracoes" replace />} />
            <Route path="/aspiracoes/:id" element={<Navigate to="/lab/aspiracoes/:id" replace />} />
            <Route path="/lotes-fiv" element={<Navigate to="/lab/lotes-fiv" replace />} />
            <Route path="/embrioes" element={<Navigate to="/lab/embrioes" replace />} />
            <Route path="/embrioes-congelados" element={<Navigate to="/lab/embrioes-congelados" replace />} />
            <Route path="/embryoscore" element={<Navigate to="/lab/embryoscore" replace />} />
            
            <Route path="/protocolos" element={<Navigate to="/campo/protocolos" replace />} />
            <Route path="/protocolos/:id" element={<Navigate to="/campo/protocolos/:id" replace />} />
            <Route path="/transferencia" element={<Navigate to="/campo/transferencia" replace />} />
            <Route path="/transferencia/sessao" element={<Navigate to="/campo/transferencia/sessao" replace />} />
            <Route path="/dg" element={<Navigate to="/campo/dg" replace />} />
            <Route path="/dg/:id" element={<Navigate to="/campo/dg/:id" replace />} />
            <Route path="/lotes-fiv/:id" element={<Navigate to="/lab/lotes-fiv/:id" replace />} />
            
            <Route path="/clientes" element={<Navigate to="/administrativo?tab=clientes" replace />} />
            <Route path="/fazendas" element={<Navigate to="/administrativo?tab=fazendas" replace />} />
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
        <AuthProvider>
          <ScrollToTop />
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
