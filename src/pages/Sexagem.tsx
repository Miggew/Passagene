import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { DiagnosticoGestacaoInsert, DiagnosticoGestacaoUpdate } from '@/lib/types';
import { buscarDadosGenealogia, buscarLotesFIV, extrairAcasalamentoIds, extrairLoteIds, calcularDiasGestacao } from '@/lib/dataEnrichment';
import { todayISO } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import DatePickerBR from '@/components/shared/DatePickerBR';
import {
  type LoteTESexagem,
  type EmbriaoTransferido,
  type LoteFormDataBase,
  validarResponsaveis,
  DIAS_MINIMOS,
} from '@/lib/gestacao';
import { useFazendasComLotes, useLotesTE } from '@/hooks/loteTE';
import { DataTable } from '@/components/shared/DataTable';
import {
  Baby,
  Clock,
  Search,
  CalendarDays,
  Users,
  TrendingDown,
  Save,
  AlertTriangle,
  Eye,
  X,
  User,
  MapPin,
} from 'lucide-react';
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

interface ReceptoraPrenhe {
  receptora_id: string;
  brinco: string;
  nome?: string;
  data_te: string;
  embrioes: EmbriaoTransferido[];
  data_abertura_lote: string;
  dias_gestacao: number;
  numero_gestacoes: number;
  diagnostico_existente?: {
    id: string;
    data_diagnostico: string;
    resultado: string;
    numero_gestacoes?: number;
    observacoes?: string;
  };
}

interface SexagemFormData {
  [receptora_id: string]: {
    data_sexagem: string;
    sexagens: string[];
    observacoes: string;
  };
}

type ResultadoSexagem = 'FEMEA' | 'MACHO' | 'SEM_SEXO' | 'VAZIA';

interface HistoricoSexagem {
  id: string;
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome?: string;
  fazenda_nome: string;
  fazenda_id?: string;
  data_te: string;
  data_diagnostico: string;
  resultado: string;
  sexagem?: string;
  numero_gestacoes?: number;
  observacoes?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  data_provavel_parto?: string;
}

interface SessaoSexagem {
  id: string;
  fazenda_nome: string;
  fazenda_id: string;
  data_te: string;
  data_sexagem: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  total_receptoras: number;
  femeas: number;
  machos: number;
  sem_sexo: number;
  vazias: number;
  receptoras: HistoricoSexagem[];
}

// Configuração de rascunho
const RASCUNHO_KEY = 'passagene_sexagem_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

interface RascunhoSexagem {
  fazenda_id: string;
  lote_id: string;
  lote_data_te: string;
  formData: SexagemFormData;
  loteFormData: LoteFormDataBase;
  timestamp: number;
}

