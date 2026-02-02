/**
 * Página de Protocolos de Sincronização
 *
 * Estrutura:
 * - Sub-abas:
 *   - "1º Passo" - Criar novo protocolo
 *   - "2º Passo" - Continuar protocolo pendente
 *
 * O histórico de protocolos está disponível em /relatorios/servicos
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Plus,
  Search,
  UserPlus,
  Lock,
  X,
  CheckCircle,
  Syringe,
  ClipboardCheck,
} from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getStatusColor } from '@/components/shared/StatusBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import ClassificacoesCicloInline from '@/components/shared/ClassificacoesCicloInline';

// Components
import {
  ProtocoloInfoCard,
  ConfirmExitDialog,
  ReceptorasPasso2Table,
} from '@/components/protocolos';

// Hooks
import {
  useProtocolosData,
  useProtocoloWizardData,
  useProtocoloWizardReceptoras,
  useProtocoloWizardSubmit,
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
  const [activeSubTab, setActiveSubTab] = useState<'passo1' | 'passo2'>('passo1');

  // ========== ESTADOS RASCUNHO ==========
  const [showRestaurarPasso1Dialog, setShowRestaurarPasso1Dialog] = useState(false);
  const [showRestaurarPasso2Dialog, setShowRestaurarPasso2Dialog] = useState(false);
  const [rascunhoPasso2Pendente, setRascunhoPasso2Pendente] = useState<RascunhoPasso2 | null>(null);
  const rascunhoPasso2VerificadoRef = useRef<string | null>(null);

  // ========== DADOS DE PROTOCOLOS ==========
  const {
    loading: loadingHistorico,
    protocolos,
    loadData: loadDataHistorico,
    loadProtocolos,
  } = useProtocolosData();

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
    handleFinalizarPasso1,
    handleConfirmExit: handleConfirmExitPasso1,
    validateProtocoloForm,
  } = useProtocoloWizardSubmit({
    protocoloData,
    receptorasLocais,
    onSuccess: () => {
      // Reset form and reload
      handleResetPasso1();
      limparRascunhoPasso1();
      loadProtocolos(1);
    },
  });

  const submittingPasso1 = receptorasSubmitting || submitSubmittingPasso1;

  // ========== PASSO 2 ==========
  const [protocoloSelecionadoId, setProtocoloSelecionadoId] = useState<string>('');
  const [protocolosPasso2Lista, setProtocolosPasso2Lista] = useState<Array<{
    id: string;
    fazenda_id: string;
    fazenda_nome: string;
    data_inicio: string;
    receptoras_count: number;
  }>>([]);
  const [loadingProtocolosPasso2, setLoadingProtocolosPasso2] = useState(false);
  const [fazendaFilterPasso2, setFazendaFilterPasso2] = useState<string>('');
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
    handleStatusChange,
    handleMotivoChange,
    handleFinalizarPasso2,
  } = useProtocoloPasso2Actions({
    protocoloId: protocoloSelecionadoId,
    protocolo: protocoloPasso2,
    receptoras: receptorasPasso2,
    setReceptoras: setReceptorasPasso2,
    setProtocolo: setProtocoloPasso2,
    passo2Form,
    motivosInapta,
    onSuccess: () => {
      // Reset form and reload
      handleResetPasso2();
      limparRascunhoPasso2();
      loadProtocolos(1);
      loadProtocolosPasso2Lista();
    },
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

  // Protocolos aguardando 2º passo (filtrado por fazenda se selecionada)
  const protocolosAguardando2Passo = useMemo(() => {
    if (!fazendaFilterPasso2) return protocolosPasso2Lista;
    return protocolosPasso2Lista.filter(p => p.fazenda_id === fazendaFilterPasso2);
  }, [protocolosPasso2Lista, fazendaFilterPasso2]);

  // Lista de fazendas únicas para o filtro do passo 2
  const fazendasPasso2 = useMemo(() => {
    const fazendasMap = new Map<string, string>();
    protocolosPasso2Lista.forEach(p => {
      if (!fazendasMap.has(p.fazenda_id)) {
        fazendasMap.set(p.fazenda_id, p.fazenda_nome);
      }
    });
    return Array.from(fazendasMap.entries()).map(([id, nome]) => ({ id, nome }));
  }, [protocolosPasso2Lista]);

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

  // ========== CARREGAR PROTOCOLOS PASSO 2 ==========
  const loadProtocolosPasso2Lista = useCallback(async () => {
    try {
      setLoadingProtocolosPasso2(true);

      // Buscar todos os protocolos com status PASSO1_FECHADO (independente de outros filtros)
      const { data: protocolosData, error } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, fazenda_id, data_inicio, status')
        .eq('status', 'PASSO1_FECHADO')
        .order('data_inicio', { ascending: false });

      if (error) throw error;

      if (!protocolosData || protocolosData.length === 0) {
        setProtocolosPasso2Lista([]);
        return;
      }

      // Buscar contagem de receptoras e nomes das fazendas
      const protocoloIds = protocolosData.map(p => p.id);
      const fazendaIds = [...new Set(protocolosData.map(p => p.fazenda_id))];

      const [receptorasResult, fazendasResult] = await Promise.all([
        supabase
          .from('protocolo_receptoras')
          .select('protocolo_id')
          .in('protocolo_id', protocoloIds),
        supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', fazendaIds),
      ]);

      // Criar mapa de contagem por protocolo
      const contagemMap: Record<string, number> = {};
      (receptorasResult.data || []).forEach(pr => {
        contagemMap[pr.protocolo_id] = (contagemMap[pr.protocolo_id] || 0) + 1;
      });

      // Criar mapa de nomes de fazenda
      const fazendaMap: Record<string, string> = {};
      (fazendasResult.data || []).forEach(f => {
        fazendaMap[f.id] = f.nome;
      });

      // Filtrar protocolos sem receptoras (zumbis) e montar lista
      const listaFinal = protocolosData
        .filter(p => (contagemMap[p.id] || 0) > 0)
        .map(p => ({
          id: p.id,
          fazenda_id: p.fazenda_id,
          fazenda_nome: fazendaMap[p.fazenda_id] || 'N/A',
          data_inicio: p.data_inicio,
          receptoras_count: contagemMap[p.id] || 0,
        }));

      setProtocolosPasso2Lista(listaFinal);
    } catch (error) {
      console.error('Erro ao carregar protocolos passo 2:', error);
      setProtocolosPasso2Lista([]);
    } finally {
      setLoadingProtocolosPasso2(false);
    }
  }, []);

  // ========== EFFECTS ==========
  useEffect(() => {
    loadDataHistorico();
    loadFazendasPasso1();
    loadProtocolosPasso2Lista();
  }, [loadDataHistorico, loadFazendasPasso1, loadProtocolosPasso2Lista]);

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

  // Configurar formulário quando protocolo carrega
  useEffect(() => {
    if (protocoloPasso2) {
      if (protocoloPasso2.passo2_data || protocoloPasso2.passo2_tecnico_responsavel) {
        setPasso2Form({
          data: protocoloPasso2.passo2_data || new Date().toISOString().split('T')[0],
          tecnico: protocoloPasso2.passo2_tecnico_responsavel || '',
        });
      }
    }
  }, [protocoloPasso2]);

  // Configurar motivos de inapta quando receptoras carregam
  useEffect(() => {
    if (receptorasPasso2.length > 0) {
      const motivosInaptaLocal: Record<string, string> = {};
      receptorasPasso2
        .filter((r) => r.pr_status === 'INAPTA' && r.pr_motivo_inapta)
        .forEach((r) => {
          motivosInaptaLocal[r.id] = r.pr_motivo_inapta || '';
        });
      setMotivosInapta(motivosInaptaLocal);
    }
  }, [receptorasPasso2]);

  // Verificar rascunho do passo 2 APÓS receptoras carregarem
  useEffect(() => {
    if (
      protocoloPasso2 &&
      receptorasPasso2.length > 0 &&
      rascunhoPasso2VerificadoRef.current !== protocoloPasso2.id
    ) {
      rascunhoPasso2VerificadoRef.current = protocoloPasso2.id;
      const rascunho = getRascunhoPasso2();
      if (rascunho && rascunho.protocoloSelecionadoId === protocoloPasso2.id) {
        setRascunhoPasso2Pendente(rascunho);
        setShowRestaurarPasso2Dialog(true);
      }
    }
  }, [protocoloPasso2, receptorasPasso2.length, getRascunhoPasso2]);

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
    setFazendaFilterPasso2('');
    limparRascunhoPasso2();
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

      {/* ==================== SESSÃO DE PROTOCOLOS ==================== */}
      <div className="mt-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'passo1' | 'passo2')} className="w-full">
            {/* Premium Tabs */}
            <div className="rounded-xl border border-border bg-card p-1.5 mb-4">
              <div className="flex gap-1">
                {[
                  { value: 'passo1', label: '1º Passo', icon: Syringe, count: 0 },
                  { value: 'passo2', label: '2º Passo', icon: ClipboardCheck, count: protocolosPasso2Lista.length },
                ].map(({ value, label, icon: Icon, count }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveSubTab(value as 'passo1' | 'passo2')}
                    className={`
                      relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                      text-sm font-medium transition-all duration-200
                      ${activeSubTab === value
                        ? 'bg-muted/80 text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }
                    `}
                  >
                    {activeSubTab === value && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
                    )}
                    <div className={`
                      flex items-center justify-center w-7 h-7 rounded-md transition-colors
                      ${activeSubTab === value ? 'bg-primary/15' : 'bg-muted/50'}
                    `}>
                      <Icon className={`w-4 h-4 ${activeSubTab === value ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full ${
                        activeSubTab === value
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ========== SUB-ABA 1º PASSO ========== */}
            <TabsContent value="passo1">
              {passo1CurrentStep === 'form' ? (
                <>
                  {/* Barra Premium de Controles */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                    <div className="flex flex-wrap items-stretch">
                      {/* Grupo: Responsáveis */}
                      <div className="flex items-center gap-3 px-4 py-3 border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 rounded-full bg-primary/40" />
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsáveis</span>
                        </div>
                        <Input
                          placeholder="Veterinário *"
                          value={protocoloData.veterinario}
                          onChange={(e) => setProtocoloData({ ...protocoloData, veterinario: e.target.value })}
                          className="h-9 w-[160px] bg-background/80 border-primary/20 focus:border-primary/40"
                        />
                        <Input
                          placeholder="Técnico"
                          value={protocoloData.tecnico}
                          onChange={(e) => setProtocoloData({ ...protocoloData, tecnico: e.target.value })}
                          className="h-9 w-[160px] bg-background"
                        />
                      </div>

                      {/* Grupo: Local e Data */}
                      <div className="flex items-center gap-3 px-4 py-3 border-r border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 rounded-full bg-primary/40" />
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Local</span>
                        </div>
                        <Select
                          value={protocoloData.fazenda_id}
                          onValueChange={(value) => setProtocoloData({ ...protocoloData, fazenda_id: value })}
                          disabled={!protocoloData.veterinario}
                        >
                          <SelectTrigger className="h-9 w-[180px] bg-background">
                            <SelectValue placeholder="Fazenda *" />
                          </SelectTrigger>
                          <SelectContent>
                            {fazendasPasso1.map((fazenda) => (
                              <SelectItem key={fazenda.id} value={fazenda.id}>
                                {fazenda.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <DatePickerBR
                          value={protocoloData.data_inicio}
                          onChange={(value) => setProtocoloData({ ...protocoloData, data_inicio: value || '' })}
                          className="h-9 w-[130px] bg-background"
                        />
                      </div>

                      {/* Grupo: Ação */}
                      <div className="flex items-center gap-2 px-4 py-3 ml-auto bg-gradient-to-b from-muted/50 to-transparent">
                        <Button
                          onClick={handleContinueToReceptoras}
                          disabled={loadingPasso1 || !protocoloData.fazenda_id || !protocoloData.veterinario || !protocoloData.data_inicio}
                          className="h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm shadow-primary/25"
                        >
                          Continuar
                        </Button>
                      </div>
                    </div>
                  </div>
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
                </>
              )}
            </TabsContent>

            {/* ========== SUB-ABA 2º PASSO ========== */}
            <TabsContent value="passo2">
              {!protocoloSelecionadoId ? (
                /* Etapa 1: Seleção do protocolo - Barra Premium */
                <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                  <div className="flex flex-wrap items-stretch">
                    {/* Grupo: Responsável */}
                    <div className="flex items-center gap-3 px-4 py-3 border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full bg-primary/40" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável</span>
                      </div>
                      <Input
                        placeholder="Nome do responsável *"
                        value={passo2Form.tecnico}
                        onChange={(e) => setPasso2Form(prev => ({ ...prev, tecnico: e.target.value }))}
                        className="h-9 w-[180px] bg-background/80 border-primary/20 focus:border-primary/40"
                      />
                    </div>

                    {/* Grupo: Fazenda */}
                    <div className="flex items-center gap-3 px-4 py-3 border-r border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full bg-primary/40" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fazenda</span>
                      </div>
                      <Select
                        value={fazendaFilterPasso2}
                        onValueChange={setFazendaFilterPasso2}
                      >
                        <SelectTrigger className="h-9 w-[180px] bg-background">
                          <SelectValue placeholder="Selecione a fazenda" />
                        </SelectTrigger>
                        <SelectContent>
                          {fazendasPasso2.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Grupo: Seleção */}
                    <div className="flex items-center gap-3 px-4 py-3 border-r border-border flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full bg-primary/40" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</span>
                      </div>
                      <Select
                        value={protocoloSelecionadoId}
                        onValueChange={(value) => {
                          setProtocoloSelecionadoId(value);
                        }}
                        disabled={!passo2Form.tecnico.trim() || !fazendaFilterPasso2}
                      >
                        <SelectTrigger className="h-9 min-w-[280px] bg-background">
                          <SelectValue placeholder={!fazendaFilterPasso2 ? "Selecione a fazenda primeiro" : "Selecione um protocolo *"} />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingProtocolosPasso2 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Carregando...
                            </div>
                          ) : protocolosAguardando2Passo.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Nenhum protocolo nesta fazenda
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
                      <DatePickerBR
                        value={passo2Form.data}
                        onChange={(value) => setPasso2Form(prev => ({ ...prev, data: value || '' }))}
                        className="h-9 w-[130px] bg-background"
                      />
                    </div>
                  </div>
                </div>
              ) : loadingPasso2 ? (
                /* Loading */
                <Card>
                  <CardContent className="py-8">
                    <LoadingSpinner />
                  </CardContent>
                </Card>
              ) : protocoloPasso2 ? (
                /* Etapa 2: Avaliação das receptoras (similar à etapa receptoras do Passo 1) */
                <>
                  {/* Info Card (mesmo padrão do Passo 1) */}
                  <ProtocoloInfoCard
                    fazendaNome={fazendaNomePasso2}
                    dataInicio={protocoloPasso2.data_inicio}
                    veterinario={protocoloPasso2.responsavel_inicio || '-'}
                    tecnico={protocoloPasso2.tecnico_responsavel || '-'}
                    passo2Data={passo2Form.data}
                    passo2Tecnico={passo2Form.tecnico}
                    showPasso2={true}
                  />

                  {/* Card com tabela (mesmo padrão do Passo 1) */}
                  <Card className="mt-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            Receptoras para Avaliação ({receptorasPasso2.length})
                          </CardTitle>
                          <CardDescription>
                            {isProtocoloFinalizado
                              ? 'Protocolo já finalizado'
                              : statsPasso2.pendentes > 0
                                ? `${statsPasso2.pendentes} receptora(s) aguardando avaliação`
                                : 'Todas as receptoras foram avaliadas'}
                          </CardDescription>
                        </div>
                        {/* Stats badges */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {statsPasso2.confirmadas} aptas
                          </Badge>
                          {statsPasso2.descartadas > 0 && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                              {statsPasso2.descartadas} inaptas
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ReceptorasPasso2Table
                        receptoras={receptorasPasso2}
                        motivosInapta={motivosInapta}
                        isFinalized={isProtocoloFinalizado}
                        onStatusChange={handleLocalStatusChange}
                        onMotivoChange={handleLocalMotivoChange}
                        hideCard={true}
                      />
                    </CardContent>
                  </Card>

                  {/* Botões de Ação (mesmo padrão do Passo 1) */}
                  {!isProtocoloFinalizado && (
                    <div className="flex items-center justify-between mt-4">
                      <Button variant="outline" onClick={handleResetPasso2} disabled={submittingPasso2}>
                        Voltar
                      </Button>
                      <Button
                        onClick={handleFinalizarPasso2}
                        disabled={!canFinalizePasso2 || submittingPasso2}
                        className="bg-primary hover:bg-primary-dark"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        {submittingPasso2 ? 'Finalizando...' : 'Finalizar 2º Passo'}
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

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
                          className={`group ${!r.disponivel ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            {/* Identificação e nome */}
                            <div className="flex flex-col min-w-0 flex-shrink">
                              <span className={`font-medium truncate ${r.disponivel ? 'group-data-[selected=true]:text-accent-foreground' : 'text-muted-foreground'}`}>
                                {r.identificacao}
                              </span>
                              {r.nome && (
                                <span className="text-xs text-muted-foreground truncate group-data-[selected=true]:text-accent-foreground/70">{r.nome}</span>
                              )}
                            </div>

                            {/* Para receptoras DISPONÍVEIS: mostrar stats de histórico */}
                            {r.disponivel && stats && (
                              <div className="flex items-center gap-1 shrink-0 ml-auto">
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium" title="Protocolos">{stats.totalProtocolos}P</span>
                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium" title="Gestações">{stats.gestacoes}G</span>
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium" title="Desde última gestação">{stats.protocolosDesdeUltimaGestacao}D</span>
                              </div>
                            )}

                            {/* Para receptoras INDISPONÍVEIS: mostrar badge de status com cor semântica */}
                            {!r.disponivel && (
                              <Badge
                                variant="outline"
                                className={`ml-auto text-[10px] px-1.5 py-0 shrink-0 ${getStatusColor(r.status)}`}
                              >
                                {formatStatusLabel(r.status)}
                              </Badge>
                            )}
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
    /* Container com scroll horizontal quando necessário */
    <div className="overflow-x-auto rounded-lg border border-border">
      {/* Tabela: min-w garante largura mínima, w-full distribui uniformemente */}
      <div className="min-w-[700px] w-full">
        {/* Cabeçalho - colunas fixas + flexíveis com minmax + separador de contexto */}
        <div className="grid grid-cols-[minmax(160px,1.5fr)_36px_36px_36px_16px_90px_90px_minmax(100px,1fr)_40px] gap-0 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <div className="px-3 py-2">Receptora</div>
          <div className="px-1 py-2 text-center" title="Protocolos">P</div>
          <div className="px-1 py-2 text-center" title="Gestações">G</div>
          <div className="px-1 py-2 text-center" title="Desde última">D</div>
          <div className="border-r border-border/50"></div>
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
              className="group grid grid-cols-[minmax(160px,1.5fr)_36px_36px_36px_16px_90px_90px_minmax(100px,1fr)_40px] gap-0 items-center border-t border-border hover:bg-muted/50"
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

            {/* Separador de contexto */}
            <div className="border-r border-border/50 h-full"></div>

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
    </div>
  );
}
