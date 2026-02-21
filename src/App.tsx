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
const FazendaDetail = lazy(() => import('./pages/FazendaDetail'));
const Doadoras = lazy(() => import('./pages/Doadoras'));
const DoadoraDetail = lazy(() => import('./pages/DoadoraDetail'));
// Receptoras agora fica dentro de FazendaDetail
const ReceptoraHistorico = lazy(() => import('./pages/ReceptoraHistorico'));
const ProtocoloDetail = lazy(() => import('./pages/ProtocoloDetail'));
const ProtocoloRelatorioFechado = lazy(() => import('./pages/ProtocoloRelatorioFechado'));
const PacoteAspiracaoDetail = lazy(() => import('./pages/PacoteAspiracaoDetail'));
const DosesSemen = lazy(() => import('./pages/DosesSemen'));
const Touros = lazy(() => import('./pages/Touros'));
const TouroDetail = lazy(() => import('./pages/TouroDetail'));
const LotesFIV = lazy(() => import('./pages/LotesFIV'));
const Embrioes = lazy(() => import('./pages/Embrioes'));
const EmbrioesCongelados = lazy(() => import('./pages/EmbrioesCongelados'));
const TESessaoDetail = lazy(() => import('./pages/TESessaoDetail'));
const DiagnosticoSessaoDetail = lazy(() => import('./pages/DiagnosticoSessaoDetail'));
const SexagemSessaoDetail = lazy(() => import('./pages/SexagemSessaoDetail'));
const SemAcesso = lazy(() => import('./pages/SemAcesso'));
const Administrativo = lazy(() => import('./pages/Administrativo'));
const EmbryoScore = lazy(() => import('./pages/EmbryoScore'));
const EmbryoScoreReview = lazy(() => import('./pages/EmbryoScoreReview'));
const NotFound = lazy(() => import('./pages/NotFound'));
const StyleGuide = lazy(() => import('./components/StyleGuide'));
const DisruptiveExamples = lazy(() => import('./components/DisruptiveExamples'));

// Páginas do Hub Relatórios
const RelatoriosHome = lazy(() => import('./pages/relatorios/RelatoriosHome'));
const RelatoriosServicos = lazy(() => import('./pages/relatorios/RelatoriosServicos'));
const RelatoriosAnimais = lazy(() => import('./pages/relatorios/RelatoriosAnimais'));
const RelatoriosMaterial = lazy(() => import('./pages/relatorios/RelatoriosMaterial'));
const RelatoriosProducao = lazy(() => import('./pages/relatorios/RelatoriosProducao'));
const ConsultorIA = lazy(() => import('./pages/ConsultorIA'));

// Páginas do Hub Genética (Catálogo de Vendas)
const GeneticaHome = lazy(() => import('./pages/genetica/GeneticaHome'));
const GeneticaDoadoras = lazy(() => import('./pages/genetica/GeneticaDoadoras'));
const GeneticaDoadoraDetail = lazy(() => import('./pages/genetica/GeneticaDoadoraDetail'));
const GeneticaTouros = lazy(() => import('./pages/genetica/GeneticaTouros'));
const GeneticaTouroDetail = lazy(() => import('./pages/genetica/GeneticaTouroDetail'));

// Páginas do Hub Cliente
const ClienteRebanho = lazy(() => import('./pages/cliente/ClienteRebanho'));

// Antigo Relatorios 
const ClienteRelatorios = lazy(() => import('./pages/cliente/ClienteRelatorios'));
const ClienteBotijao = lazy(() => import('./pages/cliente/ClienteBotijao'));
const ClienteConfiguracoes = lazy(() => import('./pages/cliente/ClienteConfiguracoes'));

const Bancada = lazy(() => import('./pages/Bancada'));
const QuickClassifyPage = lazy(() => import('./pages/QuickClassifyPage'));

