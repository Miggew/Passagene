import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Embriao, Fazenda, HistoricoEmbriao, Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { handleError } from '@/lib/error-handler';
import { useToast } from '@/hooks/use-toast';
import { Snowflake, Tag, MapPin, Trash2, History, ChevronDown, ChevronUp, Package, CheckSquare, Square, User, Edit, AlertTriangle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDate } from '@/lib/utils';
import DatePickerBR from '@/components/shared/DatePickerBR';

// Função para calcular o dia do embrião (D0, D1, D2... D7, D8, etc)
// baseado na data de fecundação (D0 = dia da fecundação)
const calcularDiaEmbriao = (dataFecundacao: string | undefined): number | null => {
  if (!dataFecundacao) return null;

  // Pegar a data de hoje no formato YYYY-MM-DD (horário local do usuário)
  const hoje = new Date();
  const hojeStr = hoje.getFullYear() + '-' +
    String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
    String(hoje.getDate()).padStart(2, '0');

  // Comparar apenas as datas (sem horas)
  const [anoHoje, mesHoje, diaHoje] = hojeStr.split('-').map(Number);
  const [anoFec, mesFec, diaFec] = dataFecundacao.split('-').map(Number);

  const dataHojeMs = Date.UTC(anoHoje, mesHoje - 1, diaHoje);
  const dataFecMs = Date.UTC(anoFec, mesFec - 1, diaFec);

  const diffDays = Math.floor((dataHojeMs - dataFecMs) / (1000 * 60 * 60 * 24));

  return diffDays;
};

interface EmbrioCompleto extends Embriao {
  doadora_registro?: string;
  touro_nome?: string;
  fazenda_destino_nome?: string;
  data_aspiracao?: string;
  pacote_aspiracao_id?: string;
}

interface PacoteAspiracaoInfo {
  id: string;
  data_aspiracao: string;
  fazenda_nome?: string;
  quantidade_doadoras: number;
  horario_inicio?: string;
  veterinario_responsavel?: string;
  total_oocitos?: number;
}

interface PacoteEmbrioes {
  id: string; // ID único do pacote (lote_fiv_id + data de criação)
  lote_fiv_id: string;
  data_despacho: string; // Data de criação dos embriões (data do despacho)
  data_fecundacao?: string; // Data de fecundação para cálculo do dia do embrião
  fazendas_destino_ids: string[]; // Todas as fazendas destino do pacote
  fazendas_destino_nomes: string[]; // Nomes de todas as fazendas destino
  pacote_info: PacoteAspiracaoInfo;
  embrioes: EmbrioCompleto[];
  total: number;
  frescos: number;
  congelados: number;
  sem_classificacao: number;
  classificados: {
    BE: number;
    BN: number;
    BX: number;
    BL: number;
    BI: number;
  };
  todos_classificados?: boolean;
  disponivel_para_transferencia?: boolean;
}

const EMBRIOES_FILTROS_KEY = 'embrioes_filtros';

type EmbrioesFiltrosPersistidos = {
  selectedFazendaDestinoId?: string;
  paginasPacotes?: Record<string, number>;
};

const carregarFiltrosEmbrioes = (): EmbrioesFiltrosPersistidos => {
  try {
    const raw = localStorage.getItem(EMBRIOES_FILTROS_KEY);
    return raw ? (JSON.parse(raw) as EmbrioesFiltrosPersistidos) : {};
  } catch {
    return {};
  }
};

