/**
 * Página de Aspirações
 *
 * Estrutura:
 * - Aba "Nova Sessão" - Criar novo pacote de aspiração
 *   - Barra superior: Vet | Téc | Fazenda | Data | Hora | Continuar
 *   - Após continuar: Fazendas Destino + Doadoras + Tabela
 *   - Finalizar cria tudo no banco
 *   - localStorage para persistir rascunho
 * - Aba "Histórico" - Listagem de todas as aspirações
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao, Fazenda, Doadora } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import {
  Plus,
  Eye,
  Filter,
  Search,
  Clock,
  PlayCircle,
  X,
  UserPlus,
  Trash2,
  Save,
  AlertTriangle,
  Syringe,
  CircleDot,
  TrendingUp,
  RefreshCw,
  User,
  MapPin,
} from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { DataTable } from '@/components/shared/DataTable';

// ==================== TYPES ====================

interface PacoteComNomes extends PacoteAspiracao {
  fazenda_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_doadoras?: number;
}

interface FazendaSelect {
  id: string;
  nome: string;
}

interface DoadoraLocal {
  id?: string; // undefined se for nova doadora criada localmente
  doadora_id: string;
  registro: string;
  nome?: string;
  raca?: string;
  isNew?: boolean; // true se for doadora criada localmente (não existe no banco ainda)
  // Dados da aspiração
  horario_aspiracao: string;
  hora_final: string;
  // Oócitos: A (Atrésicos), D (Degenerados), E (Expandidos), Dn (Desnudos), V (Viáveis)
  atresicos: number;
  degenerados: number;
  expandidos: number;
  desnudos: number;
  viaveis: number;
  total_oocitos: number;
  recomendacao_touro: string;
  observacoes: string;
}

interface RascunhoAspiracao {
  formData: {
    fazenda_id: string;
    data_aspiracao: string;
    horario_inicio: string;
    veterinario_responsavel: string;
    tecnico_responsavel: string;
  };
  fazendas_destino_ids: string[];
  doadoras: DoadoraLocal[];
  timestamp: number;
}

const RASCUNHO_KEY = 'passagene_aspiracao_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

// ==================== COMPONENT ====================

export default function Aspiracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'nova-sessao' | 'historico'>('nova-sessao');

  // ========== ESTADOS COMPARTILHADOS ==========
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loadingFazendas, setLoadingFazendas] = useState(false);

  // ========== ESTADOS NOVA SESSÃO ==========
  const [currentStep, setCurrentStep] = useState<'form' | 'doadoras'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);
  const [showSairDialog, setShowSairDialog] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fazenda_id: '',
    data_aspiracao: new Date().toISOString().split('T')[0],
    horario_inicio: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  const [fazendasDestinoIds, setFazendasDestinoIds] = useState<string[]>([]);
  const [doadoras, setDoadoras] = useState<DoadoraLocal[]>([]);

  // Doadoras disponíveis para adicionar
  const [doadorasDisponiveis, setDoadorasDisponiveis] = useState<Doadora[]>([]);
  const [loadingDoadoras, setLoadingDoadoras] = useState(false);

  // Busca fazenda destino
  const destinoRequestId = useRef(0);
  const [fazendasDestinoResultados, setFazendasDestinoResultados] = useState<FazendaSelect[]>([]);
  const [loadingDestino, setLoadingDestino] = useState(false);
  const [destinoPopoverOpen, setDestinoPopoverOpen] = useState(false);
  const [buscaFazendaDestino, setBuscaFazendaDestino] = useState('');

  // Dialog adicionar doadora
  const [showAddDoadoraDialog, setShowAddDoadoraDialog] = useState(false);
  const [showCreateDoadoraDialog, setShowCreateDoadoraDialog] = useState(false);
  const [selectedDoadoraId, setSelectedDoadoraId] = useState('');

  // Edição inline - índice da linha em edição (null = nenhuma)
  const [editingMobileIndex, setEditingMobileIndex] = useState<number | null>(null);

  // Form criar doadora
  const [createDoadoraForm, setCreateDoadoraForm] = useState({
    registro: '',
    nome: '',
    raca: '',
    racaCustom: '',
  });
  const racasPredefinidas = ['Nelore', 'Gir', 'Girolando', 'Holandesa', 'Jersey', 'Senepol', 'Angus', 'Brahman'];

  // ========== ESTADOS HISTÓRICO ==========
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [pacotesFiltrados, setPacotesFiltrados] = useState<PacoteComNomes[]>([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [filtroFazenda, setFiltroFazenda] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 15;

  // ========== COMPUTED ==========
  const buscaDestino = buscaFazendaDestino.trim();
  const buscaDestinoAtiva = buscaDestino.length >= 2;
  const fazendasDestinoFiltradas = fazendasDestinoResultados.filter(
    (f) => !fazendasDestinoIds.includes(f.id)
  );

  const totalOocitos = useMemo(() => {
    return doadoras.reduce((sum, d) => sum + (d.total_oocitos || 0), 0);
  }, [doadoras]);

  const canFinalizar = fazendasDestinoIds.length > 0 && doadoras.length > 0;

  const temDadosNaoSalvos = currentStep === 'doadoras' || doadoras.length > 0;

  // Paginação computed
  const totalPaginas = Math.ceil(pacotesFiltrados.length / ITENS_POR_PAGINA);
  const pacotesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    return pacotesFiltrados.slice(inicio, fim);
  }, [pacotesFiltrados, paginaAtual]);

  // ========== EFEITOS ==========

  // Carregar fazendas
  useEffect(() => {
    loadFazendas();
  }, []);

  // Verificar rascunho ao montar
  useEffect(() => {
    const rascunho = getRascunho();
    if (rascunho) {
      setShowRestaurarDialog(true);
    }
  }, []);

  // Salvar rascunho automaticamente (debounced)
  useEffect(() => {
    if (currentStep === 'doadoras' || doadoras.length > 0) {
      const timer = setTimeout(() => {
        salvarRascunho();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData, fazendasDestinoIds, doadoras, currentStep]);

  // Buscar fazendas destino
  useEffect(() => {
    const termo = buscaDestino;
    if (!termo) {
      setFazendasDestinoResultados([]);
      setLoadingDestino(false);
      return;
    }
    const requestId = ++destinoRequestId.current;
    setLoadingDestino(true);
    supabase
      .from('fazendas')
      .select('id, nome')
      .ilike('nome', `%${termo}%`)
      .order('nome', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (requestId !== destinoRequestId.current) return;
        setFazendasDestinoResultados(data || []);
      })
      .finally(() => {
        if (requestId !== destinoRequestId.current) return;
        setLoadingDestino(false);
      });
  }, [buscaFazendaDestino]);

  // Carregar doadoras quando mudar fazenda
  useEffect(() => {
    if (formData.fazenda_id && currentStep === 'doadoras') {
      loadDoadorasDisponiveis();
    }
  }, [formData.fazenda_id, currentStep]);

  // ========== FUNÇÕES RASCUNHO ==========

  const getRascunho = (): RascunhoAspiracao | null => {
    try {
      const raw = localStorage.getItem(RASCUNHO_KEY);
      if (!raw) return null;

      const rascunho: RascunhoAspiracao = JSON.parse(raw);

      // Verificar expiração
      const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
      if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
        localStorage.removeItem(RASCUNHO_KEY);
        return null;
      }

      return rascunho;
    } catch {
      return null;
    }
  };

  const salvarRascunho = () => {
    const rascunho: RascunhoAspiracao = {
      formData,
      fazendas_destino_ids: fazendasDestinoIds,
      doadoras,
      timestamp: Date.now(),
    };
    localStorage.setItem(RASCUNHO_KEY, JSON.stringify(rascunho));
  };

  const limparRascunho = () => {
    localStorage.removeItem(RASCUNHO_KEY);
  };

  const restaurarRascunho = () => {
    const rascunho = getRascunho();
    if (rascunho) {
      setFormData(rascunho.formData);
      setFazendasDestinoIds(rascunho.fazendas_destino_ids);
      setDoadoras(rascunho.doadoras);
      setCurrentStep('doadoras');
    }
    setShowRestaurarDialog(false);
  };

  const descartarRascunho = () => {
    limparRascunho();
    setShowRestaurarDialog(false);
  };

  // ========== FUNÇÕES CARREGAMENTO ==========

  const loadFazendas = async () => {
    try {
      setLoadingFazendas(true);
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingFazendas(false);
    }
  };

  const loadDoadorasDisponiveis = async () => {
    if (!formData.fazenda_id) return;

    try {
      setLoadingDoadoras(true);
      const { data, error } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', formData.fazenda_id)
        .order('registro', { ascending: true });

      if (error) throw error;

      // Filtrar doadoras já adicionadas
      const idsAdicionados = doadoras.map(d => d.doadora_id);
      const disponiveis = (data || []).filter(d => !idsAdicionados.includes(d.id));
      setDoadorasDisponiveis(disponiveis);
    } catch (error) {
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingDoadoras(false);
    }
  };

  // ========== FUNÇÕES NOVA SESSÃO ==========

  const handleContinuar = () => {
    if (!formData.veterinario_responsavel.trim()) {
      toast({ title: 'Veterinário é obrigatório', variant: 'destructive' });
      return;
    }
    if (!formData.tecnico_responsavel.trim()) {
      toast({ title: 'Técnico é obrigatório', variant: 'destructive' });
      return;
    }
    if (!formData.fazenda_id) {
      toast({ title: 'Fazenda é obrigatória', variant: 'destructive' });
      return;
    }
    if (!formData.data_aspiracao) {
      toast({ title: 'Data é obrigatória', variant: 'destructive' });
      return;
    }

    setCurrentStep('doadoras');
  };

  const handleVoltar = () => {
    setCurrentStep('form');
  };

  // Calcula horário de início para nova doadora
  const getHorarioInicioNovaDoadora = useCallback(() => {
    if (doadoras.length === 0) {
      return formData.horario_inicio || '';
    }
    // Pega o hora_final da última doadora
    const ultimaDoadora = doadoras[doadoras.length - 1];
    return ultimaDoadora.hora_final || '';
  }, [doadoras, formData.horario_inicio]);

  const handleAddDoadora = () => {
    if (!selectedDoadoraId) {
      toast({ title: 'Selecione uma doadora', variant: 'destructive' });
      return;
    }

    const doadoraSelecionada = doadorasDisponiveis.find(d => d.id === selectedDoadoraId);
    if (!doadoraSelecionada) return;

    const novaDoadora: DoadoraLocal = {
      doadora_id: doadoraSelecionada.id,
      registro: doadoraSelecionada.registro,
      nome: doadoraSelecionada.nome || undefined,
      raca: doadoraSelecionada.raca || undefined,
      horario_aspiracao: getHorarioInicioNovaDoadora(),
      hora_final: '',
      atresicos: 0,
      degenerados: 0,
      expandidos: 0,
      desnudos: 0,
      viaveis: 0,
      total_oocitos: 0,
      recomendacao_touro: '',
      observacoes: '',
    };

    setDoadoras(prev => [...prev, novaDoadora]);
    setDoadorasDisponiveis(prev => prev.filter(d => d.id !== selectedDoadoraId));
    setSelectedDoadoraId('');
    setShowAddDoadoraDialog(false);
  };

  const handleCreateDoadora = () => {
    if (!createDoadoraForm.registro.trim()) {
      toast({ title: 'Registro é obrigatório', variant: 'destructive' });
      return;
    }

    const raca = createDoadoraForm.raca === 'Outra'
      ? createDoadoraForm.racaCustom
      : createDoadoraForm.raca;

    const novaDoadora: DoadoraLocal = {
      doadora_id: `new_${Date.now()}`, // ID temporário
      registro: createDoadoraForm.registro.trim(),
      nome: createDoadoraForm.nome.trim() || undefined,
      raca: raca || undefined,
      isNew: true,
      horario_aspiracao: getHorarioInicioNovaDoadora(),
      hora_final: '',
      atresicos: 0,
      degenerados: 0,
      expandidos: 0,
      desnudos: 0,
      viaveis: 0,
      total_oocitos: 0,
      recomendacao_touro: '',
      observacoes: '',
    };

    setDoadoras(prev => [...prev, novaDoadora]);
    setCreateDoadoraForm({ registro: '', nome: '', raca: '', racaCustom: '' });
    setShowCreateDoadoraDialog(false);
  };

  const handleRemoveDoadora = (index: number) => {
    const doadora = doadoras[index];
    setDoadoras(prev => prev.filter((_, i) => i !== index));

    // Se não era nova, volta para disponíveis
    if (!doadora.isNew) {
      const doadoraOriginal = fazendas.length > 0 ? doadorasDisponiveis.find(d => d.id === doadora.doadora_id) : null;
      if (!doadoraOriginal) {
        // Recarregar doadoras disponíveis
        loadDoadorasDisponiveis();
      }
    }
  };

  // Atualiza uma doadora inline
  const handleUpdateDoadora = useCallback((index: number, field: keyof DoadoraLocal, value: string | number) => {
    setDoadoras(prev => {
      const newDoadoras = prev.map((d, i) => {
        if (i !== index) return d;

        const updated = { ...d, [field]: value };

        // Recalcular total se for campo de oócitos (A, D, E, Dn, V)
        const oocitosFields = ['atresicos', 'degenerados', 'expandidos', 'desnudos', 'viaveis'];
        if (oocitosFields.includes(field as string)) {
          const getVal = (f: string) => {
            if (f === field) return typeof value === 'number' ? value : parseInt(String(value)) || 0;
            return (d as Record<string, number>)[f] || 0;
          };
          updated.total_oocitos = getVal('atresicos') + getVal('degenerados') + getVal('expandidos') + getVal('desnudos') + getVal('viaveis');
        }

        return updated;
      });

      // Se atualizou hora_final, atualizar hora_inicio da próxima doadora
      if (field === 'hora_final' && index < newDoadoras.length - 1) {
        newDoadoras[index + 1] = {
          ...newDoadoras[index + 1],
          horario_aspiracao: value as string,
        };
      }

      return newDoadoras;
    });
  }, []);

  const handleFinalizar = async () => {
    if (!canFinalizar) return;

    try {
      setSubmitting(true);

      // 1. Criar doadoras novas (se houver)
      const doadorasParaCriar = doadoras.filter(d => d.isNew);
      const doadoraIdMap = new Map<string, string>(); // tempId -> realId

      for (const doadora of doadorasParaCriar) {
        const { data: novaDoadora, error } = await supabase
          .from('doadoras')
          .insert({
            fazenda_id: formData.fazenda_id,
            registro: doadora.registro,
            nome: doadora.nome || null,
            raca: doadora.raca || null,
          })
          .select()
          .single();

        if (error) throw error;
        doadoraIdMap.set(doadora.doadora_id, novaDoadora.id);
      }

      // 2. Criar pacote de aspiração
      const { data: pacote, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .insert({
          fazenda_id: formData.fazenda_id,
          fazenda_destino_id: fazendasDestinoIds[0], // Legacy
          data_aspiracao: formData.data_aspiracao,
          horario_inicio: formData.horario_inicio || null,
          veterinario_responsavel: formData.veterinario_responsavel.trim(),
          tecnico_responsavel: formData.tecnico_responsavel.trim(),
          total_oocitos: totalOocitos,
          status: 'FINALIZADO',
        })
        .select()
        .single();

      if (pacoteError) throw pacoteError;

      // 3. Criar fazendas destino
      const fazendasDestinoData = fazendasDestinoIds.map(fazendaId => ({
        pacote_aspiracao_id: pacote.id,
        fazenda_destino_id: fazendaId,
      }));

      const { error: fazendasDestinoError } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .insert(fazendasDestinoData);

      if (fazendasDestinoError) throw fazendasDestinoError;

      // 4. Criar aspirações (doadoras)
      const aspiracoesData = doadoras.map(doadora => {
        const realDoadoraId = doadora.isNew
          ? doadoraIdMap.get(doadora.doadora_id)
          : doadora.doadora_id;

        return {
          pacote_aspiracao_id: pacote.id,
          doadora_id: realDoadoraId,
          fazenda_id: formData.fazenda_id,
          data_aspiracao: formData.data_aspiracao,
          horario_aspiracao: doadora.horario_aspiracao || null,
          hora_final: doadora.hora_final || null,
          atresicos: doadora.atresicos || 0,
          degenerados: doadora.degenerados || 0,
          expandidos: doadora.expandidos || 0,
          desnudos: doadora.desnudos || 0,
          viaveis: doadora.viaveis || 0,
          total_oocitos: doadora.total_oocitos || 0,
          veterinario_responsavel: formData.veterinario_responsavel.trim(),
          tecnico_responsavel: formData.tecnico_responsavel.trim(),
          recomendacao_touro: doadora.recomendacao_touro || null,
          observacoes: doadora.observacoes || null,
        };
      });

      const { error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .insert(aspiracoesData);

      if (aspiracoesError) throw aspiracoesError;

      // Limpar rascunho e resetar form
      limparRascunho();
      resetForm();

      toast({
        title: 'Aspiração finalizada',
        description: `${doadoras.length} doadora(s) com ${totalOocitos} oócitos registrados`,
      });

    } catch (error) {
      toast({
        title: 'Erro ao finalizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fazenda_id: '',
      data_aspiracao: new Date().toISOString().split('T')[0],
      horario_inicio: '',
      veterinario_responsavel: '',
      tecnico_responsavel: '',
    });
    setFazendasDestinoIds([]);
    setDoadoras([]);
    setCurrentStep('form');
  };

  // ========== FUNÇÕES MUDANÇA DE ABA ==========

  const handleTabChange = (newTab: string) => {
    if (temDadosNaoSalvos && newTab !== 'nova-sessao') {
      setPendingTabChange(newTab);
      setShowSairDialog(true);
    } else {
      setActiveTab(newTab as 'nova-sessao' | 'historico');
    }
  };

  const confirmSair = () => {
    setShowSairDialog(false);
    if (pendingTabChange) {
      setActiveTab(pendingTabChange as 'nova-sessao' | 'historico');
      setPendingTabChange(null);
    }
  };

  // ========== FUNÇÕES HISTÓRICO ==========

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar pacotes com limite para melhor performance
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .order('data_aspiracao', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (pacotesError) throw pacotesError;

      if (!pacotesData || pacotesData.length === 0) {
        setPacotes([]);
        setDadosCarregados(true);
        return;
      }

      const fazendasMap = new Map(fazendas.map((f) => [f.id, f.nome]));
      const pacoteIds = pacotesData.map((p) => p.id);

      // Executar queries em paralelo para melhor performance
      const [aspiracoesResult, fazendasDestinoResult] = await Promise.all([
        supabase
          .from('aspiracoes_doadoras')
          .select('pacote_aspiracao_id')
          .in('pacote_aspiracao_id', pacoteIds),
        supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .select('pacote_aspiracao_id, fazenda_destino_id')
          .in('pacote_aspiracao_id', pacoteIds),
      ]);

      const aspiracoesData = aspiracoesResult.data;
      const fazendasDestinoData = fazendasDestinoResult.data;

      const quantidadePorPacote = new Map<string, number>();
      aspiracoesData?.forEach((a) => {
        if (a.pacote_aspiracao_id) {
          quantidadePorPacote.set(
            a.pacote_aspiracao_id,
            (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1
          );
        }
      });

      const fazendasDestinoPorPacote = new Map<string, string[]>();
      fazendasDestinoData?.forEach((item) => {
        const nomes = fazendasDestinoPorPacote.get(item.pacote_aspiracao_id) || [];
        const nome = fazendasMap.get(item.fazenda_destino_id);
        if (nome && !nomes.includes(nome)) {
          nomes.push(nome);
        }
        fazendasDestinoPorPacote.set(item.pacote_aspiracao_id, nomes);
      });

      const pacotesComNomes: PacoteComNomes[] = pacotesData.map((p) => {
        let fazendasDestinoNomes = fazendasDestinoPorPacote.get(p.id);
        if (!fazendasDestinoNomes || fazendasDestinoNomes.length === 0) {
          if (p.fazenda_destino_id) {
            const nomeLegacy = fazendasMap.get(p.fazenda_destino_id);
            fazendasDestinoNomes = nomeLegacy ? [nomeLegacy] : [];
          } else {
            fazendasDestinoNomes = [];
          }
        }

        return {
          ...p,
          fazenda_nome: fazendasMap.get(p.fazenda_id),
          fazendas_destino_nomes: fazendasDestinoNomes,
          quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
        };
      });

      setPacotes(pacotesComNomes);
      setDadosCarregados(true);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [fazendas, toast]);

  const aplicarFiltros = useCallback(() => {
    if (pacotes.length === 0) return;

    let resultado = [...pacotes];

    if (filtroDataInicio && filtroDataFim) {
      resultado = resultado.filter((p) => {
        const dataPacote = p.data_aspiracao.split('T')[0];
        return dataPacote >= filtroDataInicio && dataPacote <= filtroDataFim;
      });
    }

    if (filtroFazenda) {
      resultado = resultado.filter((p) => p.fazenda_id === filtroFazenda);
    }

    // Filtro de busca por texto
    if (filtroBusca.trim()) {
      const termo = filtroBusca.toLowerCase().trim();
      resultado = resultado.filter((p) => {
        const fazendaNome = p.fazenda_nome?.toLowerCase() || '';
        const veterinario = p.veterinario_responsavel?.toLowerCase() || '';
        const tecnico = p.tecnico_responsavel?.toLowerCase() || '';
        const destinoNomes = p.fazendas_destino_nomes?.join(' ').toLowerCase() || '';
        return (
          fazendaNome.includes(termo) ||
          veterinario.includes(termo) ||
          tecnico.includes(termo) ||
          destinoNomes.includes(termo)
        );
      });
    }

    setPacotesFiltrados(resultado);
    setPaginaAtual(1); // Reset para primeira página ao filtrar
  }, [pacotes, filtroDataInicio, filtroDataFim, filtroFazenda, filtroBusca]);

  const handleBuscar = () => {
    if (!filtroDataInicio || !filtroDataFim) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha a data inicial e a data final',
        variant: 'destructive',
      });
      return;
    }

    if (filtroDataInicio > filtroDataFim) {
      toast({
        title: 'Data inválida',
        description: 'A data inicial deve ser anterior ou igual à data final',
        variant: 'destructive',
      });
      return;
    }

    if (!dadosCarregados) {
      loadData();
    } else {
      aplicarFiltros();
    }
  };

  useEffect(() => {
    if (pacotes.length > 0 && filtroDataInicio && filtroDataFim && dadosCarregados) {
      aplicarFiltros();
    }
  }, [pacotes, filtroDataInicio, filtroDataFim, filtroBusca, dadosCarregados, aplicarFiltros]);

  // Carregar dados do histórico automaticamente quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'historico' && !dadosCarregados && !loading && fazendas.length > 0) {
      // Definir datas padrão (últimos 30 dias) se não estiverem definidas
      if (!filtroDataInicio || !filtroDataFim) {
        const hoje = new Date();
        const dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 30);
        setFiltroDataInicio(dataInicio.toISOString().split('T')[0]);
        setFiltroDataFim(hoje.toISOString().split('T')[0]);
      }
      loadData();
    }
  }, [activeTab, dadosCarregados, loading, fazendas.length, filtroDataInicio, filtroDataFim, loadData]);

  // ========== HELPERS ==========

  const getFazendaNome = (id: string) => fazendas.find(f => f.id === id)?.nome || '';

  // ========== RENDER ==========

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aspirações"
        description="Gerenciar aspirações foliculares"
      />

      {/* ==================== SESSÃO DE ASPIRAÇÃO ==================== */}
      <div className="mt-4 space-y-4">
          {/* Barra Superior Premium */}
          <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
              {/* Grupo: Responsáveis */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-1 h-6 rounded-full bg-primary/40 self-center hidden md:block" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center w-full md:w-auto">
                  <User className="w-3.5 h-3.5" />
                  <span>Responsáveis</span>
                </div>
                <div className="w-[calc(50%-0.375rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Veterinário *
                  </label>
                  <Input
                    placeholder="Nome do veterinário"
                    value={formData.veterinario_responsavel}
                    onChange={(e) => setFormData({ ...formData, veterinario_responsavel: e.target.value })}
                    className="h-11 md:h-9"
                    disabled={currentStep === 'doadoras'}
                  />
                </div>
                <div className="w-[calc(50%-0.375rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Técnico *
                  </label>
                  <Input
                    placeholder="Nome do técnico"
                    value={formData.tecnico_responsavel}
                    onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                    className="h-11 md:h-9"
                    disabled={currentStep === 'doadoras'}
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="h-10 w-px bg-border hidden md:block" />

              {/* Grupo: Local */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center hidden md:block" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center w-full md:w-auto">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Local</span>
                </div>
                <div className="w-full md:w-auto md:flex-1 md:min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Fazenda *
                  </label>
                  <Select
                    value={formData.fazenda_id}
                    onValueChange={(value) => setFormData({ ...formData, fazenda_id: value })}
                    disabled={currentStep === 'doadoras'}
                  >
                    <SelectTrigger className="h-11 md:h-9">
                      <SelectValue placeholder="Selecione a fazenda" />
                    </SelectTrigger>
                    <SelectContent>
                      {fazendas.map((fazenda) => (
                        <SelectItem key={fazenda.id} value={fazenda.id}>
                          {fazenda.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[calc(50%-0.375rem)] md:w-[130px] flex-shrink-0">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Data *
                  </label>
                  <DatePickerBR
                    value={formData.data_aspiracao}
                    onChange={(value) => setFormData({ ...formData, data_aspiracao: value || '' })}
                    className="h-11 md:h-9"
                    disabled={currentStep === 'doadoras'}
                  />
                </div>
                <div className="w-[calc(50%-0.375rem)] md:w-[90px] flex-shrink-0">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Hora
                  </label>
                  <Input
                    type="time"
                    value={formData.horario_inicio}
                    onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                    className="h-11 md:h-9"
                    disabled={currentStep === 'doadoras'}
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="h-10 w-px bg-border hidden md:block" />

              {/* Grupo: Ação */}
              <div className="flex items-end gap-3 w-full md:w-auto md:ml-auto">
                {currentStep === 'form' ? (
                  <Button
                    onClick={handleContinuar}
                    disabled={!formData.veterinario_responsavel || !formData.tecnico_responsavel || !formData.fazenda_id || !formData.data_aspiracao}
                    className="h-11 md:h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm w-full md:w-auto"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Continuar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleVoltar}
                    className="h-11 md:h-9 w-full md:w-auto"
                  >
                    Voltar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Área de Doadoras (após Continuar) */}
          {currentStep === 'doadoras' && (
            <>
              {/* Info + Fazendas Destino */}
              <div className="rounded-xl border border-border bg-gradient-to-r from-primary/5 to-transparent p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Informações da Sessão */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-0.5">
                        Fazenda Origem
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        {getFazendaNome(formData.fazenda_id)}
                      </span>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-0.5">
                        Data
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        {formatDate(formData.data_aspiracao)}
                      </span>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-0.5">
                        Veterinário
                      </span>
                      <span className="font-medium text-sm text-foreground truncate block">
                        {formData.veterinario_responsavel}
                      </span>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-0.5">
                        Técnico
                      </span>
                      <span className="font-medium text-sm text-foreground truncate block">
                        {formData.tecnico_responsavel}
                      </span>
                    </div>
                  </div>

                  {/* Total de Oócitos */}
                  <div className="flex items-center justify-center sm:justify-end">
                    <div className="bg-primary text-primary-foreground rounded-xl px-5 py-3 text-center min-w-[100px]">
                      <span className="text-2xl font-bold block">{totalOocitos}</span>
                      <span className="text-[10px] uppercase tracking-wide opacity-90">oócitos</span>
                    </div>
                  </div>
                </div>

                {/* Fazendas Destino */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
                      Destino:
                    </span>

                    {fazendasDestinoIds.map((fazendaId) => (
                      <Badge
                        key={fazendaId}
                        variant="secondary"
                        className="h-7 pl-3 pr-1.5 gap-1.5 bg-card border border-border hover:border-primary/50 transition-colors"
                      >
                        <span className="font-medium">{getFazendaNome(fazendaId)}</span>
                        <button
                          type="button"
                          onClick={() => setFazendasDestinoIds(prev => prev.filter(id => id !== fazendaId))}
                          className="hover:bg-destructive/10 hover:text-destructive rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}

                    <Popover open={destinoPopoverOpen} onOpenChange={setDestinoPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 text-xs border-dashed ${
                            fazendasDestinoIds.length === 0
                              ? 'border-primary text-primary bg-primary/10 hover:bg-primary/20'
                              : 'border-border hover:border-primary hover:text-primary'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {fazendasDestinoIds.length === 0 ? 'Adicionar Destino *' : 'Adicionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Buscar fazenda..."
                            value={buscaFazendaDestino}
                            onValueChange={setBuscaFazendaDestino}
                          />
                          <CommandList>
                            {!buscaDestinoAtiva ? (
                              <CommandEmpty>Digite pelo menos 2 letras</CommandEmpty>
                            ) : loadingDestino ? (
                              <div className="p-2 text-sm text-muted-foreground">Buscando...</div>
                            ) : fazendasDestinoFiltradas.length === 0 ? (
                              <CommandEmpty>Nenhuma encontrada</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {fazendasDestinoFiltradas.map((fazenda) => (
                                  <CommandItem
                                    key={fazenda.id}
                                    value={`${fazenda.nome} ${fazenda.id}`}
                                    onSelect={() => {
                                      setFazendasDestinoIds(prev => [...prev, fazenda.id]);
                                      setBuscaFazendaDestino('');
                                      setDestinoPopoverOpen(false);
                                    }}
                                  >
                                    {fazenda.nome}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Doadoras */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Doadoras ({doadoras.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setShowAddDoadoraDialog(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowCreateDoadoraDialog(true)}>
                        <UserPlus className="w-4 h-4 mr-1" />
                        Nova
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {doadoras.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma doadora adicionada. Clique em "Adicionar" ou "Nova" para começar.
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Cards */}
                      <div className="md:hidden space-y-3">
                        {doadoras.map((doadora, index) => (
                          <div
                            key={doadora.doadora_id}
                            className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5 active:bg-muted/50 cursor-pointer"
                            onClick={() => setEditingMobileIndex(index)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-base truncate block">
                                    {doadora.nome || doadora.registro}
                                  </span>
                                  {doadora.nome && (
                                    <span className="text-xs text-muted-foreground">{doadora.registro}</span>
                                  )}
                                </div>
                                {doadora.raca && (
                                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                    {doadora.raca}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <div className="text-center">
                                  <span className="text-lg font-bold text-primary block leading-none">{doadora.total_oocitos || 0}</span>
                                  <span className="text-[9px] text-muted-foreground uppercase">oóc.</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveDoadora(index); }}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {/* Mini summary row */}
                            {doadora.total_oocitos > 0 && (
                              <div className="flex gap-2 mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                                {doadora.atresicos > 0 && <span>A:{doadora.atresicos}</span>}
                                {doadora.degenerados > 0 && <span>D:{doadora.degenerados}</span>}
                                {doadora.expandidos > 0 && <span>E:{doadora.expandidos}</span>}
                                {doadora.desnudos > 0 && <span>Dn:{doadora.desnudos}</span>}
                                {doadora.viaveis > 0 && <span className="text-primary font-medium">V:{doadora.viaveis}</span>}
                                {doadora.recomendacao_touro && <span className="ml-auto truncate max-w-[100px]">Touro: {doadora.recomendacao_touro}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Desktop: Tabela Grid */}
                      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                        {/* Cabeçalho da tabela */}
                        <div className="grid grid-cols-[minmax(140px,1fr)_80px_80px_repeat(5,40px)_45px_1fr_1fr_32px] gap-0 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          <div className="px-3 py-2">Doadora</div>
                          <div className="px-2 py-2 text-center">Início</div>
                          <div className="px-2 py-2 text-center">Fim</div>
                          <div className="px-1 py-2 text-center">Atr</div>
                          <div className="px-1 py-2 text-center">Deg</div>
                          <div className="px-1 py-2 text-center">Exp</div>
                          <div className="px-1 py-2 text-center">Des</div>
                          <div className="px-1 py-2 text-center text-primary">Viáv</div>
                          <div className="px-1 py-2 text-center text-primary font-bold">Total</div>
                          <div className="px-2 py-2">Touro</div>
                          <div className="px-2 py-2">Obs</div>
                          <div></div>
                        </div>
                        {/* Linhas */}
                        {doadoras.map((doadora, index) => (
                          <div
                            key={doadora.doadora_id}
                            className="group grid grid-cols-[minmax(140px,1fr)_80px_80px_repeat(5,40px)_45px_1fr_1fr_32px] gap-0 items-center border-t border-border hover:bg-muted/50"
                          >
                            {/* Doadora */}
                            <div className="flex items-center gap-2 px-3 py-1.5">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-sm truncate">
                                    {doadora.nome || doadora.registro}
                                  </span>
                                  {doadora.raca && (
                                    <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded shrink-0">
                                      {doadora.raca}
                                    </span>
                                  )}
                                  {doadora.isNew && (
                                    <span className="text-[9px] text-primary bg-primary/10 px-1 rounded shrink-0">N</span>
                                  )}
                                </div>
                                {doadora.nome && (
                                  <span className="text-[10px] text-muted-foreground block truncate">{doadora.registro}</span>
                                )}
                              </div>
                            </div>
                            {/* Início */}
                            <div className="px-1 py-1">
                              <Input
                                type="time"
                                value={doadora.horario_aspiracao || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'horario_aspiracao', e.target.value)}
                                className="h-7 text-xs text-center px-1 w-full"
                                disabled={index === 0}
                              />
                            </div>
                            {/* Fim */}
                            <div className="px-1 py-1">
                              <Input
                                type="time"
                                value={doadora.hora_final || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'hora_final', e.target.value)}
                                className="h-7 text-xs text-center px-1 w-full"
                              />
                            </div>
                            {/* Oócitos */}
                            <div className="px-0.5 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={doadora.atresicos || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'atresicos', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs text-center px-0 w-full"
                                placeholder="0"
                              />
                            </div>
                            <div className="px-0.5 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={doadora.degenerados || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'degenerados', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs text-center px-0 w-full"
                                placeholder="0"
                              />
                            </div>
                            <div className="px-0.5 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={doadora.expandidos || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'expandidos', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs text-center px-0 w-full"
                                placeholder="0"
                              />
                            </div>
                            <div className="px-0.5 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={doadora.desnudos || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'desnudos', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs text-center px-0 w-full"
                                placeholder="0"
                              />
                            </div>
                            <div className="px-0.5 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={doadora.viaveis || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'viaveis', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs text-center px-0 w-full ring-1 ring-primary/20"
                                placeholder="0"
                              />
                            </div>
                            {/* Total */}
                            <div className="px-1 py-1 text-center">
                              <span className="text-sm font-bold text-primary">{doadora.total_oocitos || 0}</span>
                            </div>
                            {/* Touro */}
                            <div className="px-1 py-1">
                              <Input
                                value={doadora.recomendacao_touro || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'recomendacao_touro', e.target.value)}
                                className="h-7 text-xs px-2 w-full"
                                placeholder="Touro"
                              />
                            </div>
                            {/* Obs */}
                            <div className="px-1 py-1">
                              <Input
                                value={doadora.observacoes || ''}
                                onChange={(e) => handleUpdateDoadora(index, 'observacoes', e.target.value)}
                                className="h-7 text-xs px-2 w-full"
                                placeholder="Obs"
                              />
                            </div>
                            {/* Remover */}
                            <div className="px-1 py-1 flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveDoadora(index)}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Botão Finalizar */}
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={handleFinalizar}
                      disabled={!canFinalizar || submitting}
                      className="bg-primary hover:bg-primary-dark"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {submitting ? 'Finalizando...' : 'Finalizar Aspiração'}
                    </Button>
                  </div>

                  {!canFinalizar && (
                    <p className="text-xs text-destructive text-right mt-2">
                      {fazendasDestinoIds.length === 0 && doadoras.length === 0
                        ? 'Adicione fazenda destino e pelo menos uma doadora'
                        : fazendasDestinoIds.length === 0
                        ? 'Adicione pelo menos uma fazenda destino'
                        : 'Adicione pelo menos uma doadora'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

      {/* ==================== DIALOGS ==================== */}

      {/* Dialog Restaurar Rascunho */}
      <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Aspiração não finalizada encontrada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem uma aspiração em andamento que não foi finalizada. Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={descartarRascunho}>Descartar</AlertDialogCancel>
            <AlertDialogAction onClick={restaurarRascunho}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Confirmar Sair */}
      <AlertDialog open={showSairDialog} onOpenChange={setShowSairDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aspiração em andamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem {doadoras.length} doadora(s) adicionada(s) que não foram salvas.
              Os dados ficarão salvos localmente e você poderá continuar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar Editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSair}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Adicionar Doadora Existente */}
      <Dialog open={showAddDoadoraDialog} onOpenChange={setShowAddDoadoraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Doadora</DialogTitle>
            <DialogDescription>Selecione uma doadora da fazenda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Doadora *</Label>
              <Select value={selectedDoadoraId} onValueChange={setSelectedDoadoraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma doadora" />
                </SelectTrigger>
                <SelectContent>
                  {loadingDoadoras ? (
                    <div className="p-2 text-sm text-muted-foreground">Carregando...</div>
                  ) : doadorasDisponiveis.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">Nenhuma doadora disponível</div>
                  ) : (
                    doadorasDisponiveis.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.registro} {d.nome ? `- ${d.nome}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddDoadora} className="w-full" disabled={!selectedDoadoraId}>
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Doadora Mobile */}
      <Dialog open={editingMobileIndex !== null} onOpenChange={(open) => { if (!open) setEditingMobileIndex(null); }}>
        <DialogContent className="max-w-md">
          {editingMobileIndex !== null && doadoras[editingMobileIndex] && (() => {
            const doadora = doadoras[editingMobileIndex];
            const idx = editingMobileIndex;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    {doadora.nome || doadora.registro}
                    {doadora.raca && (
                      <span className="text-xs text-muted-foreground font-normal">({doadora.raca})</span>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    {doadora.nome ? doadora.registro : 'Editar dados da aspiração'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Horários */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                        Início
                      </label>
                      <Input
                        type="time"
                        value={doadora.horario_aspiracao || ''}
                        onChange={(e) => handleUpdateDoadora(idx, 'horario_aspiracao', e.target.value)}
                        className="h-11"
                        disabled={idx === 0}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                        Fim
                      </label>
                      <Input
                        type="time"
                        value={doadora.hora_final || ''}
                        onChange={(e) => handleUpdateDoadora(idx, 'hora_final', e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* Oócitos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Oócitos
                      </label>
                      <span className="text-sm font-bold text-primary">Total: {doadora.total_oocitos || 0}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block text-center mb-1">Atr</label>
                        <Input
                          type="number"
                          min="0"
                          value={doadora.atresicos || ''}
                          onChange={(e) => handleUpdateDoadora(idx, 'atresicos', parseInt(e.target.value) || 0)}
                          className="h-11 text-center px-1"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block text-center mb-1">Deg</label>
                        <Input
                          type="number"
                          min="0"
                          value={doadora.degenerados || ''}
                          onChange={(e) => handleUpdateDoadora(idx, 'degenerados', parseInt(e.target.value) || 0)}
                          className="h-11 text-center px-1"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block text-center mb-1">Exp</label>
                        <Input
                          type="number"
                          min="0"
                          value={doadora.expandidos || ''}
                          onChange={(e) => handleUpdateDoadora(idx, 'expandidos', parseInt(e.target.value) || 0)}
                          className="h-11 text-center px-1"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block text-center mb-1">Des</label>
                        <Input
                          type="number"
                          min="0"
                          value={doadora.desnudos || ''}
                          onChange={(e) => handleUpdateDoadora(idx, 'desnudos', parseInt(e.target.value) || 0)}
                          className="h-11 text-center px-1"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-primary font-medium block text-center mb-1">Viáv</label>
                        <Input
                          type="number"
                          min="0"
                          value={doadora.viaveis || ''}
                          onChange={(e) => handleUpdateDoadora(idx, 'viaveis', parseInt(e.target.value) || 0)}
                          className="h-11 text-center px-1 ring-1 ring-primary/20"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Touro e Obs */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                      Touro Recomendado
                    </label>
                    <Input
                      value={doadora.recomendacao_touro || ''}
                      onChange={(e) => handleUpdateDoadora(idx, 'recomendacao_touro', e.target.value)}
                      className="h-11"
                      placeholder="Nome do touro"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                      Observações
                    </label>
                    <Input
                      value={doadora.observacoes || ''}
                      onChange={(e) => handleUpdateDoadora(idx, 'observacoes', e.target.value)}
                      className="h-11"
                      placeholder="Observações"
                    />
                  </div>

                  <Button onClick={() => setEditingMobileIndex(null)} className="w-full h-11 bg-primary hover:bg-primary-dark">
                    Concluído
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Nova Doadora */}
      <Dialog open={showCreateDoadoraDialog} onOpenChange={setShowCreateDoadoraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Nova Doadora</DialogTitle>
            <DialogDescription>Preencha os dados da nova doadora</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Registro *</Label>
              <Input
                value={createDoadoraForm.registro}
                onChange={(e) => setCreateDoadoraForm({ ...createDoadoraForm, registro: e.target.value })}
                placeholder="Número do registro"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={createDoadoraForm.nome}
                onChange={(e) => setCreateDoadoraForm({ ...createDoadoraForm, nome: e.target.value })}
                placeholder="Nome da doadora (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Raça</Label>
              <Select
                value={createDoadoraForm.raca}
                onValueChange={(value) => setCreateDoadoraForm({ ...createDoadoraForm, raca: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a raça" />
                </SelectTrigger>
                <SelectContent>
                  {racasPredefinidas.map((raca) => (
                    <SelectItem key={raca} value={raca}>{raca}</SelectItem>
                  ))}
                  <SelectItem value="Outra">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createDoadoraForm.raca === 'Outra' && (
              <div className="space-y-2">
                <Label>Raça Customizada *</Label>
                <Input
                  value={createDoadoraForm.racaCustom}
                  onChange={(e) => setCreateDoadoraForm({ ...createDoadoraForm, racaCustom: e.target.value })}
                  placeholder="Digite a raça"
                />
              </div>
            )}
            <Button onClick={handleCreateDoadora} className="w-full" disabled={!createDoadoraForm.registro}>
              <UserPlus className="w-4 h-4 mr-2" />
              Criar e Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