// Páginas do Hub Escritório
const EscritorioHome = lazy(() => import('./pages/escritorio/EscritorioHome'));
const EscritorioDG = lazy(() => import('./pages/escritorio/EscritorioDG'));
const EscritorioSexagem = lazy(() => import('./pages/escritorio/EscritorioSexagem'));
const EscritorioProtocolos = lazy(() => import('./pages/escritorio/EscritorioProtocolos'));
const EscritorioTE = lazy(() => import('./pages/escritorio/EscritorioTE'));
const EscritorioAspiracao = lazy(() => import('./pages/escritorio/EscritorioAspiracao'));
const EscritorioHistorico = lazy(() => import('./pages/escritorio/EscritorioHistorico'));

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

// Componente que verifica se o usuário tem acesso ao hub da rota atual
function RoleGuard({ children }: { children: React.ReactNode }) {
  const { permissions } = useAuth();
  const location = useLocation();

  // Enquanto permissions não carregou, deixa renderizar (ProtectedRoute já cuida do loading)
  if (!permissions) return <>{children}</>;

  // Admin tem acesso a tudo
  if (permissions.isAdmin) return <>{children}</>;

  // Rotas compartilhadas que todos os usuários autenticados podem acessar
  const sharedRoutes = ['/', '/sem-acesso', '/ai-chat'];
  if (sharedRoutes.some(r => location.pathname === r)) return <>{children}</>;

  // Cliente só acessa /cliente/* e /genetica/*
  if (permissions.isCliente) {
    if (location.pathname.startsWith('/cliente/') || location.pathname.startsWith('/genetica')) {
      return <>{children}</>;
    }
    return <Navigate to="/sem-acesso" replace />;
  }

  // Operacional: acessa tudo exceto /administrativo e /cliente/*
  if (permissions.profile?.user_type === 'operacional') {
    if (location.pathname.startsWith('/cliente/')) {
      return <Navigate to="/sem-acesso" replace />;
    }
    return <>{children}</>;
  }

  return <>{children}</>;
}