export default function Sexagem() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const hoje = todayISO();

  // State - Nova Sessão
  const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
  const [loteSelecionado, setLoteSelecionado] = useState<LoteTESexagem | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraPrenhe[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<SexagemFormData>({});
  const [loteFormData, setLoteFormData] = useState<LoteFormDataBase>({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // State - Histórico
  const [sessoes, setSessoes] = useState<SessaoSexagem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [filtroFazenda, setFiltroFazenda] = useState<string>('todos');
  const [filtroSexagem, setFiltroSexagem] = useState<string>('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDataTipo, setFiltroDataTipo] = useState<'data_sexagem' | 'data_parto'>('data_sexagem');
  const [todasFazendas, setTodasFazendas] = useState<{id: string; nome: string}[]>([]);

  // Paginação do histórico
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const ITENS_POR_PAGINA_HISTORICO = 15;

  // Estado para dialog de sessão em andamento
  const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);

  // Hooks compartilhados
  const { fazendas, loadFazendas } = useFazendasComLotes({
    statusReceptoraFiltro: ['PRENHE', 'PRENHE_RETOQUE'],
  });

  const transformLote = useCallback((
    loteBase: { id: string; fazenda_id: string; fazenda_nome: string; data_te: string; quantidade_receptoras: number; status: 'ABERTO' | 'FECHADO' },
    diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
  ): LoteTESexagem => ({
    ...loteBase,
    veterinario_sexagem: diagnosticoLote?.veterinario_responsavel,
    tecnico_sexagem: diagnosticoLote?.tecnico_responsavel,
  }), []);

  const { lotesTE, loading: loadingLotes, loadLotesTE } = useLotesTE<LoteTESexagem>({
    statusReceptoraFiltro: ['PRENHE', 'PRENHE_RETOQUE'],
    transformLote,
  });

  // ========== FUNÇÕES DE RASCUNHO ==========

  const getRascunho = (): RascunhoSexagem | null => {
    try {
      const raw = localStorage.getItem(RASCUNHO_KEY);
      if (!raw) return null;

      const rascunho: RascunhoSexagem = JSON.parse(raw);

      // Verificar expiração
      const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
      if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
        localStorage.removeItem(RASCUNHO_KEY);
        return null;
      }

      // Verificar se tem dados preenchidos
      const temDados = Object.keys(rascunho.formData).length > 0;
      if (!temDados) {
        localStorage.removeItem(RASCUNHO_KEY);
        return null;
      }

      return rascunho;
    } catch {
      return null;
    }
  };

  const salvarRascunho = useCallback(() => {
    if (!loteSelecionado || Object.keys(formData).length === 0) return;

    // Verificar se há dados modificados
    const temDadosPreenchidos = Object.values(formData).some(
      dados => dados.sexagens.some(s => s !== '') || dados.observacoes
    );
    if (!temDadosPreenchidos) return;

    const rascunho: RascunhoSexagem = {
      fazenda_id: fazendaSelecionada,
      lote_id: loteSelecionado.id,
      lote_data_te: loteSelecionado.data_te,
      formData,
      loteFormData,
      timestamp: Date.now(),
    };
    localStorage.setItem(RASCUNHO_KEY, JSON.stringify(rascunho));
  }, [fazendaSelecionada, loteSelecionado, formData, loteFormData]);

  const limparRascunho = () => {
    localStorage.removeItem(RASCUNHO_KEY);
  };

  const restaurarRascunho = async () => {
    const rascunho = getRascunho();
    if (rascunho) {
      setFazendaSelecionada(rascunho.fazenda_id);
      setLoteFormData(rascunho.loteFormData);
      // formData será restaurado quando as receptoras forem carregadas
      sessionStorage.setItem('sexagem_formdata_restore', JSON.stringify(rascunho.formData));
      toast({
        title: 'Sessão restaurada',
        description: 'Continuando a sexagem de onde você parou.',
      });
    }
    setShowRestaurarDialog(false);
  };

  const descartarRascunho = () => {
    limparRascunho();
    sessionStorage.removeItem('sexagem_formdata_restore');
    setShowRestaurarDialog(false);
  };

  // Effects
  useEffect(() => {
    // Verificar rascunho ao montar
    const rascunho = getRascunho();
    if (rascunho) {
      setShowRestaurarDialog(true);
    }
  }, []);

  useEffect(() => {
    // Salvar rascunho automaticamente quando há mudanças
    salvarRascunho();
  }, [salvarRascunho]);

  useEffect(() => {
    // Restaurar formData quando as receptoras forem carregadas
    const formDataRestore = sessionStorage.getItem('sexagem_formdata_restore');
    if (formDataRestore && receptoras.length > 0) {
      try {
        const savedFormData = JSON.parse(formDataRestore);
        // Só restaura dados para receptoras que ainda existem
        const restoredFormData: SexagemFormData = {};
        receptoras.forEach(r => {
          if (savedFormData[r.receptora_id]) {
            restoredFormData[r.receptora_id] = savedFormData[r.receptora_id];
          } else {
            restoredFormData[r.receptora_id] = {
              data_sexagem: hoje,
              sexagens: Array(r.numero_gestacoes).fill(''),
              observacoes: '',
            };
          }
        });
        setFormData(restoredFormData);
        sessionStorage.removeItem('sexagem_formdata_restore');
      } catch {
        sessionStorage.removeItem('sexagem_formdata_restore');
      }
    }
  }, [receptoras, hoje]);

  useEffect(() => {
    loadFazendas();
    loadTodasFazendas();
  }, [loadFazendas]);

  useEffect(() => {
    if (fazendaSelecionada) {
      const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
      loadLotesTE(fazendaSelecionada, fazendaNome);
    } else {
      setLoteSelecionado(null);
      setReceptoras([]);
      setFormData({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fazendaSelecionada]);

  useEffect(() => {
    if (loteSelecionado) {
      // Se o lote tem vet/tec salvos, usa esses valores
      if (loteSelecionado.veterinario_sexagem || loteSelecionado.tecnico_sexagem) {
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_sexagem || loteFormData.veterinario_responsavel,
          tecnico_responsavel: loteSelecionado.tecnico_sexagem || loteFormData.tecnico_responsavel,
        });
      }
      // Se não tem, mantém os valores que o usuário já digitou (não reseta)

      // Sempre carrega as receptoras quando seleciona um lote
      loadReceptorasLote(loteSelecionado);
    } else {
      setReceptoras([]);
      setFormData({});
    }
  }, [loteSelecionado]);

  const loadTodasFazendas = async () => {
    const { data } = await supabase
      .from('fazendas')
      .select('id, nome')
      .order('nome');
    setTodasFazendas(data || []);
  };

  const loadHistorico = async () => {
    try {
      setLoadingHistorico(true);
      setPaginaHistorico(1);

      // 1. Buscar diagnósticos de SEXAGEM
      let query = supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .eq('tipo_diagnostico', 'SEXAGEM')
        .order('data_diagnostico', { ascending: false })
        .limit(1000);

      // Filtro de data por sexagem é aplicado na query
      if (filtroDataTipo === 'data_sexagem') {
        if (filtroDataInicio) {
          query = query.gte('data_diagnostico', filtroDataInicio);
        }
        if (filtroDataFim) {
          query = query.lte('data_diagnostico', filtroDataFim);
        }
      }
      // Filtro por data_parto será aplicado client-side após obter dados das receptoras

      if (filtroSexagem && filtroSexagem !== 'todos') {
        query = query.eq('sexagem', filtroSexagem);
      }

      const { data: diagnosticosData, error: diagnosticosError } = await query;

      if (diagnosticosError) {
        console.error('Erro ao buscar diagnósticos:', diagnosticosError);
        throw new Error(diagnosticosError.message || 'Erro ao buscar diagnósticos');
      }

      if (!diagnosticosData || diagnosticosData.length === 0) {
        setSessoes([]);
        return;
      }

      // 2. Buscar receptoras relacionadas (incluindo data_provavel_parto)
      const receptoraIds = [...new Set(diagnosticosData.map(dg => dg.receptora_id).filter(Boolean))];

      const { data: receptorasData, error: receptorasError } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, data_provavel_parto')
        .in('id', receptoraIds);

      if (receptorasError) {
        console.error('Erro ao buscar receptoras:', receptorasError);
        throw new Error(receptorasError.message || 'Erro ao buscar receptoras');
      }

      const receptorasMap = new Map(
        (receptorasData || []).map(r => [r.id, r])
      );

      // 3. Buscar fazenda atual das receptoras via view
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
        .in('receptora_id', receptoraIds);

      if (viewError) {
        console.error('Erro ao buscar view receptoras:', viewError);
      }

      const fazendaMap = new Map<string, { id: string; nome: string }>(
        (viewData || []).map(v => [v.receptora_id, { id: v.fazenda_id_atual, nome: v.fazenda_nome_atual }])
      );

      // 4. Montar histórico formatado e agrupar por sessão
      const historicoFormatado: HistoricoSexagem[] = diagnosticosData
        .map(dg => {
          const receptora = receptorasMap.get(dg.receptora_id);
          const fazendaInfo = fazendaMap.get(dg.receptora_id);
          return {
            id: dg.id,
            receptora_id: dg.receptora_id,
            receptora_brinco: receptora?.identificacao || '-',
            receptora_nome: receptora?.nome,
            fazenda_nome: fazendaInfo?.nome || '-',
            fazenda_id: fazendaInfo?.id,
            data_te: dg.data_te,
            data_diagnostico: dg.data_diagnostico,
            resultado: dg.resultado,
            sexagem: dg.sexagem,
            numero_gestacoes: dg.numero_gestacoes,
            observacoes: dg.observacoes,
            veterinario_responsavel: dg.veterinario_responsavel,
            tecnico_responsavel: dg.tecnico_responsavel,
            data_provavel_parto: receptora?.data_provavel_parto || undefined,
          };
        });

      // Filtro de data por parto é aplicado client-side
      let historicoFiltrado = historicoFormatado;
      if (filtroDataTipo === 'data_parto') {
        historicoFiltrado = historicoFormatado.filter(h => {
          if (!h.data_provavel_parto) return false;
          if (filtroDataInicio && h.data_provavel_parto < filtroDataInicio) return false;
          if (filtroDataFim && h.data_provavel_parto > filtroDataFim) return false;
          return true;
        });
      }

      // 5. Agrupar por sessão (fazenda + data_te + data_sexagem + veterinário)
      const sessoesMap = new Map<string, SessaoSexagem>();

      historicoFiltrado.forEach(h => {
        const chave = `${h.fazenda_nome}|${h.data_te}|${h.data_diagnostico}|${h.veterinario_responsavel || ''}`;

        if (!sessoesMap.has(chave)) {
          sessoesMap.set(chave, {
            id: chave,
            fazenda_nome: h.fazenda_nome,
            fazenda_id: h.fazenda_id || '',
            data_te: h.data_te,
            data_sexagem: h.data_diagnostico,
            veterinario_responsavel: h.veterinario_responsavel,
            tecnico_responsavel: h.tecnico_responsavel,
            total_receptoras: 0,
            femeas: 0,
            machos: 0,
            sem_sexo: 0,
            vazias: 0,
            receptoras: [],
          });
        }

        const sessao = sessoesMap.get(chave)!;
        sessao.receptoras.push(h);
        sessao.total_receptoras++;

        if (h.sexagem === 'FEMEA') sessao.femeas++;
        else if (h.sexagem === 'MACHO') sessao.machos++;
        else if (h.resultado === 'VAZIA') sessao.vazias++;
        else sessao.sem_sexo++;
      });

      // Ordenar por data de sexagem (mais recente primeiro)
      const sessoesArray = Array.from(sessoesMap.values()).sort((a, b) =>
        b.data_sexagem.localeCompare(a.data_sexagem)
      );

      setSessoes(sessoesArray);
    } catch (error) {
      console.error('Erro no loadHistorico:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar histórico',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingHistorico(false);
    }
  };

  const loadReceptorasLote = async (lote: LoteTESexagem) => {
    try {
      setLoading(true);

      const { data: viewData } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', lote.fazenda_id);

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      // Filtrar apenas receptoras PRENHE ou PRENHE_RETOQUE (que ainda não fizeram sexagem)
      const { data: receptorasData } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, status_reprodutivo')
        .in('id', receptoraIds)
        .in('status_reprodutivo', ['PRENHE', 'PRENHE_RETOQUE']);

      const prenhesIds = receptorasData?.map(r => r.id) || [];

      if (prenhesIds.length === 0) {
        setReceptoras([]);
        return;
      }

      // Executar queries em paralelo
      const [teResult, diagnosticosResult, sexagensResult] = await Promise.all([
        supabase
          .from('transferencias_embrioes')
          .select('id, receptora_id, embriao_id, data_te')
          .in('receptora_id', prenhesIds)
          .eq('data_te', lote.data_te)
          .eq('status_te', 'REALIZADA'),
        supabase
          .from('diagnosticos_gestacao')
          .select('*')
          .in('receptora_id', prenhesIds)
          .eq('tipo_diagnostico', 'DG')
          .eq('data_te', lote.data_te)
          .order('data_diagnostico', { ascending: false }),
        supabase
          .from('diagnosticos_gestacao')
          .select('*')
          .in('receptora_id', prenhesIds)
          .eq('tipo_diagnostico', 'SEXAGEM')
          .eq('data_te', lote.data_te)
          .order('data_diagnostico', { ascending: false }),
      ]);

      const teData = teResult.data;
      const diagnosticosData = diagnosticosResult.data;
      const sexagensData = sexagensResult.data;

      if (!teData || teData.length === 0) {
        setReceptoras([]);
        return;
      }

      const embriaoIds = teData.map(t => t.embriao_id).filter(Boolean);
      let embrioesMap = new Map();

      if (embriaoIds.length > 0) {
        const { data: embrioesData } = await supabase
          .from('embrioes')
          .select('id, identificacao, classificacao, lote_fiv_id, lote_fiv_acasalamento_id')
          .in('id', embriaoIds);

        if (embrioesData) {
          embrioesMap = new Map(embrioesData.map(e => [e.id, e]));
        }
      }

      // Buscar lotes FIV e dados de genealogia em paralelo
      const embrioesList = Array.from(embrioesMap.values());
      const loteIds = extrairLoteIds(embrioesList);
      const acasalamentoIds = extrairAcasalamentoIds(embrioesList);

      const [lotesMap, genealogiaResult] = await Promise.all([
        buscarLotesFIV(loteIds),
        buscarDadosGenealogia(acasalamentoIds),
      ]);

      const { doadorasMap, tourosMap } = genealogiaResult;

      const diagnosticosPorReceptora = new Map<string, typeof diagnosticosData[0]>();
      diagnosticosData?.forEach(dg => {
        if (!diagnosticosPorReceptora.has(dg.receptora_id)) {
          diagnosticosPorReceptora.set(dg.receptora_id, dg);
        }
      });

      const sexagensPorReceptora = new Map<string, typeof sexagensData[0]>();
      sexagensData?.forEach(s => {
        if (!sexagensPorReceptora.has(s.receptora_id)) {
          sexagensPorReceptora.set(s.receptora_id, s);
        }
      });

      // Agrupar TEs por receptora
      const tesPorReceptora = new Map<string, typeof teData>();

      teData.forEach(te => {
        const chave = `${te.receptora_id}-${te.data_te}`;
        if (!tesPorReceptora.has(chave)) {
          tesPorReceptora.set(chave, []);
        }
        tesPorReceptora.get(chave)!.push(te);
      });

      const receptorasCompletas: ReceptoraPrenhe[] = [];

      tesPorReceptora.forEach((tes) => {
        const primeiraTE = tes[0];
        const receptora = receptorasData?.find(r => r.id === primeiraTE.receptora_id);
        if (!receptora) return;

        const embrioesDoGrupo: EmbriaoTransferido[] = [];
        let dataAberturalote: string | null = null;
        let diasGestacao: number | null = null;

        tes.forEach(te => {
          const embriao = embrioesMap.get(te.embriao_id);
          if (!embriao) return;

          const loteFiv = lotesMap.get(embriao.lote_fiv_id);
          if (!loteFiv) return;

          if (!dataAberturalote) {
            dataAberturalote = loteFiv.data_abertura;
            diasGestacao = calcularDiasGestacao(loteFiv.data_abertura);
          }

          const doadoraRegistro = embriao.lote_fiv_acasalamento_id
            ? doadorasMap.get(embriao.lote_fiv_acasalamento_id)
            : undefined;
          const touroNome = embriao.lote_fiv_acasalamento_id
            ? tourosMap.get(embriao.lote_fiv_acasalamento_id)
            : undefined;

          embrioesDoGrupo.push({
            te_id: te.id,
            embriao_id: embriao.id,
            embriao_identificacao: embriao.identificacao,
            embriao_classificacao: embriao.classificacao,
            lote_fiv_id: embriao.lote_fiv_id,
            lote_fiv_acasalamento_id: embriao.lote_fiv_acasalamento_id,
            doadora_registro: doadoraRegistro,
            touro_nome: touroNome,
          });
        });

        if (embrioesDoGrupo.length === 0 || !dataAberturalote || diasGestacao === null) return;

        const diagnostico = diagnosticosPorReceptora.get(primeiraTE.receptora_id);
        if (!diagnostico || diagnostico.resultado === 'VAZIA') return;

        receptorasCompletas.push({
          receptora_id: primeiraTE.receptora_id,
          brinco: receptora.identificacao,
          nome: receptora.nome,
          data_te: primeiraTE.data_te,
          embrioes: embrioesDoGrupo,
          data_abertura_lote: dataAberturalote,
          dias_gestacao: diasGestacao,
          numero_gestacoes: diagnostico.numero_gestacoes || 1,
          diagnostico_existente: sexagensPorReceptora.get(primeiraTE.receptora_id) ? {
            id: sexagensPorReceptora.get(primeiraTE.receptora_id)!.id,
            data_diagnostico: sexagensPorReceptora.get(primeiraTE.receptora_id)!.data_diagnostico,
            resultado: sexagensPorReceptora.get(primeiraTE.receptora_id)!.resultado,
            numero_gestacoes: sexagensPorReceptora.get(primeiraTE.receptora_id)!.numero_gestacoes,
            observacoes: sexagensPorReceptora.get(primeiraTE.receptora_id)!.observacoes,
          } : undefined,
        });
      });

      receptorasCompletas.sort((a, b) => a.brinco.localeCompare(b.brinco));
      setReceptoras(receptorasCompletas);

      // Inicializar formData
      const initialFormData: SexagemFormData = {};
      receptorasCompletas.forEach(r => {
        if (r.diagnostico_existente) {
          const sexagemCompleta = sexagensPorReceptora.get(r.receptora_id);
          let sexagensParsed: string[] = new Array(r.numero_gestacoes).fill('').map(() => '');
          let observacoesLimpa = r.diagnostico_existente.observacoes || '';

          if (sexagemCompleta?.observacoes) {
            const matchSexagens = sexagemCompleta.observacoes.match(/SEXAGENS:([^|]+)/);
            if (matchSexagens) {
              const sexagensArray = matchSexagens[1].split(',').map(s => s.trim());
              sexagensParsed = sexagensArray;
              while (sexagensParsed.length < r.numero_gestacoes) {
                sexagensParsed.push('');
              }
              sexagensParsed = sexagensParsed.slice(0, r.numero_gestacoes);
              observacoesLimpa = sexagemCompleta.observacoes.replace(/SEXAGENS:[^|]+\|?/, '').trim();
            }
          }

          if (sexagensParsed.every(s => !s) && sexagemCompleta?.sexagem) {
            sexagensParsed[0] = sexagemCompleta.sexagem;
          }

          initialFormData[r.receptora_id] = {
            data_sexagem: r.diagnostico_existente.data_diagnostico,
            sexagens: sexagensParsed,
            observacoes: observacoesLimpa,
          };
        } else {
          initialFormData[r.receptora_id] = {
            data_sexagem: hoje,
            sexagens: new Array(r.numero_gestacoes).fill('').map(() => ''),
            observacoes: '',
          };
        }
      });
      setFormData(initialFormData);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSexagemChange = (receptoraId: string, index: number, value: ResultadoSexagem | '') => {
    setFormData(prev => {
      const dados = prev[receptoraId] || { data_sexagem: hoje, sexagens: [], observacoes: '' };
      const novasSexagens = [...dados.sexagens];
      novasSexagens[index] = value;
      return {
        ...prev,
        [receptoraId]: { ...dados, sexagens: novasSexagens },
      };
    });
  };

  const handleFieldChange = (receptoraId: string, field: 'data_sexagem' | 'observacoes', value: string) => {
    setFormData(prev => ({
      ...prev,
      [receptoraId]: { ...prev[receptoraId], [field]: value },
    }));
  };

  const calcularStatusFinal = (sexagens: string[]): 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS' | 'VAZIA' => {
    const sexagensValidas = sexagens.filter(s => s && s !== 'VAZIA');

    if (sexagensValidas.length === 0) return 'VAZIA';

    const temFemea = sexagensValidas.includes('FEMEA');
    const temMacho = sexagensValidas.includes('MACHO');
    const temSemSexo = sexagensValidas.includes('SEM_SEXO');

    if (temFemea && !temMacho && !temSemSexo) return 'PRENHE_FEMEA';
    if (temMacho && !temFemea && !temSemSexo) return 'PRENHE_MACHO';
    if (temFemea && temMacho) return 'PRENHE_2_SEXOS';
    return 'PRENHE_SEM_SEXO';
  };

  const handleSalvarLote = async () => {
    if (!loteSelecionado) return;

    if (!validarResponsaveis(loteFormData)) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const receptorasSemResultado = receptoras.filter(r => {
      const dados = formData[r.receptora_id];
      return !dados || !dados.data_sexagem || !dados.sexagens || dados.sexagens.every(s => !s);
    });

    if (receptorasSemResultado.length > 0) {
      toast({
        title: 'Erro de validação',
        description: `Há ${receptorasSemResultado.length} receptora(s) sem sexagem definida`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const diagnosticosParaInserir: DiagnosticoGestacaoInsert[] = [];
      const diagnosticosParaAtualizar: DiagnosticoGestacaoUpdate[] = [];
      const atualizacoesStatus: Array<{ receptora_id: string; status: string }> = [];

      receptoras.forEach(receptora => {
        const dados = formData[receptora.receptora_id];
        if (!dados || !dados.data_sexagem) return;

        const sexagensValidas = dados.sexagens.filter(s => s && s !== 'VAZIA');
        const statusFinal = calcularStatusFinal(dados.sexagens);
        const resultadoFinal = statusFinal === 'VAZIA' ? 'VAZIA' : 'PRENHE';

        let sexagemValue: string | null = null;
        if (resultadoFinal === 'PRENHE') {
          const temApenasFemeas = sexagensValidas.every(s => s === 'FEMEA') && sexagensValidas.length > 0;
          const temApenasMachos = sexagensValidas.every(s => s === 'MACHO') && sexagensValidas.length > 0;

          if (temApenasFemeas) {
            sexagemValue = 'FEMEA';
          } else if (temApenasMachos) {
            sexagemValue = 'MACHO';
          } else {
            sexagemValue = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO') || null;
          }
        }

        if (sexagemValue === 'PRENHE' || sexagemValue === 'SEM_SEXO') {
          const primeiraFemeaOuMacho = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO');
          sexagemValue = primeiraFemeaOuMacho || null;
        }

        const numeroGestacoes = resultadoFinal === 'VAZIA' ? 0 : sexagensValidas.length;

        let observacoesComSexagens = dados.observacoes?.trim() || '';
        const todasSexagens = dados.sexagens.filter(s => s);
        const sexagensDetalhadas = todasSexagens.length > 0 ? todasSexagens.join(',') : '';

        if (sexagensDetalhadas) {
          if (!observacoesComSexagens.includes('SEXAGENS:')) {
            observacoesComSexagens = observacoesComSexagens
              ? `SEXAGENS:${sexagensDetalhadas}|${observacoesComSexagens}`
              : `SEXAGENS:${sexagensDetalhadas}`;
          } else {
            observacoesComSexagens = observacoesComSexagens.replace(
              /SEXAGENS:[^|]+/,
              `SEXAGENS:${sexagensDetalhadas}`
            );
          }
        }

        const insertData: DiagnosticoGestacaoInsert = {
          receptora_id: receptora.receptora_id,
          data_te: receptora.data_te,
          tipo_diagnostico: 'SEXAGEM',
          data_diagnostico: dados.data_sexagem,
          resultado: resultadoFinal,
          sexagem: sexagemValue,
          numero_gestacoes: numeroGestacoes,
          observacoes: observacoesComSexagens || undefined,
          veterinario_responsavel: loteFormData.veterinario_responsavel?.trim() || undefined,
          tecnico_responsavel: loteFormData.tecnico_responsavel?.trim() || undefined,
        };

        if (receptora.diagnostico_existente) {
          diagnosticosParaAtualizar.push({ id: receptora.diagnostico_existente.id, ...insertData });
        } else {
          diagnosticosParaInserir.push(insertData);
        }

        atualizacoesStatus.push({
          receptora_id: receptora.receptora_id,
          status: statusFinal,
        });
      });

      // Executar operações em paralelo para melhor performance
      const operacoes: Promise<void>[] = [];

      // 1. Inserir novos diagnósticos (batch)
      if (diagnosticosParaInserir.length > 0) {
        operacoes.push(
          supabase
            .from('diagnosticos_gestacao')
            .insert(diagnosticosParaInserir)
            .then(({ error }) => {
              if (error) throw new Error(`Erro ao inserir sexagens: ${error.message}`);
            })
        );
      }

      // 2. Atualizar diagnósticos existentes (em paralelo)
      diagnosticosParaAtualizar.forEach(dg => {
        const { id, ...updateData } = dg;
        operacoes.push(
          supabase
            .from('diagnosticos_gestacao')
            .update(updateData)
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw new Error(`Erro ao atualizar sexagem: ${error.message}`);
            })
        );
      });

      // Executar operações de diagnósticos
      await Promise.all(operacoes);

      // 3. Atualizar status das receptoras - agrupar por status
      const statusGroups = new Map<string, string[]>();
      atualizacoesStatus.forEach(({ receptora_id, status }) => {
        if (!statusGroups.has(status)) {
          statusGroups.set(status, []);
        }
        statusGroups.get(status)!.push(receptora_id);
      });

      // Atualizar status em batch por grupo
      for (const [status, receptoraIds] of statusGroups.entries()) {
        const updateData: { status_reprodutivo: string; data_provavel_parto?: null } = {
          status_reprodutivo: status
        };
        if (status === 'VAZIA') {
          updateData.data_provavel_parto = null;
        }

        const { error } = await supabase
          .from('receptoras')
          .update(updateData)
          .in('id', receptoraIds);

        if (error) {
          console.error('Erro ao atualizar status:', error, 'Status:', status, 'IDs:', receptoraIds);
          throw new Error(`Erro ao atualizar status das receptoras: ${error.message}`);
        }

        console.log(`Status atualizado para ${status}:`, receptoraIds);
      }

      const todasComSexagem = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.data_sexagem && dados.sexagens && dados.sexagens.some(s => s);
      });

      toast({
        title: 'Lote salvo com sucesso',
        description: todasComSexagem
          ? `${receptoras.length} sexagem(ns) registrada(s). Lote fechado.`
          : `${receptoras.length} sexagem(ns) registrada(s)`,
      });

      // Limpar rascunho após salvar com sucesso
      limparRascunho();

      if (todasComSexagem) {
        // Se fechou o lote, limpa a seleção para permitir novo trabalho
        setLoteSelecionado(null);
        setReceptoras([]);
        setFormData({});
      } else {
        // Se não fechou, atualiza o lote atual localmente (sem reload)
        setLoteSelecionado({
          ...loteSelecionado,
          veterinario_sexagem: loteFormData.veterinario_responsavel.trim(),
          tecnico_sexagem: loteFormData.tecnico_responsavel.trim(),
          status: 'ABERTO',
        });
      }

      // Recarrega fazendas e lotes em paralelo (em background)
      const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
      loadFazendas();
      if (fazendaSelecionada) {
        loadLotesTE(fazendaSelecionada, fazendaNome);
      }
    } catch (error) {
      toast({
        title: 'Erro ao salvar lote',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const todasReceptorasComSexagem = receptoras.every(r => {
    const dados = formData[r.receptora_id];
    return dados && dados.data_sexagem && dados.sexagens && dados.sexagens.some(s => s);
  });

  const formatarData = (data: string) => {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Filtrar sessões por fazenda e busca
  const sessoesFiltradas = sessoes.filter(s => {
    const matchesBusca = !filtroBusca ||
      s.fazenda_nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      s.veterinario_responsavel?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      s.receptoras.some(r =>
        r.receptora_brinco.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        r.receptora_nome?.toLowerCase().includes(filtroBusca.toLowerCase())
      );
    const matchesFazenda = filtroFazenda === 'todos' || s.fazenda_nome === filtroFazenda;
    return matchesBusca && matchesFazenda;
  });

  // Estatísticas calculadas a partir das sessões filtradas
  const estatisticasHistorico = sessoesFiltradas.reduce(
    (acc, s) => ({
      total: acc.total + s.total_receptoras,
      femeas: acc.femeas + s.femeas,
      machos: acc.machos + s.machos,
      vazias: acc.vazias + s.vazias,
    }),
    { total: 0, femeas: 0, machos: 0, vazias: 0 }
  );

  const taxaPerda = estatisticasHistorico.total > 0
    ? Math.round((estatisticasHistorico.vazias / estatisticasHistorico.total) * 100)
    : 0;

  // Paginação
  const totalPaginasHistorico = Math.ceil(sessoesFiltradas.length / ITENS_POR_PAGINA_HISTORICO);
  const sessoesPaginadas = sessoesFiltradas.slice(
    (paginaHistorico - 1) * ITENS_POR_PAGINA_HISTORICO,
    paginaHistorico * ITENS_POR_PAGINA_HISTORICO
  );

  // Limpar filtros do histórico
  const handleLimparFiltrosHistorico = () => {
    setFiltroBusca('');
    setFiltroFazenda('todos');
    setFiltroSexagem('todos');
    setFiltroDataTipo('data_sexagem');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setPaginaHistorico(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sexagem Fetal"
        description="Registrar sexagem fetal por lote de receptoras prenhes"
      />

      {/* ==================== SESSÃO DE SEXAGEM ==================== */}
      <div className="mt-4">
          {/* Barra de controles premium */}
          <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
              {/* Grupo: Responsáveis */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                  <User className="w-3.5 h-3.5" />
                  <span>Responsáveis</span>
                </div>
                <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Veterinário *
                  </label>
                  <Input
                    placeholder="Nome do veterinário"
                    value={loteFormData.veterinario_responsavel}
                    onChange={(e) => setLoteFormData(prev => ({ ...prev, veterinario_responsavel: e.target.value }))}
                    className="h-11 md:h-9"
                  />
                </div>
                <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Técnico
                  </label>
                  <Input
                    placeholder="Nome do técnico"
                    value={loteFormData.tecnico_responsavel}
                    onChange={(e) => setLoteFormData(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}
                    className="h-11 md:h-9"
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="h-10 w-px bg-border hidden md:block" />

              {/* Grupo: Local */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Local</span>
                </div>
                <div className="w-full md:w-auto md:flex-1 md:min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Fazenda *
                  </label>
                  <Select
                    value={fazendaSelecionada}
                    onValueChange={setFazendaSelecionada}
                    disabled={!loteFormData.veterinario_responsavel}
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
                <div className="w-full md:w-auto md:flex-1 md:min-w-[200px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Lote TE *
                  </label>
                  <Select
                    value={loteSelecionado?.id || ''}
                    onValueChange={(value) => {
                      const lote = lotesTE.find(l => l.id === value);
                      setLoteSelecionado(lote || null);
                    }}
                    disabled={!fazendaSelecionada || loadingLotes}
                  >
                    <SelectTrigger className="h-11 md:h-9">
                      <SelectValue placeholder={loadingLotes ? 'Carregando...' : 'Selecione o lote'} />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesTE.map((lote) => {
                        const diasInsuficientes = lote.dias_gestacao !== undefined && lote.dias_gestacao < DIAS_MINIMOS.SEXAGEM;
                        return (
                          <SelectItem key={lote.id} value={lote.id}>
                            <span className={diasInsuficientes ? 'text-amber-600' : ''}>
                              {formatarData(lote.data_te)} • {lote.dias_gestacao ?? '?'}d • {lote.quantidade_receptoras} rec.
                              {diasInsuficientes && ' ⚠️'}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Separador */}
              <div className="h-10 w-px bg-border hidden md:block" />

              {/* Grupo: Ação */}
              <div className="flex items-end gap-3 w-full md:w-auto md:ml-auto">
                <Button
                  onClick={handleSalvarLote}
                  disabled={
                    !loteSelecionado ||
                    !todasReceptorasComSexagem ||
                    submitting ||
                    loteSelecionado?.status === 'FECHADO' ||
                    (loteSelecionado?.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.SEXAGEM)
                  }
                  className="h-11 md:h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm w-full md:w-auto"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {submitting ? 'Salvando...' : 'Salvar Lote'}
                </Button>
              </div>
            </div>

            {/* Aviso de dias insuficientes */}
            {loteSelecionado && loteSelecionado.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.SEXAGEM && (
              <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Este lote está com {loteSelecionado.dias_gestacao} dias. Sexagem requer mínimo de {DIAS_MINIMOS.SEXAGEM} dias (faltam {DIAS_MINIMOS.SEXAGEM - loteSelecionado.dias_gestacao}).
                </p>
              </div>
            )}
          </div>

          {/* Tabela de Receptoras */}
          {loading ? (
            <Card>
              <CardContent className="py-8">
                <LoadingSpinner />
              </CardContent>
            </Card>
          ) : loteSelecionado && receptoras.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <CardTitle className="text-base">
                        Receptoras do Lote
                      </CardTitle>
                      <CardDescription>
                        {receptoras.length} receptora(s) • TE em {formatarData(loteSelecionado.data_te)}
                      </CardDescription>
                    </div>
                    {loteSelecionado.status === 'FECHADO' && (
                      <Badge variant="secondary">Lote Fechado</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {receptoras.map((receptora) => {
                    const dados = formData[receptora.receptora_id] || {
                      data_sexagem: hoje,
                      sexagens: new Array(receptora.numero_gestacoes).fill('').map(() => ''),
                      observacoes: '',
                    };
                    const isDisabled = loteSelecionado.status === 'FECHADO';

                    return (
                      <div key={receptora.receptora_id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                        {/* Header: brinco + dias gestacao */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-base">{receptora.brinco}</span>
                            {receptora.nome && <span className="text-muted-foreground text-xs">({receptora.nome})</span>}
                          </div>
                          <Badge variant="outline" className="font-mono">{receptora.dias_gestacao}d</Badge>
                        </div>

                        {/* Embriao info */}
                        <div className="text-sm text-muted-foreground mb-3">
                          {receptora.embrioes.map((embriao) => (
                            <div key={embriao.te_id}>
                              {embriao.doadora_registro || '-'}
                              {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                            </div>
                          ))}
                          <span className="text-xs">{`N\u00BA Gesta\u00E7\u00F5es: ${receptora.numero_gestacoes}`}</span>
                        </div>

                        {/* Form fields */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Data Sexagem</label>
                            <DatePickerBR
                              value={dados.data_sexagem}
                              onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_sexagem', value || '')}
                              disabled={isDisabled}
                            />
                          </div>
                          <div className={`grid ${receptora.numero_gestacoes > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                            {Array.from({ length: receptora.numero_gestacoes }, (_, index) => {
                              const valorAtual = dados.sexagens[index] || '';
                              const label = receptora.numero_gestacoes > 1 ? `Gesta\u00E7\u00E3o ${index + 1}` : 'Sexagem';
                              return (
                                <div key={index}>
                                  <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{label}</label>
                                  <Select
                                    value={valorAtual}
                                    onValueChange={(value) => handleSexagemChange(receptora.receptora_id, index, value as ResultadoSexagem | '')}
                                    disabled={isDisabled}
                                  >
                                    <SelectTrigger className="h-11"><SelectValue placeholder="--" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="FEMEA">F\u00EAmea</SelectItem>
                                      <SelectItem value="MACHO">Macho</SelectItem>
                                      <SelectItem value="SEM_SEXO">Sem sexo</SelectItem>
                                      <SelectItem value="VAZIA">Vazia</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Obs.</label>
                            <Input
                              value={dados.observacoes}
                              onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                              placeholder="Obs."
                              className="h-11"
                              disabled={isDisabled}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receptora</TableHead>
                        <TableHead>Dias Gest.</TableHead>
                        <TableHead>Embrião</TableHead>
                        <TableHead>Doadora × Touro</TableHead>
                        <TableHead>Nº Gest.</TableHead>
                        <TableHead>Data Sexagem</TableHead>
                        <TableHead>Sexagem(ns)</TableHead>
                        <TableHead>Obs.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receptoras.map((receptora) => {
                        const dados = formData[receptora.receptora_id] || {
                          data_sexagem: hoje,
                          sexagens: new Array(receptora.numero_gestacoes).fill('').map(() => ''),
                          observacoes: '',
                        };
                        const isDisabled = loteSelecionado.status === 'FECHADO';

                        return (
                          <TableRow key={receptora.receptora_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {receptora.brinco}
                                {receptora.nome && (
                                  <span className="text-muted-foreground text-xs">({receptora.nome})</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {receptora.dias_gestacao}d
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                {receptora.embrioes.map((embriao, idx) => (
                                  <div key={embriao.te_id} className="text-sm">
                                    {embriao.embriao_identificacao || `#${idx + 1}`}
                                    {embriao.embriao_classificacao && (
                                      <span className="text-muted-foreground text-xs ml-1">
                                        ({embriao.embriao_classificacao})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5 text-sm">
                                {receptora.embrioes.map((embriao) => (
                                  <div key={embriao.te_id}>
                                    {embriao.doadora_registro || '-'}
                                    {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {receptora.numero_gestacoes}
                            </TableCell>
                            <TableCell>
                              <DatePickerBR
                                value={dados.data_sexagem}
                                onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_sexagem', value || '')}
                                className="w-32"
                                disabled={isDisabled}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {Array.from({ length: receptora.numero_gestacoes }, (_, index) => {
                                  const valorAtual = dados.sexagens[index] || '';
                                  const placeholder = receptora.numero_gestacoes > 1 ? `G${index + 1}` : '--';

                                  return (
                                    <Select
                                      key={index}
                                      value={valorAtual}
                                      onValueChange={(value) => handleSexagemChange(receptora.receptora_id, index, value as ResultadoSexagem | '')}
                                      disabled={isDisabled}
                                    >
                                      <SelectTrigger className="w-24 h-9">
                                        <SelectValue placeholder={placeholder} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="FEMEA">Fêmea</SelectItem>
                                        <SelectItem value="MACHO">Macho</SelectItem>
                                        <SelectItem value="SEM_SEXO">Sem sexo</SelectItem>
                                        <SelectItem value="VAZIA">Vazia</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={dados.observacoes}
                                onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                                placeholder="Obs."
                                className="w-32 h-9"
                                disabled={isDisabled}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : loteSelecionado && receptoras.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma receptora prenhe encontrada neste lote
              </CardContent>
            </Card>
          ) : null}
        </div>

      {/* Dialog Restaurar Sessão em Andamento */}
      <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Sexagem não finalizada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem uma sessão de sexagem em andamento que não foi finalizada. Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={descartarRascunho}>Descartar</AlertDialogCancel>
            <AlertDialogAction onClick={restaurarRascunho}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