export default function Embrioes() {
  const navigate = useNavigate();
  const filtrosPersistidos = carregarFiltrosEmbrioes();
  const [embrioes, setEmbrioes] = useState<EmbrioCompleto[]>([]);
  const [pacotes, setPacotes] = useState<PacoteEmbrioes[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [selectedFazendaDestinoId, setSelectedFazendaDestinoId] = useState<string>(
    filtrosPersistidos.selectedFazendaDestinoId ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [pacotesExpandidos, setPacotesExpandidos] = useState<Set<string>>(new Set());
  const [embrioesSelecionados, setEmbrioesSelecionados] = useState<Set<string>>(new Set());
  const [showAcoesEmMassa, setShowAcoesEmMassa] = useState(false);
  const [showCongelarDialog, setShowCongelarDialog] = useState(false);
  const [showDirecionarClienteDialog, setShowDirecionarClienteDialog] = useState(false);
  const [showClassificarDialog, setShowClassificarDialog] = useState(false);
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [classificarEmbriao, setClassificarEmbriao] = useState<Embriao | null>(null);
  const [descartarEmbriao, setDescartarEmbriao] = useState<Embriao | null>(null);
  const [historicoEmbriao, setHistoricoEmbriao] = useState<Embriao | null>(null);
  const [historico, setHistorico] = useState<HistoricoEmbriao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [showEditarFazendasDestinoDialog, setShowEditarFazendasDestinoDialog] = useState(false);
  const [pacoteEditandoFazendas, setPacoteEditandoFazendas] = useState<PacoteEmbrioes | null>(null);
  const [fazendasDestinoSelecionadas, setFazendasDestinoSelecionadas] = useState<string[]>([]);
  const { toast } = useToast();
  const [paginasPacotes, setPaginasPacotes] = useState<Record<string, number>>(
    filtrosPersistidos.paginasPacotes ?? {}
  );

  const PAGE_SIZE = 20;

  const [congelarData, setCongelarData] = useState({
    data_congelamento: new Date().toISOString().split('T')[0],
    localizacao_atual: '',
  });

  const [classificarData, setClassificarData] = useState({
    classificacao: '',
  });
  const [classificacoesPendentes, setClassificacoesPendentes] = useState<Record<string, string>>({});

  const [descartarData, setDescartarData] = useState({
    data_descarte: new Date().toISOString().split('T')[0],
    observacoes: '',
  });

  const [direcionarClienteData, setDirecionarClienteData] = useState({
    cliente_id: '',
  });

  const getClassificacaoAtual = (embriao: EmbrioCompleto) => {
    const pendente = classificacoesPendentes[embriao.id];
    return (pendente ?? embriao.classificacao ?? '').trim();
  };

  const getResumoPacote = (pacote: PacoteEmbrioes) => {
    const classificados = { BE: 0, BN: 0, BX: 0, BL: 0, BI: 0 };
    let semClassificacao = 0;
    pacote.embrioes.forEach((embriao) => {
      const classificacao = getClassificacaoAtual(embriao).toUpperCase();
      if (!classificacao) {
        semClassificacao += 1;
        return;
      }
      if (classificacao === 'BE') classificados.BE += 1;
      else if (classificacao === 'BN') classificados.BN += 1;
      else if (classificacao === 'BX') classificados.BX += 1;
      else if (classificacao === 'BL') classificados.BL += 1;
      else if (classificacao === 'BI') classificados.BI += 1;
    });
    return {
      semClassificacao,
      classificados,
      total: pacote.total,
      todosClassificados: pacote.total > 0 && semClassificacao === 0,
    };
  };

  useEffect(() => {
    loadFazendas();
    loadClientes();
  }, []);

  useEffect(() => {
    const payload: EmbrioesFiltrosPersistidos = {
      selectedFazendaDestinoId,
      paginasPacotes,
    };
    localStorage.setItem(EMBRIOES_FILTROS_KEY, JSON.stringify(payload));
  }, [selectedFazendaDestinoId, paginasPacotes]);


  useEffect(() => {
    setPaginasPacotes((prev) => {
      let changed = false;
      const next = { ...prev };
      pacotes.forEach((pacote) => {
        const totalPaginas = Math.max(1, Math.ceil(pacote.embrioes.length / PAGE_SIZE));
        if (!next[pacote.id]) {
          next[pacote.id] = 1;
          changed = true;
          return;
        }
        if (next[pacote.id] > totalPaginas) {
          next[pacote.id] = totalPaginas;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pacotes]);

  const loadClientes = async () => {
    try {
      const { data: clientesData, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(clientesData || []);
    } catch (error) {
      handleError(error, 'Erro ao carregar clientes');
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFazendaDestinoId]);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      handleError(error, 'Erro ao carregar fazendas');
    }
  };

  // Função auxiliar para registrar histórico
  const registrarHistorico = async (
    embriaoId: string,
    statusAnterior: string | null,
    statusNovo: string,
    tipoOperacao: 'CLASSIFICACAO' | 'DESTINACAO' | 'CONGELAMENTO' | 'DESCARTE' | 'TRANSFERENCIA',
    fazendaId?: string | null,
    observacoes?: string | null
  ) => {
    try {
      const { error } = await supabase.from('historico_embrioes').insert([
        {
          embriao_id: embriaoId,
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          tipo_operacao: tipoOperacao,
          fazenda_id: fazendaId || null,
          observacoes: observacoes || null,
          data_mudanca: new Date().toISOString(),
        },
      ]);

      // Erro silencioso - histórico é secundário
    } catch {
      // Erro silencioso - histórico é secundário
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // ===== FASE 1: Query inicial de embriões =====
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('*')
        .in('status_atual', ['FRESCO', 'CONGELADO'])
        .is('cliente_id', null)
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;

      if (!embrioesData || embrioesData.length === 0) {
        setEmbrioes([]);
        setPacotes([]);
        setLoading(false);
        return;
      }

      // Coletar IDs necessários
      const acasalamentoIds = [...new Set(
        embrioesData.filter((e) => e.lote_fiv_acasalamento_id).map((e) => e.lote_fiv_acasalamento_id)
      )] as string[];
      const loteFivIds = [...new Set(
        embrioesData.filter((e) => e.lote_fiv_id).map((e) => e.lote_fiv_id)
      )] as string[];
      const fazendaDestinoIdsEmbrioes = [...new Set(
        embrioesData.filter((e) => e.fazenda_destino_id).map((e) => e.fazenda_destino_id)
      )] as string[];

      if (acasalamentoIds.length === 0) {
        setEmbrioes(embrioesData as EmbrioCompleto[]);
        setPacotes([]);
        setLoading(false);
        return;
      }

      // ===== FASE 2: Queries paralelas (acasalamentos + lotes_fiv) =====
      const [acasalamentosResult, lotesFivResult] = await Promise.all([
        supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds),
        loteFivIds.length > 0
          ? supabase.from('lotes_fiv').select('id, pacote_aspiracao_id, data_fecundacao').in('id', loteFivIds)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (acasalamentosResult.error) throw acasalamentosResult.error;
      const acasalamentosData = acasalamentosResult.data || [];
      const lotesFivData = lotesFivResult.data || [];

      // Preparar IDs para próximas queries
      const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id))];
      const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id))];
      const pacoteIds = [...new Set(lotesFivData.map((l) => l.pacote_aspiracao_id).filter(Boolean))] as string[];

      // Mapear lote_fiv_id -> pacote_aspiracao_id
      const pacoteParaLoteMap = new Map<string, string>();
      // Mapear lote_fiv_id -> data_fecundacao
      const dataFecundacaoMap = new Map<string, string>();
      lotesFivData.forEach(lote => {
        if (lote.pacote_aspiracao_id) {
          pacoteParaLoteMap.set(lote.id, lote.pacote_aspiracao_id);
        }
        if (lote.data_fecundacao) {
          dataFecundacaoMap.set(lote.id, lote.data_fecundacao);
        }
      });

      // ===== FASE 3: Queries paralelas (aspiracoes + doses + pacotes) =====
      const [aspiracoesResult, dosesResult, pacotesResult] = await Promise.all([
        aspiracaoIds.length > 0
          ? supabase.from('aspiracoes_doadoras').select('id, doadora_id, pacote_aspiracao_id').in('id', aspiracaoIds)
          : Promise.resolve({ data: null, error: null }),
        doseIds.length > 0
          ? supabase.from('doses_semen').select('id, touro_id, touro:touros(id, nome, registro, raca)').in('id', doseIds)
          : Promise.resolve({ data: null, error: null }),
        pacoteIds.length > 0
          ? supabase.from('pacotes_aspiracao').select('id, data_aspiracao, fazenda_id, fazenda_destino_id, horario_inicio, veterinario_responsavel, total_oocitos').in('id', pacoteIds)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (aspiracoesResult.error) throw aspiracoesResult.error;
      if (dosesResult.error) throw dosesResult.error;

      const aspiracoesData = aspiracoesResult.data || [];
      const dosesData = dosesResult.data || [];
      const pacotesData = pacotesResult.data || [];

      // Coletar IDs de doadoras e fazendas
      const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
      const todasFazendaIds = new Set<string>(fazendaDestinoIdsEmbrioes);
      pacotesData.forEach(p => {
        if (p.fazenda_id) todasFazendaIds.add(p.fazenda_id);
        if (p.fazenda_destino_id) todasFazendaIds.add(p.fazenda_destino_id);
      });

      // ===== FASE 4: Queries paralelas (doadoras + fazendas + fazendas_destino_pacotes) =====
      const [doadorasResult, fazendasResult, fazendasDestinoResult] = await Promise.all([
        doadoraIds.length > 0
          ? supabase.from('doadoras').select('id, registro').in('id', doadoraIds)
          : Promise.resolve({ data: null, error: null }),
        todasFazendaIds.size > 0
          ? supabase.from('fazendas').select('id, nome').in('id', Array.from(todasFazendaIds))
          : Promise.resolve({ data: null, error: null }),
        pacoteIds.length > 0
          ? supabase.from('pacotes_aspiracao_fazendas_destino').select('pacote_aspiracao_id, fazenda_destino_id').in('pacote_aspiracao_id', pacoteIds)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (doadorasResult.error) throw doadorasResult.error;

      const doadorasData = doadorasResult.data || [];
      const fazendasData = fazendasResult.data || [];
      const fazendasDestinoData = fazendasDestinoResult.data || [];

      // ===== PROCESSAR DADOS =====

      // Mapa de fazendas
      const fazendasDestinoMap = new Map(fazendasData.map((f) => [f.id, f.nome]));

      // Mapa fazendas destino por pacote
      const fazendasDestinoPorPacoteMap = new Map<string, string[]>();
      fazendasDestinoData.forEach(item => {
        const atual = fazendasDestinoPorPacoteMap.get(item.pacote_aspiracao_id) || [];
        if (!atual.includes(item.fazenda_destino_id)) {
          atual.push(item.fazenda_destino_id);
          // Adicionar ao mapa de fazendas se não existe
          if (!fazendasDestinoMap.has(item.fazenda_destino_id)) {
            todasFazendaIds.add(item.fazenda_destino_id);
          }
        }
        fazendasDestinoPorPacoteMap.set(item.pacote_aspiracao_id, atual);
      });

      // Fallback: adicionar fazenda_destino_id legacy dos pacotes
      pacotesData.forEach(pacote => {
        if (pacote.fazenda_destino_id) {
          const atual = fazendasDestinoPorPacoteMap.get(pacote.id) || [];
          if (!atual.includes(pacote.fazenda_destino_id)) {
            atual.push(pacote.fazenda_destino_id);
          }
          fazendasDestinoPorPacoteMap.set(pacote.id, atual);
        }
      });

      // Contar doadoras por pacote
      const quantidadePorPacote = new Map<string, number>();
      aspiracoesData.forEach((a) => {
        if (a.pacote_aspiracao_id) {
          quantidadePorPacote.set(
            a.pacote_aspiracao_id,
            (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1
          );
        }
      });

      // Criar mapa de pacotes de aspiração
      const pacotesAspiracaoMap = new Map<string, PacoteAspiracaoInfo>();
      pacotesData.forEach(pacote => {
        pacotesAspiracaoMap.set(pacote.id, {
          id: pacote.id,
          data_aspiracao: pacote.data_aspiracao,
          fazenda_nome: fazendasDestinoMap.get(pacote.fazenda_id),
          quantidade_doadoras: quantidadePorPacote.get(pacote.id) || 0,
          horario_inicio: pacote.horario_inicio,
          veterinario_responsavel: pacote.veterinario_responsavel,
          total_oocitos: pacote.total_oocitos,
        });
      });

      // Mapear dados
      const aspiracoesMap = new Map(aspiracoesData.map((a) => [a.id, a]));
      const doadorasMap = new Map(doadorasData.map((d) => [d.id, d]));
      const dosesMap = new Map(dosesData.map((d) => [d.id, d]));
      const acasalamentosMap = new Map(acasalamentosData.map((a) => [a.id, a]));

      const embrioesCompletos: EmbrioCompleto[] = embrioesData.map((embriao) => {
        const acasalamento = embriao.lote_fiv_acasalamento_id
          ? acasalamentosMap.get(embriao.lote_fiv_acasalamento_id)
          : undefined;
        const aspiracao = acasalamento
          ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id)
          : undefined;
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;

        const pacoteId = embriao.lote_fiv_id ? pacoteParaLoteMap.get(embriao.lote_fiv_id) : undefined;
        const pacoteInfo = pacoteId ? pacotesAspiracaoMap.get(pacoteId) : undefined;

        const touro = dose?.touro ?? null;

        return {
          ...embriao,
          doadora_registro: doadora?.registro,
          touro_nome: touro?.nome || 'Touro desconhecido',
          fazenda_destino_nome: embriao.fazenda_destino_id
            ? fazendasDestinoMap.get(embriao.fazenda_destino_id)
            : undefined,
          data_aspiracao: pacoteInfo?.data_aspiracao,
          pacote_aspiracao_id: pacoteId,
        };
      });

      setEmbrioes(embrioesCompletos);

      // Agrupar embriões por lote_fiv_id + data de criação (created_at)
      // Cada "despacho" cria embriões na mesma data do mesmo lote, então cada combinação
      // lote_fiv_id + data de criação representa um pacote de embriões separado
      const pacotesMap = new Map<string, PacoteEmbrioes>();
      
      embrioesCompletos.forEach((embriao) => {
        if (!embriao.lote_fiv_id || !embriao.created_at) {
          // Embriões sem lote_fiv_id ou created_at não são agrupados
          return;
        }

        const dataDespacho = embriao.created_at.split('T')[0];
        const chavePacote = `${embriao.lote_fiv_id}-${dataDespacho}`;
        
        let pacote = pacotesMap.get(chavePacote);
        if (!pacote) {
          // Obter informações do lote FIV e do pacote de aspiração original
          const pacoteAspiracaoIdOriginal = pacoteParaLoteMap.get(embriao.lote_fiv_id);
          const pacoteInfo = pacoteAspiracaoIdOriginal 
            ? pacotesAspiracaoMap.get(pacoteAspiracaoIdOriginal)
            : undefined;
          
          // Obter todas as fazendas destino do lote (usar as fazendas destino do pacote de aspiração original)
          const fazendasDestinoIds = pacoteAspiracaoIdOriginal
            ? (fazendasDestinoPorPacoteMap.get(pacoteAspiracaoIdOriginal) || [])
            : [];
          
          const fazendasDestinoNomes = fazendasDestinoIds
            .map(id => fazendasDestinoMap.get(id))
            .filter((nome): nome is string => !!nome);
          
          // Obter data de fecundação do lote FIV
          const dataFecundacao = dataFecundacaoMap.get(embriao.lote_fiv_id);

          pacote = {
            id: chavePacote,
            lote_fiv_id: embriao.lote_fiv_id,
            data_despacho: dataDespacho,
            data_fecundacao: dataFecundacao,
            fazendas_destino_ids: fazendasDestinoIds,
            fazendas_destino_nomes: fazendasDestinoNomes,
            pacote_info: pacoteInfo || {
              id: pacoteAspiracaoIdOriginal || '',
              data_aspiracao: dataDespacho,
              quantidade_doadoras: 0,
            },
            embrioes: [],
            total: 0,
            frescos: 0,
            congelados: 0,
            sem_classificacao: 0,
            classificados: {
              BE: 0,
              BN: 0,
              BX: 0,
              BL: 0,
              BI: 0,
            },
          };
          pacotesMap.set(chavePacote, pacote);
        }
        
        pacote.embrioes.push(embriao);
        pacote.total++;
        
        if (embriao.status_atual === 'FRESCO') pacote.frescos++;
        if (embriao.status_atual === 'CONGELADO') pacote.congelados++;
        
        if (!embriao.classificacao) {
          pacote.sem_classificacao++;
        } else {
          const classificacao = embriao.classificacao.toUpperCase();
          if (classificacao === 'BE') pacote.classificados.BE++;
          else if (classificacao === 'BN') pacote.classificados.BN++;
          else if (classificacao === 'BX') pacote.classificados.BX++;
          else if (classificacao === 'BL') pacote.classificados.BL++;
          else if (classificacao === 'BI') pacote.classificados.BI++;
        }
      });

      // Filtrar pacotes pela fazenda destino selecionada (depois do agrupamento)
      let pacotesArray = Array.from(pacotesMap.values());

      if (selectedFazendaDestinoId) {
        pacotesArray = pacotesArray.filter(pacote => {
          // Um pacote é exibido se tiver a fazenda selecionada em suas fazendas destino
          return pacote.fazendas_destino_ids.includes(selectedFazendaDestinoId);
        });
      }

      // Buscar status de disponibilidade dos lotes FIV
      const loteFivIdsUnicos = [...new Set(pacotesArray.map(p => p.lote_fiv_id))];
      const { data: lotesDisponibilidade } = await supabase
        .from('lotes_fiv')
        .select('id, disponivel_para_transferencia')
        .in('id', loteFivIdsUnicos);

      const lotesDisponiveisMap = new Map(
        lotesDisponibilidade?.map(l => [l.id, l.disponivel_para_transferencia === true]) || []
      );

      // Adicionar informação de disponibilidade e status de classificação aos pacotes
      const pacotesComStatus = pacotesArray.map(pacote => ({
        ...pacote,
        todos_classificados: pacote.total > 0 && pacote.sem_classificacao === 0,
        disponivel_para_transferencia: lotesDisponiveisMap.get(pacote.lote_fiv_id) || false,
      }));

      // Ordenar por data de despacho (mais recente primeiro)
      pacotesComStatus.sort((a, b) => {
        return b.data_despacho.localeCompare(a.data_despacho);
      });

      setPacotes(pacotesComStatus);
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandirPacote = (pacoteId: string) => {
    const novoSet = new Set(pacotesExpandidos);
    if (novoSet.has(pacoteId)) {
      novoSet.delete(pacoteId);
    } else {
      novoSet.add(pacoteId);
    }
    setPacotesExpandidos(novoSet);
  };

  const toggleSelecionarEmbriao = (embriaoId: string) => {
    const novoSet = new Set(embrioesSelecionados);
    if (novoSet.has(embriaoId)) {
      novoSet.delete(embriaoId);
    } else {
      novoSet.add(embriaoId);
    }
    setEmbrioesSelecionados(novoSet);
    setShowAcoesEmMassa(novoSet.size > 0);
  };

  const selecionarTodosDaPagina = (embrioesPagina: EmbrioCompleto[]) => {
    const novoSet = new Set(embrioesSelecionados);
    const todosSelecionados = embrioesPagina.every(e => novoSet.has(e.id));
    
    if (todosSelecionados) {
      // Desmarcar todos
      embrioesPagina.forEach(e => novoSet.delete(e.id));
    } else {
      // Marcar todos
      embrioesPagina.forEach(e => novoSet.add(e.id));
    }
    
    setEmbrioesSelecionados(novoSet);
    setShowAcoesEmMassa(novoSet.size > 0);
  };

  const getPaginaPacote = (pacoteId: string) => paginasPacotes[pacoteId] ?? 1;

  const setPaginaPacote = (pacoteId: string, pagina: number) => {
    setPaginasPacotes((prev) => ({
      ...prev,
      [pacoteId]: pagina,
    }));
  };

  const despacharPacoteParaCampo = async (pacote: PacoteEmbrioes) => {
    const resumo = getResumoPacote(pacote);
    if (!resumo.todosClassificados) {
      toast({
        title: 'Classificação pendente',
        description: 'Classifique todos os embriões do pacote antes de despachar para o campo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const dataClassificacao = new Date().toISOString().split('T')[0];
      const embrioesPendentes = pacote.embrioes.filter((embriao) => {
        const classificacaoAtual = getClassificacaoAtual(embriao);
        return classificacaoAtual && classificacaoAtual !== (embriao.classificacao || '').trim();
      });

      if (embrioesPendentes.length > 0) {
        const updates = await Promise.all(
          embrioesPendentes.map((embriao) =>
            supabase
              .from('embrioes')
              .update({
                classificacao: getClassificacaoAtual(embriao),
                data_classificacao: dataClassificacao,
              })
              .eq('id', embriao.id)
          )
        );
        const updateError = updates.find((result) => result.error)?.error;
        if (updateError) throw updateError;

        for (const embriao of embrioesPendentes) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            embriao.status_atual,
            'CLASSIFICACAO',
            null,
            `Classificação: ${getClassificacaoAtual(embriao)}`
          );
        }
      }

      const { error } = await supabase
        .from('lotes_fiv')
        .update({ disponivel_para_transferencia: true })
        .eq('id', pacote.lote_fiv_id);

      if (error) throw error;

      toast({
        title: 'Pacote despachado',
        description: 'O pacote agora está disponível para transferência de embriões.',
      });

      // Recarregar dados
      setClassificacoesPendentes((prev) => {
        const next = { ...prev };
        embrioesPendentes.forEach((embriao) => {
          delete next[embriao.id];
        });
        return next;
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao despachar pacote',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSalvarFazendasDestino = async () => {
    if (!pacoteEditandoFazendas) {
      return;
    }

    try {
      setSubmitting(true);

      // Buscar o pacote_aspiracao_id do lote FIV
      const { data: loteData, error: loteError } = await supabase
        .from('lotes_fiv')
        .select('pacote_aspiracao_id')
        .eq('id', pacoteEditandoFazendas.lote_fiv_id)
        .single();

      if (loteError || !loteData || !loteData.pacote_aspiracao_id) {
        throw new Error('Pacote de aspiração não encontrado para este lote FIV');
      }

      const pacoteAspiracaoId = loteData.pacote_aspiracao_id;

      // Remover todas as fazendas destino existentes do pacote
      const { error: deleteError } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .delete()
        .eq('pacote_aspiracao_id', pacoteAspiracaoId);

      // Continua mesmo se erro ao remover fazendas

      // Inserir as novas fazendas destino selecionadas
      if (fazendasDestinoSelecionadas.length > 0) {
        const fazendasParaInserir = fazendasDestinoSelecionadas.map(fazendaId => ({
          pacote_aspiracao_id: pacoteAspiracaoId,
          fazenda_destino_id: fazendaId,
        }));

        const { error: insertError } = await supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .insert(fazendasParaInserir);

        if (insertError) {
          throw insertError;
        }
      }

      toast({
        title: 'Fazendas destino atualizadas',
        description: `As fazendas destino do pacote foram atualizadas com sucesso.`,
      });

      setShowEditarFazendasDestinoDialog(false);
      setPacoteEditandoFazendas(null);
      setFazendasDestinoSelecionadas([]);
      
      // Recarregar dados
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar fazendas destino',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClassificar = async (embriaoId?: string) => {
    const embriaoParaClassificar = embriaoId 
      ? embrioes.find(e => e.id === embriaoId)
      : classificarEmbriao;
    
    if (!embriaoParaClassificar || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Classificação é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    setClassificacoesPendentes((prev) => ({
      ...prev,
      [embriaoParaClassificar.id]: classificarData.classificacao,
    }));

    toast({
      title: 'Classificação pendente',
      description: 'A classificação foi salva localmente. Use "Despachar para o campo" para salvar tudo.',
    });

    setShowClassificarDialog(false);
    setClassificarEmbriao(null);
    setClassificarData({ classificacao: '' });
    setEmbrioesSelecionados(new Set());
    setShowAcoesEmMassa(false);
  };

  const handleClassificarEmMassa = async () => {
    if (embrioesSelecionados.size === 0 || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião e uma classificação',
        variant: 'destructive',
      });
      return;
    }

    const embrioesParaClassificar = Array.from(embrioesSelecionados);
    setClassificacoesPendentes((prev) => {
      const next = { ...prev };
      embrioesParaClassificar.forEach((embriaoId) => {
        next[embriaoId] = classificarData.classificacao;
      });
      return next;
    });

    toast({
      title: 'Classificações pendentes',
      description: 'As classificações foram salvas localmente. Use "Despachar para o campo" para salvar tudo.',
    });

    setShowClassificarDialog(false);
    setClassificarData({ classificacao: '' });
    setEmbrioesSelecionados(new Set());
    setShowAcoesEmMassa(false);
  };

  const handleCongelarEmMassa = async () => {
    if (embrioesSelecionados.size === 0 || !congelarData.localizacao_atual.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião e informe a localização',
        variant: 'destructive',
      });
      return;
    }

    // Validar que todos os embriões selecionados estão classificados
    const embrioesParaCongelar = Array.from(embrioesSelecionados);
    const embrioesSemClassificacao = embrioes.filter(e =>
      embrioesParaCongelar.includes(e.id) && !getClassificacaoAtual(e)
    );

    if (embrioesSemClassificacao.length > 0) {
      toast({
        title: 'Erro de validação',
        description: `Não é possível congelar embriões sem classificação. ${embrioesSemClassificacao.length} embrião(ões) selecionado(s) não está(ão) classificado(s). Por favor, classifique os embriões antes de congelá-los.`,
        variant: 'destructive',
      });
      return;
    }

    // Validar que todos os embriões selecionados estão frescos
    const embrioesNaoFrescos = embrioes.filter(e => 
      embrioesParaCongelar.includes(e.id) && e.status_atual !== 'FRESCO'
    );

    if (embrioesNaoFrescos.length > 0) {
      toast({
        title: 'Erro de validação',
        description: `Apenas embriões frescos podem ser congelados. ${embrioesNaoFrescos.length} embrião(ões) selecionado(s) não está(ão) com status FRESCO.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      
      const updates = embrioesParaCongelar.map(embriaoId => {
        return supabase
          .from('embrioes')
          .update({
            status_atual: 'CONGELADO',
            data_congelamento: congelarData.data_congelamento,
            localizacao_atual: congelarData.localizacao_atual,
          })
          .eq('id', embriaoId);
      });

      await Promise.all(updates);

      // Registrar histórico para cada embrião
      for (const embriaoId of embrioesParaCongelar) {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (embriao) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            'CONGELADO',
            'CONGELAMENTO',
            null,
            `Localização: ${congelarData.localizacao_atual}`
          );
        }
      }

      toast({
        title: 'Embriões congelados',
        description: `${embrioesParaCongelar.length} embrião(ões) congelados com sucesso`,
      });

      setShowCongelarDialog(false);
      setCongelarData({
        data_congelamento: new Date().toISOString().split('T')[0],
        localizacao_atual: '',
      });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao congelar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDescartarEmMassa = async () => {
    if (embrioesSelecionados.size === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const embrioesParaDescartar = Array.from(embrioesSelecionados);
      
      const updates = embrioesParaDescartar.map(embriaoId => {
        return supabase
          .from('embrioes')
          .update({
            status_atual: 'DESCARTADO',
            data_descarte: descartarData.data_descarte,
          })
          .eq('id', embriaoId);
      });

      await Promise.all(updates);

      // Registrar histórico para cada embrião
      for (const embriaoId of embrioesParaDescartar) {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (embriao) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            'DESCARTADO',
            'DESCARTE',
            null,
            descartarData.observacoes || null
          );
        }
      }

      toast({
        title: 'Embriões descartados',
        description: `${embrioesParaDescartar.length} embrião(ões) descartados com sucesso`,
      });

      setShowDescartarDialog(false);
      setDescartarData({
        data_descarte: new Date().toISOString().split('T')[0],
        observacoes: '',
      });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao descartar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirecionarCliente = async () => {
    if (embrioesSelecionados.size === 0 || !direcionarClienteData.cliente_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião congelado e um cliente',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se os embriões selecionados estão congelados
    const embrioesSelecionadosArray = Array.from(embrioesSelecionados);
    const embrioesParaDirecionar = embrioes.filter(e => 
      embrioesSelecionadosArray.includes(e.id) && e.status_atual === 'CONGELADO'
    );

    if (embrioesParaDirecionar.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Apenas embriões congelados podem ser direcionados para clientes',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const embriaoIds = embrioesParaDirecionar.map(e => e.id);

      const updates = embriaoIds.map(embriaoId => {
        return supabase
          .from('embrioes')
          .update({
            cliente_id: direcionarClienteData.cliente_id,
          })
          .eq('id', embriaoId);
      });

      await Promise.all(updates);

      // Registrar histórico para cada embrião
      const cliente = clientes.find(c => c.id === direcionarClienteData.cliente_id);
      for (const embriaoId of embriaoIds) {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (embriao) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            embriao.status_atual,
            'DESTINACAO',
            null,
            `Direcionado para cliente: ${cliente?.nome || direcionarClienteData.cliente_id}`
          );
        }
      }

      toast({
        title: 'Embriões direcionados',
        description: `${embrioesParaDirecionar.length} embrião(ões) direcionado(s) para ${cliente?.nome || 'o cliente'} com sucesso`,
      });

      setShowDirecionarClienteDialog(false);
      setDirecionarClienteData({ cliente_id: '' });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao direcionar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistorico = async (embriaoId: string) => {
    try {
      setLoadingHistorico(true);

      const { data, error } = await supabase
        .from('historico_embrioes')
        .select('*')
        .eq('embriao_id', embriaoId)
        .order('data_mudanca', { ascending: false });

      if (error) throw error;
      setHistorico(data || []);
    } catch (error) {
      handleError(error, 'Erro ao carregar histórico');
    } finally {
      setLoadingHistorico(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque de Embriões"
        description="Gerenciar pacotes de embriões para transferência, congelamento ou descarte"
      />

      <Card>
        <CardHeader>
          <CardTitle>Pacotes de Embriões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <Label htmlFor="fazenda_destino">Filtrar por Fazenda Destino</Label>
            <Select
              value={selectedFazendaDestinoId || 'all'}
              onValueChange={(value) => setSelectedFazendaDestinoId(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Todas as fazendas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fazendas</SelectItem>
                {fazendas.map((fazenda) => (
                  <SelectItem key={fazenda.id} value={fazenda.id}>
                    {fazenda.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pacotes.length === 0 ? (
            <EmptyState
              title="Nenhum pacote de embriões encontrado"
              description="Selecione outra fazenda destino ou verifique se há pacotes disponíveis."
              action={
                selectedFazendaDestinoId ? (
                  <Button variant="outline" onClick={() => setSelectedFazendaDestinoId('')}>
                    Limpar filtro
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {pacotes.map((pacote) => {
                const expandido = pacotesExpandidos.has(pacote.id);
                const totalSelecionados = pacote.embrioes.filter(e => embrioesSelecionados.has(e.id)).length;
                const resumoPacote = getResumoPacote(pacote);
                // Usar data de fecundação para calcular o dia do embrião (D0 = dia da fecundação)
                const diaEmbriao = calcularDiaEmbriao(pacote.data_fecundacao);
                const isD8 = diaEmbriao === 8;
                const isD7 = diaEmbriao === 7;
                const isVencido = diaEmbriao !== null && diaEmbriao > 8;

                // Definir cor da borda baseada no dia
                let borderColor = 'border-l-green-500'; // Padrão
                if (isD8) borderColor = 'border-l-orange-500';
                if (isVencido) borderColor = 'border-l-red-500';

                return (
                  <Card key={pacote.id} className={`border-l-4 ${borderColor}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandirPacote(pacote.id)}
                              className="p-0 h-auto"
                            >
                              {expandido ? (
                                <ChevronUp className="w-5 h-5 text-slate-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-600" />
                              )}
                            </Button>
                            {/* Badge de dia do embrião */}
                            {diaEmbriao !== null && pacote.frescos > 0 && (
                              <>
                                {isD7 && (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    D7 - Ideal
                                  </Badge>
                                )}
                                {isD8 && (
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-300 animate-pulse">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    D8 - Último dia!
                                  </Badge>
                                )}
                                {isVencido && (
                                  <Badge className="bg-red-100 text-red-800 border-red-300">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    D{diaEmbriao} - Vencido
                                  </Badge>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">
                                {pacote.pacote_info.fazenda_nome || 'Fazenda não identificada'} →{' '}
                                {pacote.fazendas_destino_nomes && pacote.fazendas_destino_nomes.length > 0 ? (
                                  <span className="inline-flex flex-wrap gap-1 items-center">
                                    {pacote.fazendas_destino_nomes.map((nome, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {nome}
                                      </Badge>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sem destino</span>
                                )}
                              </CardTitle>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPacoteEditandoFazendas(pacote);
                                  setFazendasDestinoSelecionadas([...pacote.fazendas_destino_ids]);
                                  setShowEditarFazendasDestinoDialog(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Editar fazendas destino"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 ml-7 space-y-1 text-sm text-slate-600">
                            <p><strong>Data Despacho:</strong> {pacote.data_despacho ? formatDate(pacote.data_despacho) : '-'}</p>
                            {pacote.pacote_info.horario_inicio && (
                              <p><strong>Horário:</strong> {pacote.pacote_info.horario_inicio}</p>
                            )}
                            {pacote.pacote_info.veterinario_responsavel && (
                              <p><strong>Veterinário:</strong> {pacote.pacote_info.veterinario_responsavel}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">{pacote.total}</div>
                            <div className="text-sm text-slate-600">embriões</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {pacote.frescos} frescos, {pacote.congelados} congelados
                            </div>
                            <div className="text-xs text-slate-500">
                              {resumoPacote.semClassificacao} sem classificação
                            </div>
                            {resumoPacote.classificados.BE > 0 || resumoPacote.classificados.BN > 0 || resumoPacote.classificados.BX > 0 || resumoPacote.classificados.BL > 0 || resumoPacote.classificados.BI > 0 ? (
                              <div className="text-xs text-slate-500 mt-1">
                                BE: {resumoPacote.classificados.BE} | BN: {resumoPacote.classificados.BN} | BX: {resumoPacote.classificados.BX} | BL: {resumoPacote.classificados.BL} | BI: {resumoPacote.classificados.BI}
                              </div>
                            ) : null}
                          </div>
                          {/* Status de classificação e disponibilidade */}
                          <div className="flex flex-col items-end gap-2 min-w-[280px]">
                            {resumoPacote.todosClassificados ? (
                              <>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                  ✓ Todos classificados ({resumoPacote.total}/{resumoPacote.total})
                                </Badge>
                                {pacote.disponivel_para_transferencia ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                    Disponível para Transferência
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => despacharPacoteParaCampo(pacote)}
                                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                                  >
                                    Despachar para o campo
                                  </Button>
                                )}
                              </>
                            ) : resumoPacote.total > 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                Pendente: {resumoPacote.total - resumoPacote.semClassificacao}/{resumoPacote.total} classificados
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    {expandido && (
                      <CardContent>
                        {(() => {
                          // Ordenar embriões pela identificação (ex: SC-2401-001, SC-2401-002...)
                          const embrioesOrdenados = [...pacote.embrioes].sort((a, b) => {
                            const idA = a.identificacao || '';
                            const idB = b.identificacao || '';
                            // Se ambos têm identificação, ordenar alfabeticamente
                            if (idA && idB) {
                              return idA.localeCompare(idB);
                            }
                            // Embriões com identificação vêm primeiro
                            if (idA && !idB) return -1;
                            if (!idA && idB) return 1;
                            // Fallback: ordenar por doadora e data de criação
                            const doadoraA = a.doadora_registro || '';
                            const doadoraB = b.doadora_registro || '';
                            if (doadoraA !== doadoraB) {
                              return doadoraA.localeCompare(doadoraB);
                            }
                            const dataA = a.created_at || '';
                            const dataB = b.created_at || '';
                            return dataA.localeCompare(dataB);
                          });

                          const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / PAGE_SIZE));
                          const paginaAtual = Math.min(getPaginaPacote(pacote.id), totalPaginas);
                          const inicio = (paginaAtual - 1) * PAGE_SIZE;
                          const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + PAGE_SIZE);
                          const todosSelecionadosPagina = embrioesPagina.every(e => embrioesSelecionados.has(e.id));
                          const algunsSelecionadosPagina = embrioesPagina.some(e => embrioesSelecionados.has(e.id));

                          return (
                            <>
                              <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => selecionarTodosDaPagina(embrioesPagina)}
                                  >
                                    {todosSelecionadosPagina ? (
                                      <CheckSquare className="w-4 h-4 mr-2" />
                                    ) : (
                                      <Square className="w-4 h-4 mr-2" />
                                    )}
                                    {todosSelecionadosPagina ? 'Desmarcar Página' : 'Selecionar Página'}
                                  </Button>
                                  <span className="text-sm text-slate-600">
                                    {algunsSelecionadosPagina && `${embrioesPagina.filter(e => embrioesSelecionados.has(e.id)).length} selecionado(s) na página`}
                                    {!algunsSelecionadosPagina && totalSelecionados > 0 && `${totalSelecionados} selecionado(s) no pacote`}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-600">
                                  Página {paginaAtual} de {totalPaginas}
                                </div>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead className="text-center w-28">Código</TableHead>
                                    <TableHead>Doadora</TableHead>
                                    <TableHead>Touro</TableHead>
                                    <TableHead>Classificação</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Localização</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {embrioesPagina.map((embriao, index) => {
                                    const selecionado = embrioesSelecionados.has(embriao.id);
                                    return (
                                      <TableRow key={embriao.id}>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="p-0 h-auto"
                                            onClick={() => toggleSelecionarEmbriao(embriao.id)}
                                          >
                                            {selecionado ? (
                                              <CheckSquare className="w-4 h-4 text-green-600" />
                                            ) : (
                                              <Square className="w-4 h-4 text-slate-400" />
                                            )}
                                          </Button>
                                        </TableCell>
                                        <TableCell className="text-center font-medium font-mono text-xs">
                                          {embriao.identificacao || `#${inicio + index + 1}`}
                                        </TableCell>
                                        <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                                        <TableCell>{embriao.touro_nome || '-'}</TableCell>
                                        <TableCell>
                                  {getClassificacaoAtual(embriao) ? (
                                    <Badge variant="outline">{getClassificacaoAtual(embriao)}</Badge>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <StatusBadge status={embriao.status_atual} />
                                        </TableCell>
                                        <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex gap-1 justify-end">
                                    {!getClassificacaoAtual(embriao) && embriao.status_atual === 'FRESCO' && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setClassificarEmbriao(embriao);
                                                  setClassificarData({ classificacao: '' });
                                                  setShowClassificarDialog(true);
                                                }}
                                                title="Classificar"
                                              >
                                                <Tag className="w-4 h-4 text-purple-600" />
                                              </Button>
                                            )}
                                    {getClassificacaoAtual(embriao) && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setClassificarEmbriao(embriao);
                                          setClassificarData({ classificacao: getClassificacaoAtual(embriao) });
                                                  setShowClassificarDialog(true);
                                                }}
                                                title="Editar Classificação"
                                              >
                                                <Tag className="w-4 h-4 text-purple-600" />
                                              </Button>
                                            )}
                                            {embriao.status_atual === 'FRESCO' && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                              // Verificar se está classificado antes de permitir congelar
                                      if (!getClassificacaoAtual(embriao)) {
                                                toast({
                                                  title: 'Classificação obrigatória',
                                                  description: 'É necessário classificar o embrião antes de congelá-lo. Por favor, classifique o embrião primeiro.',
                                                  variant: 'destructive',
                                                });
                                                return;
                                              }
                                              setShowCongelarDialog(true);
                                              setEmbrioesSelecionados(new Set([embriao.id]));
                                            }}
                                    title={getClassificacaoAtual(embriao) ? "Congelar" : "Classifique antes de congelar"}
                                    disabled={!getClassificacaoAtual(embriao)}
                                          >
                                    <Snowflake className={getClassificacaoAtual(embriao) ? "w-4 h-4 text-blue-600" : "w-4 h-4 text-slate-400"} />
                                          </Button>
                                        )}
                                        {embriao.status_atual === 'CONGELADO' && !embriao.cliente_id && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setShowDirecionarClienteDialog(true);
                                              setEmbrioesSelecionados(new Set([embriao.id]));
                                              setDirecionarClienteData({ cliente_id: '' });
                                            }}
                                            title="Direcionar para Cliente"
                                          >
                                            <User className="w-4 h-4 text-green-600" />
                                          </Button>
                                        )}
                                        {(embriao.status_atual === 'FRESCO' || embriao.status_atual === 'CONGELADO') && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setDescartarEmbriao(embriao);
                                              setDescartarData({
                                                data_descarte: new Date().toISOString().split('T')[0],
                                                observacoes: '',
                                              });
                                              setShowDescartarDialog(true);
                                            }}
                                            title="Descartar"
                                          >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={async () => {
                                            setHistoricoEmbriao(embriao);
                                            setShowHistoricoDialog(true);
                                            await loadHistorico(embriao.id);
                                          }}
                                          title="Ver Histórico"
                                        >
                                          <History className="w-4 h-4 text-slate-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                          <div className="mt-4 flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                              {embrioesOrdenados.length} embriões no pacote
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPaginaPacote(pacote.id, Math.max(1, paginaAtual - 1))}
                                disabled={paginaAtual === 1}
                              >
                                Anterior
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPaginaPacote(pacote.id, Math.min(totalPaginas, paginaAtual + 1))}
                                disabled={paginaAtual === totalPaginas}
                              >
                                Próxima
                              </Button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Barra de ações em massa */}
          {showAcoesEmMassa && (
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-600" />
                <span className="font-medium text-slate-900">
                  {embrioesSelecionados.size} embrião(ões) selecionado(s)
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClassificarData({ classificacao: '' });
                    setShowClassificarDialog(true);
                  }}
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Classificar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Verificar se todos os embriões selecionados estão classificados
                    const embrioesSemClassificacao = Array.from(embrioesSelecionados).filter(id => {
                      const embriao = embrioes.find(e => e.id === id);
                      return !embriao || !getClassificacaoAtual(embriao);
                    });

                    if (embrioesSemClassificacao.length > 0) {
                      toast({
                        title: 'Classificação obrigatória',
                        description: `Não é possível congelar embriões sem classificação. ${embrioesSemClassificacao.length} embrião(ões) selecionado(s) não está(ão) classificado(s). Por favor, classifique os embriões antes de congelá-los.`,
                        variant: 'destructive',
                      });
                      return;
                    }

                    // Verificar se todos são frescos
                    const embrioesNaoFrescos = Array.from(embrioesSelecionados).filter(id => {
                      const embriao = embrioes.find(e => e.id === id);
                      return !embriao || embriao.status_atual !== 'FRESCO';
                    });

                    if (embrioesNaoFrescos.length > 0) {
                      toast({
                        title: 'Erro de validação',
                        description: `Apenas embriões frescos podem ser congelados. ${embrioesNaoFrescos.length} embrião(ões) selecionado(s) não está(ão) com status FRESCO.`,
                        variant: 'destructive',
                      });
                      return;
                    }

                    setCongelarData({
                      data_congelamento: new Date().toISOString().split('T')[0],
                      localizacao_atual: '',
                    });
                    setShowCongelarDialog(true);
                  }}
                >
                  <Snowflake className="w-4 h-4 mr-2" />
                  Congelar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDirecionarClienteData({ cliente_id: '' });
                    setShowDirecionarClienteDialog(true);
                  }}
                  disabled={!Array.from(embrioesSelecionados).some(id => {
                    const embriao = embrioes.find(e => e.id === id);
                    return embriao?.status_atual === 'CONGELADO';
                  })}
                  title="Apenas embriões congelados podem ser direcionados para clientes"
                >
                  <User className="w-4 h-4 mr-2" />
                  Direcionar para Cliente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDescartarData({
                      data_descarte: new Date().toISOString().split('T')[0],
                      observacoes: '',
                    });
                    setShowDescartarDialog(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Descartar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmbrioesSelecionados(new Set());
                    setShowAcoesEmMassa(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Classificação Individual */}
      <Dialog open={showClassificarDialog && !!classificarEmbriao} onOpenChange={(open) => {
        if (!open) {
          setShowClassificarDialog(false);
          setClassificarEmbriao(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar Embrião</DialogTitle>
            <DialogDescription>
              Classificar embrião {classificarEmbriao?.identificacao || 'selecionado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classificacao">Classificação *</Label>
              <Select
                value={classificarData.classificacao}
                onValueChange={(value) => setClassificarData({ classificacao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BE">BE (Blastocisto Excelente)</SelectItem>
                  <SelectItem value="BN">BN (Blastocisto Normal)</SelectItem>
                  <SelectItem value="BX">BX (Blastocisto Regular)</SelectItem>
                  <SelectItem value="BL">BL (Blastocisto Limitado)</SelectItem>
                  <SelectItem value="BI">BI (Blastocisto Irregular)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleClassificar()}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Classificação'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowClassificarDialog(false);
                  setClassificarEmbriao(null);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Classificação em Massa */}
      <Dialog open={showClassificarDialog && !classificarEmbriao && embrioesSelecionados.size > 0} onOpenChange={(open) => {
        if (!open) {
          setShowClassificarDialog(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>
              Classificar todos os embriões selecionados com a mesma classificação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classificacao">Classificação *</Label>
              <Select
                value={classificarData.classificacao}
                onValueChange={(value) => setClassificarData({ classificacao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BE">BE (Blastocisto Excelente)</SelectItem>
                  <SelectItem value="BN">BN (Blastocisto Normal)</SelectItem>
                  <SelectItem value="BX">BX (Blastocisto Regular)</SelectItem>
                  <SelectItem value="BL">BL (Blastocisto Limitado)</SelectItem>
                  <SelectItem value="BI">BI (Blastocisto Irregular)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleClassificarEmMassa}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : `Classificar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowClassificarDialog(false);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Congelamento em Massa */}
      <Dialog open={showCongelarDialog} onOpenChange={setShowCongelarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Congelar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>
              Registrar congelamento dos embriões selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data_congelamento">Data de Congelamento *</Label>
              <DatePickerBR
                id="data_congelamento"
                value={congelarData.data_congelamento}
                onChange={(value) =>
                  setCongelarData({ ...congelarData, data_congelamento: value || '' })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="localizacao_atual">Localização (Botijão) *</Label>
              <Input
                id="localizacao_atual"
                value={congelarData.localizacao_atual}
                onChange={(e) =>
                  setCongelarData({ ...congelarData, localizacao_atual: e.target.value })
                }
                placeholder="Ex: Botijão 1, Canister A"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCongelarEmMassa}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Congelando...' : `Congelar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCongelarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Descarte em Massa */}
      <Dialog open={showDescartarDialog} onOpenChange={setShowDescartarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>
              Descartar os embriões selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data_descarte">Data de Descarte *</Label>
              <DatePickerBR
                id="data_descarte"
                value={descartarData.data_descarte}
                onChange={(value) =>
                  setDescartarData({ ...descartarData, data_descarte: value || '' })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações / Motivo</Label>
              <Textarea
                id="observacoes"
                value={descartarData.observacoes}
                onChange={(e) =>
                  setDescartarData({ ...descartarData, observacoes: e.target.value })
                }
                placeholder="Informe o motivo do descarte (opcional)"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleDescartarEmMassa}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? 'Descartando...' : `Descartar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDescartarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Direcionar para Cliente */}
      <Dialog open={showDirecionarClienteDialog} onOpenChange={setShowDirecionarClienteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Direcionar {embrioesSelecionados.size} Embrião(ões) Congelado(s) para Cliente</DialogTitle>
            <DialogDescription>
              Direcionar embriões congelados selecionados para o estoque de um cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cliente_id">Cliente *</Label>
              <Select
                value={direcionarClienteData.cliente_id}
                onValueChange={(value) => setDirecionarClienteData({ cliente_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleDirecionarCliente}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Direcionando...' : `Direcionar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDirecionarClienteDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico Dialog */}
      <Sheet open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Histórico do Embrião</SheetTitle>
            <SheetDescription>
              Histórico completo de eventos do embrião{' '}
              {historicoEmbriao?.identificacao || historicoEmbriao?.id.slice(0, 8)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {loadingHistorico ? (
              <LoadingSpinner />
            ) : historico.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum histórico encontrado</p>
            ) : (
              <div className="space-y-4">
                {historico.map((item) => {
                  const tipoOperacaoMap: Record<string, string> = {
                    CLASSIFICACAO: 'Classificação',
                    DESTINACAO: 'Destinação',
                    CONGELAMENTO: 'Congelamento',
                    DESCARTE: 'Descarte',
                    TRANSFERENCIA: 'Transferência',
                  };

                  return (
                    <Card key={item.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{tipoOperacaoMap[item.tipo_operacao] || item.tipo_operacao}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              {item.data_mudanca ? formatDate(item.data_mudanca) : '-'}
                            </p>
                            {item.observacoes && (
                              <p className="text-sm text-slate-500 mt-1">{item.observacoes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <StatusBadge status={item.status_novo || ''} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog para editar fazendas destino do pacote */}
      <Dialog open={showEditarFazendasDestinoDialog} onOpenChange={setShowEditarFazendasDestinoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Fazendas Destino</DialogTitle>
            <DialogDescription>
              Selecione as fazendas destino para este pacote de embriões.
            </DialogDescription>
          </DialogHeader>
          
          {pacoteEditandoFazendas && (
            <div className="space-y-4">
              <div>
                <Label>Pacote</Label>
                <p className="text-sm text-slate-600 mt-1">
                  {pacoteEditandoFazendas.pacote_info.fazenda_nome || 'Fazenda não identificada'} → 
                  {pacoteEditandoFazendas.data_despacho ? ` ${formatDate(pacoteEditandoFazendas.data_despacho)}` : ''}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Fazendas Destino</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                  {fazendas.map((fazenda) => (
                    <label key={fazenda.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={fazendasDestinoSelecionadas.includes(fazenda.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFazendasDestinoSelecionadas([...fazendasDestinoSelecionadas, fazenda.id]);
                          } else {
                            setFazendasDestinoSelecionadas(
                              fazendasDestinoSelecionadas.filter(id => id !== fazenda.id)
                            );
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm">{fazenda.nome}</span>
                    </label>
                  ))}
                </div>
                {fazendas.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Nenhuma fazenda disponível
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditarFazendasDestinoDialog(false);
                setPacoteEditandoFazendas(null);
                setFazendasDestinoSelecionadas([]);
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarFazendasDestino}
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