const LaboratorioHome = lazy(() => import('@/pages/laboratorio/LaboratorioHome'));

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
          <Route path="/disruptive" element={<DisruptiveExamples />} />

          {/* Página de sem acesso (protegida, mas sem layout) */}
          <Route path="/sem-acesso" element={<ProtectedRoute><SemAcesso /></ProtectedRoute>} />

          {/* Rotas protegidas (app principal com MainLayout + role guard) */}
          <Route element={<ProtectedRoute><RoleGuard><MainLayout /></RoleGuard></ProtectedRoute>}>

            {/* Página inicial - Dashboard unificado por tipo de usuário */}
            <Route path="/" element={<Home />} />

            {/* Painel Administrativo Unificado */}
            <Route path="/administrativo" element={<Administrativo />} />
            <Route path="/embryoscore" element={<EmbryoScore />} />
            <Route path="/embryoscore/review/:queueId" element={<EmbryoScoreReview />} />

            {/* Redirecionamentos das rotas antigas */}
            <Route path="/clientes" element={<Navigate to="/administrativo?tab=clientes" replace />} />
            <Route path="/clientes/*" element={<Navigate to="/administrativo?tab=clientes" replace />} />
            <Route path="/usuarios" element={<Navigate to="/administrativo?tab=usuarios" replace />} />

            {/* Fazendas - listagem redireciona, mas detalhe mantem (tem tabs complexas) */}
            <Route path="/fazendas" element={<Navigate to="/administrativo?tab=fazendas" replace />} />
            <Route path="/fazendas/:id" element={<FazendaDetail />} />

            {/* Doadoras */}
            <Route path="/doadoras" element={<Doadoras />} />
            <Route path="/doadoras/:id" element={<DoadoraDetail />} />

            {/* Receptoras - agora fica dentro de FazendaDetail, só histórico tem rota própria */}
            <Route path="/receptoras/:id/historico" element={<ReceptoraHistorico />} />

            {/* =======================================================
                FUSÃO DE HUBS: CAMPO + ESCRITÓRIO => "OPERACIONAL"
                Utilizando as URLs base limpas, com os componentes 
                robustos (DataTables) do antigo Escritório 
            ======================================================= */}

            {/* Protocolos (Unifica Passo 1 e 2 no padrão Escritorio) */}
            <Route path="/protocolos" element={<EscritorioProtocolos />} />
            {/* Mantemos detail legados como fallbacks para relatórios antigos */}
            <Route path="/protocolos/:id" element={<ProtocoloDetail />} />
            <Route path="/protocolos/:id/relatorio" element={<ProtocoloRelatorioFechado />} />
            <Route path="/protocolos/fechados/:id/relatorio" element={<ProtocoloRelatorioFechado />} />

            {/* Aspirações */}
            <Route path="/aspiracoes" element={<EscritorioAspiracao />} />
            <Route path="/aspiracoes/:id" element={<PacoteAspiracaoDetail />} />

            {/* Transferencia de Embrioes */}
            <Route path="/transferencia" element={<EscritorioTE />} />
            <Route path="/transferencia/sessao" element={<TESessaoDetail />} />

            {/* Diagnostico de Gestacao */}
            <Route path="/dg" element={<EscritorioDG />} />
            <Route path="/dg/sessao" element={<DiagnosticoSessaoDetail />} />

            {/* Sexagem */}
            <Route path="/sexagem" element={<EscritorioSexagem />} />
            <Route path="/sexagem/sessao" element={<SexagemSessaoDetail />} />

            {/* Histórico Geral */}
            <Route path="/historico" element={<EscritorioHistorico />} />

            {/* Hub Relatórios */}
            <Route path="/laboratorio" element={<LaboratorioHome />} />
            <Route path="/lotes-fiv" element={<LotesFIV />} />
            <Route path="/relatorios" element={<RelatoriosHome />} />
            <Route path="/relatorios/servicos" element={<RelatoriosServicos />} />
            <Route path="/relatorios/animais" element={<RelatoriosAnimais />} />
            <Route path="/relatorios/material" element={<RelatoriosMaterial />} />
            <Route path="/relatorios/producao" element={<RelatoriosProducao />} />

            {/* Hub Genética (Catálogo de Vendas) */}
            <Route path="/genetica" element={<GeneticaHome />} />
            <Route path="/genetica/doadoras" element={<GeneticaDoadoras />} />
            <Route path="/genetica/doadoras/:id" element={<GeneticaDoadoraDetail />} />
            <Route path="/genetica/touros" element={<GeneticaTouros />} />
            <Route path="/genetica/touros/:id" element={<GeneticaTouroDetail />} />

            {/* Bancada do Biólogo */}
            <Route path="/bancada" element={<Bancada />} />
            <Route path="/bancada/rapida/:queueId" element={<QuickClassifyPage />} />
            <Route path="/biologist" element={<Navigate to="/bancada" replace />} />

            {/* Hub Cliente */}
            <Route path="/cliente/rebanho" element={<ClienteRebanho />} />
            <Route path="/cliente/relatorios" element={<ClienteRelatorios />} />

            {/* Consultor IA Global (Acessível a Clientes e Staff) */}
            <Route path="/ai-chat" element={<ConsultorIA />} />
            {/* Fallback do atalho antigo do cliente */}
            <Route path="/cliente/ai-chat" element={<Navigate to="/ai-chat" replace />} />

            <Route path="/cliente/botijao" element={<ClienteBotijao />} />
            <Route path="/cliente/configuracoes" element={<ClienteConfiguracoes />} />

            {/* 
                Redirecionamentos Legacy de /escritorio/* para as URLs limpas acima 
                Isso garante que links salvos ou hardcoded não quebrem
            */}
            <Route path="/escritorio" element={<Navigate to="/" replace />} />
            <Route path="/escritorio/dg" element={<Navigate to="/dg" replace />} />
            <Route path="/escritorio/sexagem" element={<Navigate to="/sexagem" replace />} />
            <Route path="/escritorio/protocolos" element={<Navigate to="/protocolos" replace />} />
            <Route path="/escritorio/protocolo-p1" element={<Navigate to="/protocolos?step=1" replace />} />
            <Route path="/escritorio/protocolo-p2" element={<Navigate to="/protocolos?step=2" replace />} />
            <Route path="/escritorio/te" element={<Navigate to="/transferencia" replace />} />
            <Route path="/escritorio/aspiracao" element={<Navigate to="/aspiracoes" replace />} />
            <Route path="/escritorio/historico" element={<Navigate to="/historico" replace />} />
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
