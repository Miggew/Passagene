/**
 * Página de Protocolos de Sincronização
 *
 * Estrutura:
 * - Aba "Nova Sessão" com sub-abas:
 *   - "1º Passo" - Criar novo protocolo
 *   - "2º Passo" - Continuar protocolo pendente
 * - Aba "Histórico" - Listagem de todos os protocolos
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import {
  Plus,
  PlayCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  UserPlus,
  Lock,
  X,
  Filter,
  RefreshCw,
  CalendarDays,
  CheckCircle,
  Users,
  Save,
  TrendingUp,
} from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import ClassificacoesCicloInline from '@/components/shared/ClassificacoesCicloInline';

// Components
import {
  ProtocoloInfoCard,
  ProtocoloStatsCards,
  ProtocoloResumoDialog,
  ConfirmExitDialog,
  ReceptorasPasso2Table,
} from '@/components/protocolos';

// Hooks
import {
  useProtocolosData,
  useProtocoloWizardData,
  useProtocoloWizardReceptoras,
  useProtocoloWizardSubmit,
  type ProtocoloWithFazenda,
} from '@/hooks/protocolos';
import {
  useProtocoloPasso2Data,
  useProtocoloPasso2Actions,
} from '@/hooks/protocoloPasso2';

// ==================== RASCUNHO LOCAL ====================
const RASCUNHO_PASSO1_KEY = 'passagene_protocolo_passo1_rascunho';
const RASCUNHO_PASSO2_KEY = 'passagene_protocolo_passo2_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

interface RascunhoPasso1 {
  protocoloData: {
    fazenda_id: string;
    data_inicio: string;
    veterinario: string;
    tecnico: string;
    observacoes: string;
  };
  receptorasLocais: Array<{
    id?: string;
    identificacao: string;
    nome?: string;
    observacoes?: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
  }>;
  currentStep: 'form' | 'receptoras';
  timestamp: number;
}

interface RascunhoPasso2 {
  protocoloSelecionadoId: string;
  passo2Form: {
    data: string;
    tecnico: string;
  };
  motivosInapta: Record<string, string>;
  statusAlterados: Record<string, 'APTA' | 'INAPTA' | 'INICIADA'>;
  timestamp: number;
}

export default function Protocolos() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'nova-sessao' | 'historico'>('nova-sessao');
  const [activeSubTab, setActiveSubTab] = useState<'passo1' | 'passo2'>('passo1');

  // ========== ESTADOS RASCUNHO ==========
  const [showRestaurarPasso1Dialog, setShowRestaurarPasso1Dialog] = useState(false);
  const [showRestaurarPasso2Dialog, setShowRestaurarPasso2Dialog] = useState(false);
  const [rascunhoPasso2Pendente, setRascunhoPasso2Pendente] = useState<RascunhoPasso2 | null>(null);
  const rascunhoPasso2VerificadoRef = useRef<string | null>(null);

  // ========== HISTÓRICO ==========
  const {
    loading: loadingHistorico,
    loadingProtocolos,
    protocolos,
    fazendas: fazendasHistorico,
    filtroStatus,
    setFiltroStatus,
    fazendaFilter,
    setFazendaFilter,
    filtroDataInicio,
    setFiltroDataInicio,
    filtroDataFim,
    setFiltroDataFim,
    protocolosPage,
    setProtocolosPage,
    pageSize,
    loadData: loadDataHistorico,
    loadProtocolos,
    limparFiltros,
    aplicarAtalhoData,
  } = useProtocolosData();

  // Estado para busca por texto no histórico
  const [filtroBusca, setFiltroBusca] = useState('');

  // ========== PASSO 1 ==========
  const [passo1CurrentStep, setPasso1CurrentStep] = useState<'form' | 'receptoras'>('form');

  const {
    loading: loadingPasso1,
    loadingReceptoras: loadingReceptorasPasso1,
    fazendas: fazendasPasso1,
    allReceptoras,
    receptorasComStatus,
    protocoloData,
    setProtocoloData,
    loadFazendas: loadFazendasPasso1,
    loadAllReceptoras,
    getSelectedIds,
    getReceptorasFiltradas,
    getFazendaNome,
  } = useProtocoloWizardData();

  const {
    receptorasLocais,
    setReceptorasLocais,
    showAddReceptora,
    setShowAddReceptora,
    showCreateReceptora,
    setShowCreateReceptora,
    buscaReceptora,
    setBuscaReceptora,
    popoverAberto,
    setPopoverAberto,
    addReceptoraForm,
    setAddReceptoraForm,
    createReceptoraForm,
    setCreateReceptoraForm,
    submitting: receptorasSubmitting,
    handleAddReceptora,
    handleCreateReceptora,
    handleRemoveReceptora,
    handleUpdateCiclando,
    handleUpdateQualidade,
    resetAddForm,
    resetCreateForm,
  } = useProtocoloWizardReceptoras({
    fazendaId: protocoloData.fazenda_id,
    allReceptoras,
    receptorasComStatus,
    selectedIds: getSelectedIds([]),
    onReceptorasReload: () => loadAllReceptoras(protocoloData.fazenda_id),
  });

  const {
    submitting: submitSubmittingPasso1,
    showConfirmExit: showConfirmExitPasso1,
    setShowConfirmExit: setShowConfirmExitPasso1,
    showResumo: showResumoPasso1,
    setShowResumo: setShowResumoPasso1,
    handleFinalizarPasso1,
    handleConfirmExit: handleConfirmExitPasso1,
    validateProtocoloForm,
  } = useProtocoloWizardSubmit({
    protocoloData,
    receptorasLocais,
  });

  const submittingPasso1 = receptorasSubmitting || submitSubmittingPasso1;

  // ========== PASSO 2 ==========
  const [protocoloSelecionadoId, setProtocoloSelecionadoId] = useState<string>('');
  const [passo2Form, setPasso2Form] = useState({
    data: new Date().toISOString().split('T')[0],
    tecnico: '',
  });
  const [motivosInapta, setMotivosInapta] = useState<Record<string, string>>({});
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);

  const {
    loading: loadingPasso2,
    protocolo: protocoloPasso2,
    setProtocolo: setProtocoloPasso2,
    fazendaNome: fazendaNomePasso2,
    receptoras: receptorasPasso2,
    setReceptoras: setReceptorasPasso2,
    loadData: loadDataPasso2,
  } = useProtocoloPasso2Data();

  const {
    submitting: submittingPasso2,
    showResumo: showResumoPasso2,
    setShowResumo: setShowResumoPasso2,
    handleStatusChange,
    handleMotivoChange,
    handleFinalizarPasso2,
    handleCloseResumo: handleCloseResumoPasso2,
  } = useProtocoloPasso2Actions({
    protocoloId: protocoloSelecionadoId,
    protocolo: protocoloPasso2,
    receptoras: receptorasPasso2,
    setReceptoras: setReceptorasPasso2,
    setProtocolo: setProtocoloPasso2,
    passo2Form,
    motivosInapta,
  });

  // ========== COMPUTED ==========
  const actualSelectedIds = useMemo(
    () => getSelectedIds(receptorasLocais),
    [getSelectedIds, receptorasLocais]
  );

  const receptorasFiltradas = useMemo(
    () => getReceptorasFiltradas(buscaReceptora, actualSelectedIds),
    [getReceptorasFiltradas, buscaReceptora, actualSelectedIds]
  );

  // Protocolos aguardando 2º passo
  const protocolosAguardando2Passo = useMemo(() => {
    return protocolos.filter(p =>
      p.status === 'PASSO1_FECHADO' || p.status === 'PRIMEIRO_PASSO_FECHADO'
    );
  }, [protocolos]);

  // Protocolos filtrados por busca de texto
  const protocolosFiltrados = useMemo(() => {
    if (!filtroBusca.trim()) return protocolos;
    const termo = filtroBusca.toLowerCase().trim();
    return protocolos.filter(p => {
      const fazendaNome = p.fazenda_nome?.toLowerCase() || '';
      const veterinario = p.responsavel_inicio?.toLowerCase() || '';
      const tecnico = p.tecnico_responsavel?.toLowerCase() || '';
      return fazendaNome.includes(termo) || veterinario.includes(termo) || tecnico.includes(termo);
    });
  }, [protocolos, filtroBusca]);

  // Estatísticas do histórico
  const estatisticasHistorico = useMemo(() => {
    const total = protocolosFiltrados.length;
    const aguardando2Passo = protocolosFiltrados.filter(p =>
      p.status === 'PASSO1_FECHADO' || p.status === 'PRIMEIRO_PASSO_FECHADO'
    ).length;
    const protocolosSincronizados = protocolosFiltrados.filter(p =>
      p.status === 'SINCRONIZADO' || p.status === 'PASSO2_FECHADO'
    );
    const sincronizados = protocolosSincronizados.length;

    // Total de receptoras de todos os protocolos
    const totalReceptoras = protocolosFiltrados.reduce((sum, p) => sum + (p.receptoras_count || 0), 0);

    // Receptoras em protocolos que chegaram a SINCRONIZADO (passaram pelo 2º passo completo)
    const receptorasSincronizadas = protocolosSincronizados.reduce((sum, p) => sum + (p.receptoras_count || 0), 0);

    // % de aproveitamento: receptoras em protocolos sincronizados / total de receptoras
    const aproveitamento = totalReceptoras > 0
      ? Math.round((receptorasSincronizadas / totalReceptoras) * 100)
      : 0;

    return { total, aguardando2Passo, sincronizados, totalReceptoras, receptorasSincronizadas, aproveitamento };
  }, [protocolosFiltrados]);

  // Stats do Passo 2
  const statsPasso2 = useMemo(() => ({
    pendentes: receptorasPasso2.filter((r) => r.pr_status === 'INICIADA').length,
    confirmadas: receptorasPasso2.filter((r) => r.pr_status === 'APTA').length,
    descartadas: receptorasPasso2.filter((r) => r.pr_status === 'INAPTA').length,
  }), [receptorasPasso2]);

  const isProtocoloFinalizado = protocoloPasso2?.status === 'SINCRONIZADO';
  const canFinalizePasso2 = statsPasso2.pendentes === 0 && passo2Form.data && passo2Form.tecnico.trim();

  // ========== FUNÇÕES RASCUNHO ==========

  // Passo 1
  const getRascunhoPasso1 = useCallback((): RascunhoPasso1 | null => {
    try {
      const raw = localStorage.getItem(RASCUNHO_PASSO1_KEY);
      if (!raw) return null;
      const rascunho: RascunhoPasso1 = JSON.parse(raw);
      const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
      if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
        localStorage.removeItem(RASCUNHO_PASSO1_KEY);
        return null;
      }
      return rascunho;
    } catch {
      return null;
    }
  }, []);

  const salvarRascunhoPasso1 = useCallback(() => {
    const rascunho: RascunhoPasso1 = {
      protocoloData,
      receptorasLocais,
      currentStep: passo1CurrentStep,
      timestamp: Date.now(),
    };
    localStorage.setItem(RASCUNHO_PASSO1_KEY, JSON.stringify(rascunho));
  }, [protocoloData, receptorasLocais, passo1CurrentStep]);

  const limparRascunhoPasso1 = useCallback(() => {
    localStorage.removeItem(RASCUNHO_PASSO1_KEY);
  }, []);

  const restaurarRascunhoPasso1 = useCallback(() => {
    const rascunho = getRascunhoPasso1();
    if (rascunho) {
      setProtocoloData(rascunho.protocoloData);
      setReceptorasLocais(rascunho.receptorasLocais);
      setPasso1CurrentStep(rascunho.currentStep);
    }
    setShowRestaurarPasso1Dialog(false);
  }, [getRascunhoPasso1, setProtocoloData, setReceptorasLocais]);

  const descartarRascunhoPasso1 = useCallback(() => {
    limparRascunhoPasso1();
    setShowRestaurarPasso1Dialog(false);
  }, [limparRascunhoPasso1]);

  // Passo 2
  const getRascunhoPasso2 = useCallback((): RascunhoPasso2 | null => {
    try {
      const raw = localStorage.getItem(RASCUNHO_PASSO2_KEY);
      if (!raw) return null;
      const rascunho: RascunhoPasso2 = JSON.parse(raw);
      const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
      if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
        localStorage.removeItem(RASCUNHO_PASSO2_KEY);
        return null;
      }
      return rascunho;
    } catch {
      return null;
    }
  }, []);

  const salvarRascunhoPasso2 = useCallback(() => {
    if (!protocoloSelecionadoId) return;
    // Capturar status alterados das receptoras
    const statusAlterados: Record<string, 'APTA' | 'INAPTA' | 'INICIADA'> = {};
    receptorasPasso2.forEach((r) => {
      if (r.pr_status) {
        statusAlterados[r.id] = r.pr_status as 'APTA' | 'INAPTA' | 'INICIADA';
      }
    });
    const rascunho: RascunhoPasso2 = {
      protocoloSelecionadoId,
      passo2Form,
      motivosInapta,
      statusAlterados,
      timestamp: Date.now(),
    };
    localStorage.setItem(RASCUNHO_PASSO2_KEY, JSON.stringify(rascunho));
  }, [protocoloSelecionadoId, passo2Form, motivosInapta, receptorasPasso2]);

  const limparRascunhoPasso2 = useCallback(() => {
    localStorage.removeItem(RASCUNHO_PASSO2_KEY);
  }, []);

  const aplicarRascunhoPasso2 = useCallback((rascunho: RascunhoPasso2) => {
    setPasso2Form(rascunho.passo2Form);
    setMotivosInapta(rascunho.motivosInapta);
    // Aplicar status alterados nas receptoras
    if (Object.keys(rascunho.statusAlterados).length > 0) {
      setReceptorasPasso2((prev) =>
        prev.map((r) => ({
          ...r,
          pr_status: rascunho.statusAlterados[r.id] || r.pr_status,
        }))
      );
    }
    // Limpar rascunho após aplicar para evitar loop
    limparRascunhoPasso2();
    setRascunhoPasso2Pendente(null);
    setShowRestaurarPasso2Dialog(false);
  }, [setReceptorasPasso2, limparRascunhoPasso2]);

  const descartarRascunhoPasso2 = useCallback(() => {
    limparRascunhoPasso2();
    setRascunhoPasso2Pendente(null);
    setShowRestaurarPasso2Dialog(false);
  }, [limparRascunhoPasso2]);

  // ========== EFFECTS ==========
  useEffect(() => {
    loadDataHistorico();
    loadFazendasPasso1();
  }, [loadDataHistorico, loadFazendasPasso1]);

  useEffect(() => {
    if (passo1CurrentStep === 'receptoras' && protocoloData.fazenda_id) {
      loadAllReceptoras(protocoloData.fazenda_id);
    }
  }, [passo1CurrentStep, protocoloData.fazenda_id, loadAllReceptoras]);

  useEffect(() => {
    if (protocoloSelecionadoId) {
      loadDataPasso2(protocoloSelecionadoId);
    }
  }, [protocoloSelecionadoId, loadDataPasso2]);

  useEffect(() => {
    if (protocoloPasso2) {
      if (protocoloPasso2.passo2_data || protocoloPasso2.passo2_tecnico_responsavel) {
        setPasso2Form({
          data: protocoloPasso2.passo2_data || new Date().toISOString().split('T')[0],
          tecnico: protocoloPasso2.passo2_tecnico_responsavel || '',
        });
      }

      const motivosInaptaLocal: Record<string, string> = {};
      receptorasPasso2
        .filter((r) => r.pr_status === 'INAPTA' && r.pr_motivo_inapta)
        .forEach((r) => {
          motivosInaptaLocal[r.id] = r.pr_motivo_inapta || '';
        });
      setMotivosInapta(motivosInaptaLocal);

      // Verificar se há rascunho do passo 2 para este protocolo (apenas uma vez por protocolo)
      if (rascunhoPasso2VerificadoRef.current !== protocoloPasso2.id) {
        rascunhoPasso2VerificadoRef.current = protocoloPasso2.id;
        const rascunho = getRascunhoPasso2();
        if (rascunho && rascunho.protocoloSelecionadoId === protocoloPasso2.id) {
          setRascunhoPasso2Pendente(rascunho);
          setShowRestaurarPasso2Dialog(true);
        }
      }
    }
  }, [protocoloPasso2, receptorasPasso2, getRascunhoPasso2]);

  // Verificar rascunho do passo 1 ao montar
  useEffect(() => {
    const rascunho = getRascunhoPasso1();
    if (rascunho && (rascunho.receptorasLocais.length > 0 || rascunho.currentStep === 'receptoras')) {
      setShowRestaurarPasso1Dialog(true);
    }
  }, [getRascunhoPasso1]);

  // Auto-save rascunho passo 1 (debounced)
  useEffect(() => {
    if (passo1CurrentStep === 'receptoras' || receptorasLocais.length > 0) {
      const timer = setTimeout(() => {
        salvarRascunhoPasso1();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [protocoloData, receptorasLocais, passo1CurrentStep, salvarRascunhoPasso1]);

  // Auto-save rascunho passo 2 (debounced)
  useEffect(() => {
    if (protocoloSelecionadoId && receptorasPasso2.length > 0) {
      const timer = setTimeout(() => {
        salvarRascunhoPasso2();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [protocoloSelecionadoId, passo2Form, motivosInapta, receptorasPasso2, salvarRascunhoPasso2]);

  // ========== HANDLERS HISTÓRICO ==========
  const handleBuscar = () => {
    setProtocolosPage(1);
    loadProtocolos(1, {
      fazendaFilter,
      filtroDataInicio,
      filtroDataFim,
      filtroStatus,
    });
  };

  const handleLimparFiltros = () => {
    limparFiltros();
    setFiltroBusca('');
    loadProtocolos(1, {
      fazendaFilter: '',
      filtroDataInicio: '',
      filtroDataFim: '',
      filtroStatus: 'all',
    });
  };

  const handlePaginaAnterior = async () => {
    const newPage = Math.max(1, protocolosPage - 1);
    setProtocolosPage(newPage);
    await loadProtocolos(newPage);
  };

  const handleProximaPagina = async () => {
    const newPage = protocolosPage + 1;
    setProtocolosPage(newPage);
    await loadProtocolos(newPage);
  };

  // ========== HANDLERS PASSO 1 ==========
  const handleContinueToReceptoras = () => {
    if (validateProtocoloForm()) {
      setPasso1CurrentStep('receptoras');
    }
  };

  const handleVoltarPasso1 = () => {
    if (passo1CurrentStep === 'receptoras') {
      setPasso1CurrentStep('form');
    }
  };

  const handleResetPasso1 = () => {
    setPasso1CurrentStep('form');
    setProtocoloData({
      fazenda_id: '',
      data_inicio: new Date().toISOString().split('T')[0],
      veterinario: '',
      tecnico: '',
      observacoes: '',
    });
    setReceptorasLocais([]);
    limparRascunhoPasso1();
  };

  const handleCloseResumoPasso1 = () => {
    setShowResumoPasso1(false);
    handleResetPasso1();
    limparRascunhoPasso1();
    // Recarregar protocolos para atualizar a lista de aguardando 2º passo
    loadProtocolos(1);
  };

  // ========== HANDLERS PASSO 2 ==========
  const handleLocalStatusChange = (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => {
    handleStatusChange(receptoraId, status);
    if (status === 'APTA' || status === 'INICIADA') {
      setMotivosInapta((prev) => {
        const updated = { ...prev };
        delete updated[receptoraId];
        return updated;
      });
    }
  };

  const handleLocalMotivoChange = (receptoraId: string, motivo: string) => {
    handleMotivoChange(receptoraId, motivo);
    setMotivosInapta((prev) => ({
      ...prev,
      [receptoraId]: motivo.trim(),
    }));
  };

  const handleResetPasso2 = () => {
    setProtocoloSelecionadoId('');
    setProtocoloPasso2(null);
    setReceptorasPasso2([]);
    setPasso2Form({
      data: new Date().toISOString().split('T')[0],
      tecnico: '',
    });
    setMotivosInapta({});
    limparRascunhoPasso2();
  };

  const handleCloseResumoPasso2Final = () => {
    handleCloseResumoPasso2();
    handleResetPasso2();
    limparRascunhoPasso2();
    loadProtocolos(1);
  };

  // ========== HELPERS ==========
  const formatarData = (data: string) => {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // ========== RENDER ==========
  if (loadingHistorico) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protocolos de Sincronização"
        description="Gerenciar protocolos em 2 passos"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nova-sessao' | 'historico')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="nova-sessao" className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Nova Sessão
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2" onClick={() => loadProtocolos(1)}>
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* ==================== ABA NOVA SESSÃO ==================== */}
        <TabsContent value="nova-sessao" className="mt-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'passo1' | 'passo2')} className="w-full">
            <TabsList className="grid w-full max-w-sm grid-cols-2 mb-4">
              <TabsTrigger value="passo1" className="gap-2">
                1º Passo
              </TabsTrigger>
              <TabsTrigger value="passo2" className="gap-2">
                2º Passo
                {protocolosAguardando2Passo.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {protocolosAguardando2Passo.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ========== SUB-ABA 1º PASSO ========== */}
            <TabsContent value="passo1">
              {passo1CurrentStep === 'form' ? (
                <>
                  {/* Barra compacta de controles */}
                  <Card className="mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-wrap items-end gap-3">
                        {/* Veterinário */}
                        <div className="flex-1 min-w-[160px] max-w-[200px]">
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Veterinário *
                          </label>
                          <Input
                            placeholder="Nome do veterinário"
                            value={protocoloData.veterinario}
                            onChange={(e) => setProtocoloData({ ...protocoloData, veterinario: e.target.value })}
                            className="h-9"
                          />
                        </div>

                        {/* Técnico */}
                        <div className="flex-1 min-w-[160px] max-w-[200px]">
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Técnico *
                          </label>
                          <Input
                            placeholder="Nome do técnico"
                            value={protocoloData.tecnico}
                            onChange={(e) => setProtocoloData({ ...protocoloData, tecnico: e.target.value })}
                            className="h-9"
                          />
                        </div>

                        {/* Fazenda */}
                        <div className="flex-1 min-w-[160px] max-w-[200px]">
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Fazenda *
                          </label>
                          <Select
                            value={protocoloData.fazenda_id}
                            onValueChange={(value) => setProtocoloData({ ...protocoloData, fazenda_id: value })}
                            disabled={!protocoloData.veterinario || !protocoloData.tecnico}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {fazendasPasso1.map((fazenda) => (
                                <SelectItem key={fazenda.id} value={fazenda.id}>
                                  {fazenda.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Data Início */}
                        <div className="flex-1 min-w-[140px] max-w-[160px]">
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Data Início *
                          </label>
                          <DatePickerBR
                            value={protocoloData.data_inicio}
                            onChange={(value) => setProtocoloData({ ...protocoloData, data_inicio: value || '' })}
                            className="h-9"
                          />
                        </div>

                        {/* Botão Continuar */}
                        <Button
                          onClick={handleContinueToReceptoras}
                          disabled={loadingPasso1 || !protocoloData.fazenda_id || !protocoloData.veterinario || !protocoloData.tecnico || !protocoloData.data_inicio}
                          className="h-9 bg-primary hover:bg-primary-dark"
                        >
                          Continuar
                        </Button>
                      </div>

                      {/* Mensagem de ajuda */}
                      {(!protocoloData.veterinario || !protocoloData.tecnico) ? (
                        <p className="text-xs text-muted-foreground mt-2">
                          Preencha veterinário e técnico para selecionar a fazenda
                        </p>
                      ) : !protocoloData.fazenda_id ? (
                        <p className="text-xs text-muted-foreground mt-2">
                          Selecione uma fazenda para continuar
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* Informações do protocolo */}
                  <ProtocoloInfoCard
                    fazendaNome={getFazendaNome(protocoloData.fazenda_id)}
                    dataInicio={protocoloData.data_inicio}
                    veterinario={protocoloData.veterinario}
                    tecnico={protocoloData.tecnico}
                  />

                  {/* Lista de Receptoras */}
                  <Card className="mt-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            Receptoras do Protocolo ({receptorasLocais.length})
                          </CardTitle>
                          <CardDescription>
                            Adicione as receptoras para este protocolo
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {/* Dialog Adicionar Receptora Existente */}
                          <Dialog
                            open={showAddReceptora}
                            onOpenChange={(open) => {
                              setShowAddReceptora(open);
                              if (!open) resetAddForm();
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Adicionar Receptora</DialogTitle>
                                <DialogDescription>
                                  Busque por identificação ou nome.
                                </DialogDescription>
                              </DialogHeader>
                              <AddReceptoraForm
                                addReceptoraForm={addReceptoraForm}
                                setAddReceptoraForm={setAddReceptoraForm}
                                buscaReceptora={buscaReceptora}
                                setBuscaReceptora={setBuscaReceptora}
                                popoverAberto={popoverAberto}
                                setPopoverAberto={setPopoverAberto}
                                receptorasFiltradas={receptorasFiltradas}
                                receptorasComStatus={receptorasComStatus}
                                loadingReceptoras={loadingReceptorasPasso1}
                                onAdd={handleAddReceptora}
                              />
                            </DialogContent>
                          </Dialog>

                          {/* Dialog Criar Nova Receptora */}
                          <Dialog
                            open={showCreateReceptora}
                            onOpenChange={(open) => {
                              setShowCreateReceptora(open);
                              if (!open) resetCreateForm();
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <UserPlus className="w-4 h-4 mr-2" />
                                Nova
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cadastrar Nova Receptora</DialogTitle>
                                <DialogDescription>
                                  Preencha os dados da nova receptora.
                                </DialogDescription>
                              </DialogHeader>
                              <CreateReceptoraForm
                                createReceptoraForm={createReceptoraForm}
                                setCreateReceptoraForm={setCreateReceptoraForm}
                                submitting={submittingPasso1}
                                onCreate={handleCreateReceptora}
                              />
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {receptorasLocais.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhuma receptora adicionada. Adicione pelo menos uma antes de finalizar.
                        </div>
                      ) : (
                        <ReceptorasTablePasso1
                          receptorasLocais={receptorasLocais}
                          onRemove={handleRemoveReceptora}
                          onUpdateCiclando={handleUpdateCiclando}
                          onUpdateQualidade={handleUpdateQualidade}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Botões de Ação */}
                  <div className="flex items-center justify-between mt-4">
                    <Button variant="outline" onClick={handleVoltarPasso1} disabled={submittingPasso1}>
                      Voltar
                    </Button>
                    <Button
                      onClick={handleFinalizarPasso1}
                      disabled={receptorasLocais.length === 0 || submittingPasso1}
                      className="bg-primary hover:bg-primary-dark"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      {submittingPasso1 ? 'Finalizando...' : 'Finalizar 1º Passo'}
                    </Button>
                  </div>

                  <ConfirmExitDialog
                    open={showConfirmExitPasso1}
                    onOpenChange={setShowConfirmExitPasso1}
                    onConfirm={handleConfirmExitPasso1}
                    title="Sair sem finalizar?"
                    description="Se você sair agora, nenhum protocolo será criado."
                  />

                  <ProtocoloResumoDialog
                    open={showResumoPasso1}
                    onClose={handleCloseResumoPasso1}
                    step={1}
                    fazendaNome={getFazendaNome(protocoloData.fazenda_id)}
                    dataInicio={protocoloData.data_inicio}
                    totalReceptoras={receptorasLocais.length}
                    receptorasConfirmadas={receptorasLocais.length}
                  />
                </>
              )}
            </TabsContent>

            {/* ========== SUB-ABA 2º PASSO ========== */}
            <TabsContent value="passo2">
              {/* Barra compacta de seleção */}
              <Card className="mb-4">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-end gap-3">
                    {/* Responsável */}
                    <div className="flex-1 min-w-[180px] max-w-[220px]">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Responsável *
                      </label>
                      <Input
                        placeholder="Nome do responsável"
                        value={passo2Form.tecnico}
                        onChange={(e) => setPasso2Form(prev => ({ ...prev, tecnico: e.target.value }))}
                        className="h-9"
                        disabled={isProtocoloFinalizado}
                      />
                    </div>

                    {/* Protocolo */}
                    <div className="flex-1 min-w-[280px] max-w-[350px]">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Protocolo Aguardando 2º Passo
                      </label>
                      <Select
                        value={protocoloSelecionadoId}
                        onValueChange={(value) => {
                          setProtocoloSelecionadoId(value);
                        }}
                        disabled={!passo2Form.tecnico.trim()}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione um protocolo" />
                        </SelectTrigger>
                        <SelectContent>
                          {protocolosAguardando2Passo.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Nenhum protocolo aguardando
                            </div>
                          ) : (
                            protocolosAguardando2Passo.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.fazenda_nome} • {formatarData(p.data_inicio)} • {p.receptoras_count} rec.
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Data 2º Passo */}
                    <div className="flex-1 min-w-[140px] max-w-[160px]">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Data 2º Passo
                      </label>
                      <DatePickerBR
                        value={passo2Form.data}
                        onChange={(value) => setPasso2Form(prev => ({ ...prev, data: value || '' }))}
                        className="h-9"
                        disabled={!protocoloSelecionadoId || isProtocoloFinalizado}
                      />
                    </div>

                    {/* Botão Finalizar */}
                    <Button
                      onClick={handleFinalizarPasso2}
                      disabled={!canFinalizePasso2 || submittingPasso2 || isProtocoloFinalizado}
                      className="h-9 bg-primary hover:bg-primary-dark"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {submittingPasso2 ? 'Salvando...' : 'Finalizar'}
                    </Button>
                  </div>

                  {/* Mensagem de ajuda */}
                  {!passo2Form.tecnico.trim() ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Preencha o responsável para selecionar o protocolo
                    </p>
                  ) : !protocoloSelecionadoId ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      {protocolosAguardando2Passo.length === 0
                        ? 'Nenhum protocolo aguardando 2º passo'
                        : 'Selecione um protocolo para continuar'}
                    </p>
                  ) : statsPasso2.pendentes > 0 ? (
                    <p className="text-xs text-amber-600 mt-2">
                      {statsPasso2.pendentes} receptora(s) aguardando avaliação
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Conteúdo do Passo 2 */}
              {loadingPasso2 ? (
                <Card>
                  <CardContent className="py-8">
                    <LoadingSpinner />
                  </CardContent>
                </Card>
              ) : protocoloSelecionadoId && protocoloPasso2 ? (
                <>
                  {/* Tabela de Receptoras */}
                  <div>
                    <ReceptorasPasso2Table
                      receptoras={receptorasPasso2}
                      motivosInapta={motivosInapta}
                      isFinalized={isProtocoloFinalizado}
                      onStatusChange={handleLocalStatusChange}
                      onMotivoChange={handleLocalMotivoChange}
                    />
                  </div>

                  <ProtocoloResumoDialog
                    open={showResumoPasso2}
                    onClose={handleCloseResumoPasso2Final}
                    step={2}
                    fazendaNome={fazendaNomePasso2}
                    dataInicio={protocoloPasso2.data_inicio}
                    totalReceptoras={receptorasPasso2.length}
                    receptorasConfirmadas={statsPasso2.confirmadas}
                    receptorasDescartadas={statsPasso2.descartadas}
                  />
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ==================== ABA HISTÓRICO ==================== */}
        <TabsContent value="historico" className="space-y-6 mt-6">
          {/* Cards de estatísticas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Protocolos</p>
                    <p className="text-2xl font-bold">{estatisticasHistorico.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Aguard. 2º Passo</p>
                    <p className="text-2xl font-bold text-amber-600">{estatisticasHistorico.aguardando2Passo}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rec. Sincronizadas</p>
                    <p className="text-2xl font-bold text-primary">{estatisticasHistorico.receptorasSincronizadas}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">% Aproveitamento</p>
                    <p className="text-2xl font-bold text-primary">{estatisticasHistorico.aproveitamento}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Fazenda, veterinário..."
                      value={filtroBusca}
                      onChange={(e) => setFiltroBusca(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aguardando_2_passo">Aguardando 2º Passo</SelectItem>
                      <SelectItem value="sincronizado">Sincronizados</SelectItem>
                      <SelectItem value="fechado">Fechados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fazenda</Label>
                  <Select
                    value={fazendaFilter || 'all'}
                    onValueChange={(value) => setFazendaFilter(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {fazendasHistorico.map((fazenda) => (
                        <SelectItem key={fazenda.id} value={fazenda.id}>
                          {fazenda.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Início (de)</Label>
                  <DatePickerBR value={filtroDataInicio} onChange={setFiltroDataInicio} />
                </div>

                <div className="space-y-2">
                  <Label>Data Início (até)</Label>
                  <DatePickerBR value={filtroDataFim} onChange={setFiltroDataFim} />
                </div>
              </div>

              <Button onClick={handleBuscar} disabled={loadingProtocolos} className="mt-4 bg-primary hover:bg-primary-dark">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </CardContent>
          </Card>

          {/* Lista de Protocolos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Protocolos</CardTitle>
              <CardDescription>
                {protocolosFiltrados.length} registro(s) encontrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProtocolos ? (
                <LoadingSpinner />
              ) : protocolosFiltrados.length === 0 ? (
                <EmptyState
                  title="Nenhum protocolo encontrado"
                  description="Ajuste os filtros ou crie um novo protocolo."
                  action={
                    <Button variant="outline" onClick={handleLimparFiltros}>
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fazenda</TableHead>
                          <TableHead>Data Início</TableHead>
                          <TableHead>Data 2º Passo</TableHead>
                          <TableHead>Receptoras</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {protocolosFiltrados.map((protocolo) => (
                          <ProtocoloRow
                            key={protocolo.id}
                            protocolo={protocolo}
                            navigate={navigate}
                            onIniciar2Passo={(id) => {
                              setProtocoloSelecionadoId(id);
                              setActiveTab('nova-sessao');
                              setActiveSubTab('passo2');
                            }}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginação */}
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <div className="text-sm text-muted-foreground">
                      Página {protocolosPage}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePaginaAnterior}
                        disabled={protocolosPage === 1 || loadingProtocolos}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleProximaPagina}
                        disabled={protocolos.length < pageSize || loadingProtocolos}
                      >
                        Próxima
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para restaurar rascunho do Passo 1 */}
      <AlertDialog open={showRestaurarPasso1Dialog} onOpenChange={setShowRestaurarPasso1Dialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retomar trabalho anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Foi encontrado um rascunho do 1º Passo não finalizado. Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={descartarRascunhoPasso1}>
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction onClick={restaurarRascunhoPasso1} className="bg-primary hover:bg-primary-dark">
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para restaurar rascunho do Passo 2 */}
      <AlertDialog open={showRestaurarPasso2Dialog} onOpenChange={setShowRestaurarPasso2Dialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retomar avaliação anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Foi encontrada uma avaliação do 2º Passo não finalizada para este protocolo. Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={descartarRascunhoPasso2}>
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rascunhoPasso2Pendente && aplicarRascunhoPasso2(rascunhoPasso2Pendente)}
              className="bg-primary hover:bg-primary-dark"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== SUB-COMPONENTES ====================

interface ProtocoloRowProps {
  protocolo: ProtocoloWithFazenda;
  navigate: ReturnType<typeof useNavigate>;
  onIniciar2Passo: (id: string) => void;
}

function ProtocoloRow({ protocolo, navigate, onIniciar2Passo }: ProtocoloRowProps) {
  const isAguardando2Passo =
    protocolo.status === 'PASSO1_FECHADO' || protocolo.status === 'PRIMEIRO_PASSO_FECHADO';
  const isFechado = protocolo.status === 'FECHADO' || protocolo.status === 'EM_TE';
  const isSincronizado = protocolo.status === 'SINCRONIZADO' || protocolo.status === 'PASSO2_FECHADO';

  return (
    <TableRow>
      <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
      <TableCell>{formatDate(protocolo.data_inicio)}</TableCell>
      <TableCell>{protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '-'}</TableCell>
      <TableCell>{protocolo.receptoras_count}</TableCell>
      <TableCell>
        <ProtocoloStatusBadge
          isFechado={isFechado}
          isSincronizado={isSincronizado}
          isAguardando2Passo={isAguardando2Passo}
          status={protocolo.status}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {isAguardando2Passo && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onIniciar2Passo(protocolo.id)}
              className="bg-primary hover:bg-primary-dark"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              2º Passo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/protocolos/${protocolo.id}/relatorio`)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Relatório
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface ProtocoloStatusBadgeProps {
  isFechado: boolean;
  isSincronizado: boolean;
  isAguardando2Passo: boolean;
  status: string | null;
}

function ProtocoloStatusBadge({
  isFechado,
  isSincronizado,
  isAguardando2Passo,
  status,
}: ProtocoloStatusBadgeProps) {
  if (isFechado) {
    return (
      <Badge variant="secondary" className="bg-muted-foreground hover:bg-muted-foreground/90 text-white">
        Fechado
      </Badge>
    );
  }

  if (isSincronizado) {
    return (
      <Badge variant="default" className="bg-primary hover:bg-primary-dark text-primary-foreground">
        Sincronizado
      </Badge>
    );
  }

  if (isAguardando2Passo) {
    return (
      <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
        Aguardando 2º Passo
      </Badge>
    );
  }

  return <Badge variant="default">{status || 'N/A'}</Badge>;
}

// ========== FORMULÁRIOS PASSO 1 ==========

interface AddReceptoraFormProps {
  addReceptoraForm: {
    receptora_id: string;
    observacoes: string;
    ciclando_classificacao: 'N' | 'CL' | null;
    qualidade_semaforo: 1 | 2 | 3 | null;
  };
  setAddReceptoraForm: React.Dispatch<React.SetStateAction<{
    receptora_id: string;
    observacoes: string;
    ciclando_classificacao: 'N' | 'CL' | null;
    qualidade_semaforo: 1 | 2 | 3 | null;
  }>>;
  buscaReceptora: string;
  setBuscaReceptora: (busca: string) => void;
  popoverAberto: boolean;
  setPopoverAberto: (open: boolean) => void;
  receptorasFiltradas: Array<{
    id: string;
    identificacao: string;
    nome?: string | null;
    status: string;
    motivoIndisponivel?: string;
    disponivel: boolean;
  }>;
  receptorasComStatus: Array<{
    id: string;
    identificacao: string;
    nome?: string | null;
  }>;
  loadingReceptoras: boolean;
  onAdd: () => Promise<void>;
}

function AddReceptoraForm({
  addReceptoraForm,
  setAddReceptoraForm,
  buscaReceptora,
  setBuscaReceptora,
  popoverAberto,
  setPopoverAberto,
  receptorasFiltradas,
  receptorasComStatus,
  loadingReceptoras,
  onAdd,
}: AddReceptoraFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Receptora *</Label>
        <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={popoverAberto}
              className="w-full justify-between"
            >
              {addReceptoraForm.receptora_id
                ? (() => {
                    const selecionada = receptorasComStatus.find(
                      (r) => String(r.id).trim() === addReceptoraForm.receptora_id.trim()
                    );
                    return selecionada
                      ? `${selecionada.identificacao}${selecionada.nome ? ` - ${selecionada.nome}` : ''}`
                      : 'Selecione uma receptora';
                  })()
                : 'Buscar receptora...'}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por identificação ou nome..."
                value={buscaReceptora}
                onValueChange={setBuscaReceptora}
              />
              <CommandList>
                {loadingReceptoras ? (
                  <div className="p-4 text-sm text-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : receptorasFiltradas.length === 0 ? (
                  <CommandEmpty>
                    {buscaReceptora.trim() ? 'Nenhuma encontrada' : 'Nenhuma disponível'}
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {receptorasFiltradas.map((r) => {
                      const rId = r.id ? String(r.id).trim() : '';
                      if (!rId) return null;
                      const stats = (r as any).historicoStats as { totalProtocolos: number; gestacoes: number; protocolosDesdeUltimaGestacao: number } | undefined;

                      return (
                        <CommandItem
                          key={r.id}
                          value={`${r.identificacao} ${r.nome || ''} ${rId}`}
                          onSelect={() => {
                            if (r.disponivel) {
                              setAddReceptoraForm({ ...addReceptoraForm, receptora_id: rId });
                              setBuscaReceptora('');
                              setPopoverAberto(false);
                            }
                          }}
                          disabled={!r.disponivel}
                          className={`group ${!r.disponivel ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="font-medium group-data-[selected=true]:text-accent-foreground">
                                  {r.identificacao}
                                </span>
                                {r.nome && (
                                  <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/70">{r.nome}</span>
                                )}
                              </div>
                              {stats && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded font-medium">{stats.totalProtocolos}P</span>
                                  <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 px-1.5 py-0.5 rounded font-medium">{stats.gestacoes}G</span>
                                  <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 px-1.5 py-0.5 rounded font-medium">{stats.protocolosDesdeUltimaGestacao}D</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <ClassificacoesCicloInline
          ciclandoValue={addReceptoraForm.ciclando_classificacao}
          qualidadeValue={addReceptoraForm.qualidade_semaforo}
          onChangeCiclando={(value) =>
            setAddReceptoraForm({ ...addReceptoraForm, ciclando_classificacao: value })
          }
          onChangeQualidade={(value) =>
            setAddReceptoraForm({ ...addReceptoraForm, qualidade_semaforo: value })
          }
          size="sm"
        />
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={addReceptoraForm.observacoes}
          onChange={(e) =>
            setAddReceptoraForm({ ...addReceptoraForm, observacoes: e.target.value })
          }
          placeholder="Observações"
          rows={2}
        />
      </div>
      <Button
        onClick={onAdd}
        className="w-full"
        disabled={loadingReceptoras || !addReceptoraForm.receptora_id}
      >
        Adicionar
      </Button>
    </div>
  );
}

interface CreateReceptoraFormProps {
  createReceptoraForm: {
    identificacao: string;
    nome: string;
    observacoes: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
  };
  setCreateReceptoraForm: React.Dispatch<React.SetStateAction<{
    identificacao: string;
    nome: string;
    observacoes: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
  }>>;
  submitting: boolean;
  onCreate: () => Promise<void>;
}

function CreateReceptoraForm({
  createReceptoraForm,
  setCreateReceptoraForm,
  submitting,
  onCreate,
}: CreateReceptoraFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Identificação (Brinco) *</Label>
        <Input
          value={createReceptoraForm.identificacao}
          onChange={(e) =>
            setCreateReceptoraForm({ ...createReceptoraForm, identificacao: e.target.value })
          }
          placeholder="Número do brinco"
        />
      </div>
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input
          value={createReceptoraForm.nome}
          onChange={(e) =>
            setCreateReceptoraForm({ ...createReceptoraForm, nome: e.target.value })
          }
          placeholder="Nome da receptora (opcional)"
        />
      </div>
      <div className="space-y-2">
        <ClassificacoesCicloInline
          ciclandoValue={createReceptoraForm.ciclando_classificacao || null}
          qualidadeValue={createReceptoraForm.qualidade_semaforo || null}
          onChangeCiclando={(value) =>
            setCreateReceptoraForm({ ...createReceptoraForm, ciclando_classificacao: value })
          }
          onChangeQualidade={(value) =>
            setCreateReceptoraForm({ ...createReceptoraForm, qualidade_semaforo: value })
          }
          size="sm"
        />
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={createReceptoraForm.observacoes}
          onChange={(e) =>
            setCreateReceptoraForm({ ...createReceptoraForm, observacoes: e.target.value })
          }
          placeholder="Observações"
          rows={2}
        />
      </div>
      <Button onClick={onCreate} className="w-full" disabled={submitting}>
        <UserPlus className="w-4 h-4 mr-2" />
        {submitting ? 'Criando...' : 'Criar e Adicionar'}
      </Button>
    </div>
  );
}

interface ReceptorasTablePasso1Props {
  receptorasLocais: Array<{
    id?: string;
    identificacao: string;
    nome?: string;
    observacoes?: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
    historicoStats?: {
      totalProtocolos: number;
      gestacoes: number;
      protocolosDesdeUltimaGestacao: number;
    };
  }>;
  onRemove: (index: number) => void;
  onUpdateCiclando: (index: number, value: 'N' | 'CL' | null) => void;
  onUpdateQualidade: (index: number, value: 1 | 2 | 3 | null) => void;
}

function ReceptorasTablePasso1({
  receptorasLocais,
  onRemove,
  onUpdateCiclando,
  onUpdateQualidade,
}: ReceptorasTablePasso1Props) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Cabeçalho */}
      <div className="grid grid-cols-[minmax(120px,1fr)_repeat(3,36px)_100px_100px_1fr_36px] gap-0 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        <div className="px-3 py-2">Receptora</div>
        <div className="px-1 py-2 text-center" title="Protocolos">P</div>
        <div className="px-1 py-2 text-center" title="Gestações">G</div>
        <div className="px-1 py-2 text-center" title="Desde última">D</div>
        <div className="px-2 py-2 text-center">Ciclando</div>
        <div className="px-2 py-2 text-center">Qualidade</div>
        <div className="px-2 py-2">Obs.</div>
        <div className="px-2 py-2"></div>
      </div>

      {/* Linhas */}
      {receptorasLocais.map((r, index) => {
        const rowKey = r.id && r.id.trim() !== '' ? r.id : `new-${index}`;
        const stats = r.historicoStats;

        return (
          <div
            key={rowKey}
            className="group grid grid-cols-[minmax(120px,1fr)_repeat(3,36px)_100px_100px_1fr_36px] gap-0 items-center border-t border-border hover:bg-muted/50"
          >
            {/* Receptora */}
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                {index + 1}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm text-foreground truncate">{r.identificacao}</span>
                {r.nome && <span className="text-[10px] text-muted-foreground truncate">{r.nome}</span>}
              </div>
            </div>

            {/* Histórico P G D */}
            <div className="px-1 py-1.5 text-center">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-muted text-foreground rounded">
                {stats?.totalProtocolos ?? 0}
              </span>
            </div>
            <div className="px-1 py-1.5 text-center">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-primary/15 text-primary rounded">
                {stats?.gestacoes ?? 0}
              </span>
            </div>
            <div className="px-1 py-1.5 text-center">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded">
                {stats?.protocolosDesdeUltimaGestacao ?? 0}
              </span>
            </div>

            {/* Ciclando */}
            <div className="px-2 py-1 flex justify-center">
              <CiclandoBadge
                value={r.ciclando_classificacao}
                onChange={(value) => onUpdateCiclando(index, value)}
                variant="editable"
              />
            </div>

            {/* Qualidade */}
            <div className="px-2 py-1 flex justify-center">
              <QualidadeSemaforo
                value={r.qualidade_semaforo}
                onChange={(value) => onUpdateQualidade(index, value)}
                variant="row"
              />
            </div>

            {/* Obs */}
            <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
              {r.observacoes || '-'}
            </div>

            {/* Ação */}
            <div className="px-1 py-1 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(index)}
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
