import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import { ArrowRightLeft, Package, AlertTriangle, FileText, X, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import { formatDate } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import DatePickerBR from '@/components/shared/DatePickerBR';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Fazenda {
  id: string;
  nome: string;
}

interface Cliente {
  id: string;
  nome: string;
}

interface ReceptoraSincronizada {
  receptora_id: string;
  brinco: string;
  protocolo_id?: string;
  protocolo_receptora_id?: string;
  pr_id?: string;
  identificacao?: string;
  data_te_prevista?: string;
  data_limite_te?: string;
  quantidade_embrioes?: number; // Quantidade de embriões já transferidos nesta receptora
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
  origem?: 'PROTOCOLO' | 'CIO_LIVRE';
  data_cio?: string;
  status_reprodutivo?: string | null;
}

interface EmbrioCompleto {
  id: string;
  identificacao?: string;
  classificacao?: string;
  status_atual: string;
  localizacao_atual?: string;
  doadora_registro?: string;
  touro_nome?: string;
  doadora_raca?: string;
  touro_raca?: string;
  cliente_nome?: string;
  d7_pronto?: boolean;
  d8_limite?: boolean;
  created_at?: string;
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
  id: string;
  lote_fiv_id: string;
  data_despacho: string;
  fazendas_destino_ids: string[];
  fazendas_destino_nomes: string[];
  pacote_info: PacoteAspiracaoInfo;
  embrioes: EmbrioCompleto[];
  total: number;
  frescos: number;
  congelados: number;
}

type SessaoTransferenciaStorage = {
  fazenda_id?: string;
  pacote_id?: string;
  data_passo2?: string;
  data_te?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  transferenciasIdsSessao?: string[];
  transferenciasSessao?: string[];
  embrioes_page?: number;
  origem_embriao?: 'PACOTE' | 'CONGELADO';
  filtro_cliente_id?: string;
  filtro_raca?: string;
  incluir_cio_livre?: boolean;
};

type RelatorioTransferenciaItem = {
  numero_embriao: string;
  doadora: string;
  touro: string;
  classificacao: string;
  receptora_brinco: string;
  receptora_nome: string;
  data_te?: string | null;
  veterinario: string;
  tecnico: string;
  observacoes?: string;
};

type TransferenciaRelatorioData = {
  embrioes?: {
    lote_fiv_acasalamento_id?: string | null;
    classificacao?: string | null;
  } | null;
  receptoras?: {
    identificacao?: string | null;
    nome?: string | null;
  } | null;
  data_te?: string | null;
  veterinario_responsavel?: string | null;
  tecnico_responsavel?: string | null;
  observacoes?: string | null;
  embriao_id?: string | null;
};

type DoseComTouro = {
  id: string;
  touro?: {
    nome?: string | null;
    raca?: string | null;
  } | Array<{
    nome?: string | null;
    raca?: string | null;
  }> | null;
};

type EmbriaoComLote = {
  lote_fiv_id?: string | null;
};

export default function TransferenciaEmbrioes() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pacotes, setPacotes] = useState<PacoteEmbrioes[]>([]);
  const [pacotesFiltrados, setPacotesFiltrados] = useState<PacoteEmbrioes[]>([]);
  const [embrioesCongelados, setEmbrioesCongelados] = useState<EmbrioCompleto[]>([]);
  const [loadingCongelados, setLoadingCongelados] = useState(false);
  const [receptoras, setReceptoras] = useState<ReceptoraSincronizada[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transferenciasSessao, setTransferenciasSessao] = useState<string[]>([]); // IDs dos protocolos_receptoras da sessão atual
  const [transferenciasIdsSessao, setTransferenciasIdsSessao] = useState<string[]>([]); // IDs das transferências_embrioes da sessão atual
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [relatorioData, setRelatorioData] = useState<RelatorioTransferenciaItem[]>([]);
  const [isVisualizacaoApenas, setIsVisualizacaoApenas] = useState(false);
  const [embrioesPage, setEmbrioesPage] = useState(1);
  const [origemEmbriao, setOrigemEmbriao] = useState<'PACOTE' | 'CONGELADO'>('PACOTE');
  const [filtroClienteId, setFiltroClienteId] = useState('');
  const [filtroRaca, setFiltroRaca] = useState('');
  const [dataPasso2, setDataPasso2] = useState(new Date().toISOString().split('T')[0]);
  const [incluirCioLivre, setIncluirCioLivre] = useState(false);
  const [contagemSessaoPorReceptora, setContagemSessaoPorReceptora] = useState<Record<string, number>>({});
  const [receptorasSessaoInfo, setReceptorasSessaoInfo] = useState<Record<string, ReceptoraSincronizada>>({});
  const { toast } = useToast();
  const AUTO_RESTORE_SESSAO = true;
  const EMBRIOES_PAGE_SIZE = 20;

  const [formData, setFormData] = useState({
    fazenda_id: '',
    pacote_id: '',
    protocolo_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: new Date().toISOString().split('T')[0],
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  // Estado para manter os campos do pacote após registrar transferência
  const [camposPacote, setCamposPacote] = useState({
    data_te: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Função para salvar estado da sessão no banco
  const salvarEstadoSessao = () => {
    const estadoSessao = {
      fazenda_id: formData.fazenda_id,
      pacote_id: formData.pacote_id,
      data_passo2: dataPasso2,
      data_te: formData.data_te,
      veterinario_responsavel: formData.veterinario_responsavel,
      tecnico_responsavel: formData.tecnico_responsavel,
      origem_embriao: origemEmbriao,
      filtro_cliente_id: filtroClienteId,
      filtro_raca: filtroRaca,
      incluir_cio_livre: incluirCioLivre,
      transferenciasSessao,
      transferenciasIdsSessao,
      embrioes_page: embrioesPage,
    };
    void salvarSessaoNoBanco(estadoSessao);
  };

  const salvarSessaoNoBanco = async (estadoSessao: SessaoTransferenciaStorage) => {
    if (!estadoSessao.fazenda_id) return;
    const temTransferencias =
      (estadoSessao.transferenciasIdsSessao?.length || 0) > 0 ||
      (estadoSessao.transferenciasSessao?.length || 0) > 0;
    if (!temTransferencias) return;

    const payload = {
      fazenda_id: estadoSessao.fazenda_id,
      pacote_id: estadoSessao.pacote_id || null,
      data_passo2: estadoSessao.data_passo2 || null,
      data_te: estadoSessao.data_te || null,
      veterinario_responsavel: estadoSessao.veterinario_responsavel || null,
      tecnico_responsavel: estadoSessao.tecnico_responsavel || null,
      origem_embriao: estadoSessao.origem_embriao || null,
      filtro_cliente_id: estadoSessao.filtro_cliente_id || null,
      filtro_raca: estadoSessao.filtro_raca || null,
      incluir_cio_livre: !!estadoSessao.incluir_cio_livre,
      transferencias_ids: estadoSessao.transferenciasIdsSessao || [],
      protocolo_receptora_ids: estadoSessao.transferenciasSessao || [],
      status: 'ABERTA',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('transferencias_sessoes')
      .upsert(payload, { onConflict: 'fazenda_id,status' });
    if (error && error.code !== 'PGRST205') {
      console.error('Erro ao salvar sessão de TE no banco:', error);
    }
  };

  const encerrarSessaoNoBanco = async (fazendaId?: string) => {
    if (!fazendaId) return;
    const { error } = await supabase
      .from('transferencias_sessoes')
      .update({ status: 'ENCERRADA', updated_at: new Date().toISOString() })
      .eq('fazenda_id', fazendaId)
      .eq('status', 'ABERTA');
    if (error && error.code !== 'PGRST205') {
      console.error('Erro ao encerrar sessão no banco:', error);
    }
  };

  const aplicarSessaoPersistida = (sessao: any) => {
    const transferenciasIds = Array.isArray(sessao?.transferencias_ids)
      ? sessao.transferencias_ids
      : [];
    const protocoloReceptoraIds = Array.isArray(sessao?.protocolo_receptora_ids)
      ? sessao.protocolo_receptora_ids
      : [];
    const origem = sessao?.origem_embriao === 'CONGELADO' ? 'CONGELADO' : 'PACOTE';
    const dataTe = sessao?.data_te || new Date().toISOString().split('T')[0];

    setTransferenciasIdsSessao(transferenciasIds);
    setTransferenciasSessao(protocoloReceptoraIds);
    setOrigemEmbriao(origem);
    setFiltroClienteId(sessao?.filtro_cliente_id || '');
    setFiltroRaca(sessao?.filtro_raca || '');
    setDataPasso2(sessao?.data_passo2 || new Date().toISOString().split('T')[0]);
    setIncluirCioLivre(!!sessao?.incluir_cio_livre);
    setCamposPacote({
      data_te: dataTe,
      veterinario_responsavel: sessao?.veterinario_responsavel || '',
      tecnico_responsavel: sessao?.tecnico_responsavel || '',
    });
    setFormData((prev) => ({
      ...prev,
      fazenda_id: sessao?.fazenda_id || '',
      pacote_id: sessao?.pacote_id || '',
      protocolo_id: sessao?.protocolo_id || '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
      data_te: dataTe,
      veterinario_responsavel: sessao?.veterinario_responsavel || '',
      tecnico_responsavel: sessao?.tecnico_responsavel || '',
      observacoes: '',
    }));

  };

  // Função para buscar transferências não finalizadas e restaurar sessão (silenciosamente)
  const restaurarSessaoEmAndamento = async () => {
    try {
      if (!AUTO_RESTORE_SESSAO) {        return false;
      }
      // Priorizar sessão persistida no banco
      const { data: sessoesData, error: sessoesError } = await supabase
        .from('transferencias_sessoes')
        .select('*')
        .eq('status', 'ABERTA')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (sessoesError && sessoesError.code !== 'PGRST205') {
        console.error('Erro ao restaurar sessão do banco:', sessoesError);
      }
      if (sessoesData && sessoesData.length > 0) {
        const sessao = sessoesData[0];
        const transferenciasIds = Array.isArray(sessao?.transferencias_ids)
          ? sessao.transferencias_ids
          : [];
        let protocoloReceptoraIds = Array.isArray(sessao?.protocolo_receptora_ids)
          ? sessao.protocolo_receptora_ids
          : [];

        if (protocoloReceptoraIds.length === 0 && transferenciasIds.length > 0) {
          const { data: transferenciasSessaoData, error: transferenciasSessaoError } = await supabase
            .from('transferencias_embrioes')
            .select('protocolo_receptora_id')
            .in('id', transferenciasIds);
          if (!transferenciasSessaoError && transferenciasSessaoData) {
            protocoloReceptoraIds = [...new Set(
              transferenciasSessaoData
                .map(t => t.protocolo_receptora_id)
                .filter((id): id is string => !!id)
            )];
          }
        }

        let temProtocolosAtivos = false;
        if (protocoloReceptoraIds.length > 0) {
          const { data: protocolosData, error: protocolosError } = await supabase
            .from('protocolo_receptoras')
            .select('id, status')
            .in('id', protocoloReceptoraIds);
          if (!protocolosError && protocolosData) {
            temProtocolosAtivos = protocolosData.some(p => p.status !== 'UTILIZADA');
          }
        }

        if (!temProtocolosAtivos) {
          await supabase
            .from('transferencias_sessoes')
            .update({ status: 'ENCERRADA', updated_at: new Date().toISOString() })
            .eq('id', sessao.id);
          return false;
        }

        aplicarSessaoPersistida(sessao);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao restaurar sessão em andamento:', error);
      return false;
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      await Promise.all([loadFazendas(), loadPacotes(), loadClientes()]);
      
      if (AUTO_RESTORE_SESSAO) {
        await restaurarSessaoEmAndamento();
      }
    };
    
    carregarDados();
  }, []);

  // Salvar estado quando mudar
  useEffect(() => {
    if (formData.fazenda_id || formData.pacote_id || transferenciasIdsSessao.length > 0) {
      salvarEstadoSessao();
    }
  }, [formData.fazenda_id, formData.pacote_id, formData.protocolo_id, formData.data_te, formData.veterinario_responsavel, formData.tecnico_responsavel, origemEmbriao, filtroClienteId, filtroRaca, dataPasso2, incluirCioLivre, transferenciasSessao.length, transferenciasIdsSessao.length, embrioesPage]);

  useEffect(() => {
    void loadFazendas();
  }, [dataPasso2]);

  useEffect(() => {
    // Filtrar pacotes quando a fazenda mudar
    if (formData.fazenda_id) {
      const filtrados = pacotes.filter(pacote =>
        pacote.fazendas_destino_ids.includes(formData.fazenda_id)
      );
      setPacotesFiltrados(filtrados);
    } else {
      setPacotesFiltrados([]);
    }
  }, [formData.fazenda_id, pacotes]);

  useEffect(() => {
    if (formData.fazenda_id && dataPasso2) {
      carregarReceptorasDaFazenda(formData.fazenda_id);
    }
  }, [formData.fazenda_id, dataPasso2, incluirCioLivre]);

  useEffect(() => {
    const carregarContagemSessao = async () => {
      if (transferenciasIdsSessao.length === 0) {
        setContagemSessaoPorReceptora({});
        setReceptorasSessaoInfo({});
        return;
      }
      const { data, error } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, protocolo_receptora_id, receptoras(id, identificacao, status_reprodutivo)')
        .in('id', transferenciasIdsSessao);
      if (error) {
        console.error('Erro ao reconstruir contagem da sessão:', error);
        return;
      }
      const contagem: Record<string, number> = {};
      const info: Record<string, ReceptoraSincronizada> = {};
      (data || []).forEach((item: any) => {
        if (!item.receptora_id) return;
        contagem[item.receptora_id] = (contagem[item.receptora_id] || 0) + 1;
        const receptora = Array.isArray(item.receptoras) ? item.receptoras[0] : item.receptoras;
        info[item.receptora_id] = {
          receptora_id: item.receptora_id,
          brinco: receptora?.identificacao || 'N/A',
          identificacao: receptora?.identificacao || '',
          protocolo_id: undefined,
          protocolo_receptora_id: item.protocolo_receptora_id || '',
          quantidade_embrioes: contagem[item.receptora_id],
          origem: item.protocolo_receptora_id ? 'PROTOCOLO' : 'CIO_LIVRE',
          status_reprodutivo: receptora?.status_reprodutivo || 'SERVIDA',
        };
      });
      setContagemSessaoPorReceptora(contagem);
      setReceptorasSessaoInfo(info);
    };
    void carregarContagemSessao();
  }, [transferenciasIdsSessao]);

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClientes([]);
    }
  };

  const loadFazendas = async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TransferenciaEmbrioes.tsx:loadFazendas:entry',message:'entrada loadFazendas',data:{dataPasso2,hasDataPasso2:!!dataPasso2},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (!dataPasso2) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TransferenciaEmbrioes.tsx:loadFazendas:noData',message:'sem dataPasso2, limpando fazendas',data:{dataPasso2},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        setFazendas([]);
        setLoading(false);
        return;
      }

      const { data: protocolosData, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('id')
        .eq('passo2_data', dataPasso2);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TransferenciaEmbrioes.tsx:loadFazendas:statusData',message:'resultado protocolos_sincronizacao',data:{hasError:!!protocolosError,errorCode:protocolosError?.code||null,errorMsg:protocolosError?.message||null,count:protocolosData?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      if (protocolosError) throw protocolosError;

      const protocoloIds = [...new Set((protocolosData || []).map(p => p.id).filter(Boolean))];
      if (protocoloIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
      }

      const { data: statusData, error: statusError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('receptora_id')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('protocolo_id', protocoloIds);
      if (statusError) throw statusError;

      const receptoraIds = [...new Set((statusData || []).map(s => s.receptora_id).filter(Boolean))];
      if (receptoraIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
      }

      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('fazenda_id_atual')
        .in('receptora_id', receptoraIds);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TransferenciaEmbrioes.tsx:loadFazendas:viewData',message:'resultado view fazenda atual',data:{hasError:!!viewError,errorCode:viewError?.code||null,errorMsg:viewError?.message||null,count:viewData?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      if (viewError) throw viewError;

      const fazendaIds = [...new Set((viewData || []).map(v => v.fazenda_id_atual).filter(Boolean))];
      if (fazendaIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
      }

      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', fazendaIds)
        .order('nome', { ascending: true });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TransferenciaEmbrioes.tsx:loadFazendas:fazendas',message:'resultado fazendas',data:{hasError:!!fazendasError,errorCode:fazendasError?.code||null,errorMsg:fazendasError?.message||null,count:fazendasData?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      if (fazendasError) throw fazendasError;

      setFazendas(fazendasData || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TransferenciaEmbrioes.tsx:loadFazendas:catch',message:'erro ao carregar fazendas',data:{errorMsg:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const loadPacotes = async () => {
    try {
      const t0 = performance.now();
      const { error: descarteError } = await supabase.rpc('descartar_embrioes_d9');
      if (descarteError) {
        if (descarteError.code !== 'PGRST202') {
          console.warn('Aviso ao descartar embriões D9:', descarteError.message || descarteError);
        }
      }
      // Buscar embriões FRESCOS disponíveis para transferência (pacotes)
      // Embriões congelados são carregados em fluxo separado
      // 
      // Buscar IDs de embriões já transferidos e embriões disponíveis em paralelo
      const [transferenciasResult, frescosResult] = await Promise.all([
        supabase
          .from('transferencias_embrioes')
          .select('embriao_id'),
        supabase
          .from('embrioes')
          .select('*')
          .eq('status_atual', 'FRESCO')
          .order('created_at', { ascending: false }),
      ]);

      const embrioesTransferidosIds = transferenciasResult.data?.map(t => t.embriao_id) || [];

      if (frescosResult.error) throw frescosResult.error;

      // Combinar os resultados e excluir embriões já transferidos ou com status TRANSFERIDO
      const embrioesData = [
        ...(frescosResult.data || [])
      ]
      .filter(e => !embrioesTransferidosIds.includes(e.id) && e.status_atual !== 'TRANSFERIDO')
      .sort((a, b) => {
        // Ordenar por data de criação (mais recentes primeiro)
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      if (!embrioesData || embrioesData.length === 0) {
        setPacotes([]);
        return;
      }

      const disponibilidadeIds = embrioesData.map(e => e.id);
      let disponibilidadeMap = new Map<string, { d7_pronto?: boolean; d8_limite?: boolean }>();
      if (disponibilidadeIds.length > 0) {
        const { data: disponibilidadeData, error: disponibilidadeError } = await supabase
          .from('v_embrioes_disponiveis_te')
          .select('embriao_id, d7_pronto, d8_limite')
          .in('embriao_id', disponibilidadeIds);
        if (!disponibilidadeError && disponibilidadeData) {
          disponibilidadeMap = new Map(
            disponibilidadeData.map(d => [d.embriao_id, { d7_pronto: d.d7_pronto, d8_limite: d.d8_limite }])
          );
        }
      }

      const loteFivIds = [
        ...new Set(embrioesData.filter((e) => e.lote_fiv_id).map((e) => e.lote_fiv_id)),
      ] as string[];

      let pacotesAspiracaoMap = new Map<string, PacoteAspiracaoInfo>();
      let pacoteParaLoteMap = new Map<string, string>();
      let fazendasDestinoPorPacoteMap = new Map<string, string[]>();
      let fazendasMap = new Map<string, string>(); // Mapa global de fazendas

      // Buscar todas as fazendas de uma vez
      const { data: todasFazendasData } = await supabase
        .from('fazendas')
        .select('id, nome');

      if (todasFazendasData) {
        fazendasMap = new Map(todasFazendasData.map((f) => [f.id, f.nome]));
      }

      if (loteFivIds.length > 0) {
        const { data: lotesFivData, error: lotesFivError } = await supabase
          .from('lotes_fiv')
          .select('id, pacote_aspiracao_id')
          .in('id', loteFivIds);

        if (!lotesFivError && lotesFivData) {
          lotesFivData.forEach(lote => {
            if (lote.pacote_aspiracao_id) {
              pacoteParaLoteMap.set(lote.id, lote.pacote_aspiracao_id);
            }
          });

          const pacoteIds = [...new Set(lotesFivData.map((l) => l.pacote_aspiracao_id).filter(Boolean))] as string[];

          if (pacoteIds.length > 0) {
            const { data: pacotesData, error: pacotesError } = await supabase
              .from('pacotes_aspiracao')
              .select('*')
              .in('id', pacoteIds);

            if (!pacotesError && pacotesData) {
              // Buscar fazendas destino dos pacotes
              const { data: fazendasDestinoData } = await supabase
                .from('pacotes_aspiracao_fazendas_destino')
                .select('pacote_aspiracao_id, fazenda_destino_id')
                .in('pacote_aspiracao_id', pacoteIds);

              if (fazendasDestinoData) {
                fazendasDestinoData.forEach(item => {
                  const atual = fazendasDestinoPorPacoteMap.get(item.pacote_aspiracao_id) || [];
                  if (!atual.includes(item.fazenda_destino_id)) {
                    atual.push(item.fazenda_destino_id);
                  }
                  fazendasDestinoPorPacoteMap.set(item.pacote_aspiracao_id, atual);
                });
              }

              pacotesData.forEach(pacote => {
                if (pacote.fazenda_destino_id) {
                  const atual = fazendasDestinoPorPacoteMap.get(pacote.id) || [];
                  if (!atual.includes(pacote.fazenda_destino_id)) {
                    atual.push(pacote.fazenda_destino_id);
                  }
                  fazendasDestinoPorPacoteMap.set(pacote.id, atual);
                }

                pacotesAspiracaoMap.set(pacote.id, {
                  id: pacote.id,
                  data_aspiracao: pacote.data_aspiracao,
                  fazenda_nome: fazendasMap.get(pacote.fazenda_id),
                  quantidade_doadoras: 0,
                  horario_inicio: pacote.horario_inicio,
                  veterinario_responsavel: pacote.veterinario_responsavel,
                  total_oocitos: pacote.total_oocitos,
                });
              });
            }
          }
        }
      }

      // Buscar doadoras e touros para enriquecer os embriões
      const acasalamentoIds = embrioesData
        .map(e => e.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);
      
      let acasalamentosMap = new Map();
      let doadorasMap = new Map<string, string>();
      let dosesMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);

        if (acasalamentosData) {
          acasalamentosMap = new Map(acasalamentosData.map((a) => [a.id, a]));

          const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
          const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id).filter(Boolean))];

          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  doadorasMap = new Map(doadorasData.map((d) => [d.id, d.registro]));
                  
                  // Criar mapa aspiracao -> doadora
                  const aspiracaoDoadoraMap = new Map(
                    aspiracoesData.map(a => [a.id, a.doadora_id])
                  );
                  
                  // Criar mapa acasalamento -> doadora através da aspiração
                  acasalamentosData.forEach(ac => {
                    if (ac.aspiracao_doadora_id) {
                      const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
                      if (doadoraId) {
                        const registro = doadorasMap.get(doadoraId);
                        if (registro) {
                          acasalamentosMap.set(ac.id, {
                            ...ac,
                            doadora_registro: registro,
                          });
                        }
                      }
                    }
                  });
                }
              }
            }
          }

          if (doseIds.length > 0) {
            // Buscar doses com informações do touro relacionado
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select(`
                id,
                touro_id,
                touro:touros(id, nome, registro, raca)
              `)
              .in('id', doseIds);

            if (dosesData) {
              // Criar mapa de dose_id -> nome do touro
              dosesMap = new Map(
                dosesData.map((d) => {
                  const touroRaw = (d as DoseComTouro).touro;
                  const touro = Array.isArray(touroRaw) ? touroRaw[0] : touroRaw;
                  return [d.id, touro?.nome || 'Touro desconhecido'];
                })
              );
              
              // Adicionar nome do touro aos acasalamentos
              acasalamentosData.forEach(ac => {
                if (ac.dose_semen_id) {
                  const touroNome = dosesMap.get(ac.dose_semen_id);
                  if (touroNome) {
                    const acasalamentoAtual = acasalamentosMap.get(ac.id);
                    acasalamentosMap.set(ac.id, {
                      ...acasalamentoAtual,
                      touro_nome: touroNome,
                    });
                  }
                }
              });
            }
          }
        }
      }

      // Agrupar embriões por lote_fiv_id + data de criação (mesma lógica de Embriões.tsx)
      const pacotesMap = new Map<string, PacoteEmbrioes>();

      embrioesData.forEach((embriao) => {
        if (!embriao.lote_fiv_id || !embriao.created_at) {
          return;
        }

        const dataDespacho = embriao.created_at.split('T')[0];
        const chavePacote = `${embriao.lote_fiv_id}-${dataDespacho}`;

        let pacote = pacotesMap.get(chavePacote);
        if (!pacote) {
          const pacoteAspiracaoIdOriginal = pacoteParaLoteMap.get(embriao.lote_fiv_id);
          const pacoteInfo = pacoteAspiracaoIdOriginal
            ? pacotesAspiracaoMap.get(pacoteAspiracaoIdOriginal)
            : undefined;

          const fazendasDestinoIds = pacoteAspiracaoIdOriginal
            ? (fazendasDestinoPorPacoteMap.get(pacoteAspiracaoIdOriginal) || [])
            : [];

          const fazendasDestinoNomes = fazendasDestinoIds
            .map(id => fazendasMap.get(id))
            .filter((nome): nome is string => !!nome);

          pacote = {
            id: chavePacote,
            lote_fiv_id: embriao.lote_fiv_id,
            data_despacho: dataDespacho,
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
          };
          pacotesMap.set(chavePacote, pacote);
        }

        // Enriquecer embrião com informações de doadora e touro
        const acasalamento = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id || '');
        const doadoraRegistro = acasalamento?.doadora_registro;
        const touroNome = acasalamento?.touro_nome;

        pacote.embrioes.push({
          ...embriao,
          doadora_registro: doadoraRegistro,
          touro_nome: touroNome,
          d7_pronto: disponibilidadeMap.get(embriao.id)?.d7_pronto,
          d8_limite: disponibilidadeMap.get(embriao.id)?.d8_limite,
        });
        pacote.total++;

        if (embriao.status_atual === 'FRESCO') pacote.frescos++;
        if (embriao.status_atual === 'CONGELADO') pacote.congelados++;
      });

      // Buscar informações de disponibilidade dos lotes FIV
      const loteFivIdsParaPacotes = [...new Set(Array.from(pacotesMap.values()).map(p => p.lote_fiv_id))];
      const { data: lotesFivDisponibilidade } = await supabase
        .from('lotes_fiv')
        .select('id, disponivel_para_transferencia')
        .in('id', loteFivIdsParaPacotes);

      const lotesDisponiveisMap = new Map(
        lotesFivDisponibilidade?.map(l => [l.id, l.disponivel_para_transferencia === true]) || []
      );

      const pacotesComResumo = Array.from(pacotesMap.values()).map((pacote) => {
        const semClassificacao = pacote.embrioes.filter(e => !e.classificacao || e.classificacao.trim() === '').length;
        return {
          pacote,
          semClassificacao,
          total: pacote.total,
          disponivel: lotesDisponiveisMap.get(pacote.lote_fiv_id),
        };
      });

      // Filtrar pacotes: somente totalmente classificados e disponíveis
      const pacotesArray = pacotesComResumo
        .filter(pacote => {
          const disponivel = pacote.disponivel;
          return disponivel !== false && pacote.total > 0 && pacote.semClassificacao === 0;
        })
        .map(item => item.pacote)
        .sort((a, b) => b.data_despacho.localeCompare(a.data_despacho));


      setPacotes(pacotesArray);
    } catch (error) {
      console.error('Erro ao carregar pacotes:', error);
      toast({
        title: 'Erro ao carregar pacotes de embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setPacotes([]);
    }
  };

  const loadEmbrioesCongelados = async () => {
    const filtroRacaNormalizado = filtroRaca.trim().toLowerCase();
    if (!filtroClienteId && !filtroRacaNormalizado) {
      setEmbrioesCongelados([]);
      return;
    }

    try {
      setLoadingCongelados(true);
      const { data: transferenciasData, error: transferenciasError } = await supabase
        .from('transferencias_embrioes')
        .select('embriao_id');
      if (transferenciasError) throw transferenciasError;

      let congeladosQuery = supabase
        .from('embrioes')
        .select('*')
        .eq('status_atual', 'CONGELADO')
        .not('cliente_id', 'is', null);

      if (filtroClienteId) {
        congeladosQuery = congeladosQuery.eq('cliente_id', filtroClienteId);
      }

      const { data: embrioesData, error: embrioesError } = await congeladosQuery
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;
      if (embrioesData && embrioesData.length > 0) {
        const sample = embrioesData[0] as Record<string, unknown>;
      }

      const embrioesTransferidosIds = transferenciasData?.map(t => t.embriao_id) || [];
      const embrioesFiltradosBase = (embrioesData || [])
        .filter(e => !embrioesTransferidosIds.includes(e.id) && e.status_atual !== 'TRANSFERIDO');

      if (embrioesFiltradosBase.length === 0) {
        setEmbrioesCongelados([]);
        return;
      }

      const acasalamentoIdsDiretos = embrioesFiltradosBase
        .map(e => e.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);
      const acasalamentoMediaIds = embrioesFiltradosBase
        .map(e => e.acasalamento_media_id)
        .filter((id): id is string => !!id);
      let acasalamentoIds = [...new Set(acasalamentoIdsDiretos)];
      const acasalamentoIdsFromMedia = new Set<string>();

      if (acasalamentoMediaIds.length > 0) {
        const { data: mediaData, error: mediaError } = await supabase
          .from('acasalamento_embrioes_media')
          .select('id, lote_fiv_acasalamento_id')
          .in('id', acasalamentoMediaIds);
        if (mediaError) throw mediaError;
        (mediaData || []).forEach(m => {
          if (m.lote_fiv_acasalamento_id) {
            acasalamentoIdsFromMedia.add(m.lote_fiv_acasalamento_id);
          }
        });
      }

      if (acasalamentoIds.length === 0 && acasalamentoIdsFromMedia.size > 0) {
        acasalamentoIds = [...acasalamentoIdsFromMedia];
      }

      let acasalamentosData: Array<{ id: string; aspiracao_doadora_id?: string; dose_semen_id?: string }> = [];
      let aspiracoesData: Array<{ id: string; doadora_id?: string }> = [];
      let doadorasData: Array<{ id: string; registro?: string; raca?: string }> = [];
      let dosesData: DoseComTouro[] = [];

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosResult, error: acasalamentosError } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);
        if (acasalamentosError) throw acasalamentosError;
        acasalamentosData = acasalamentosResult || [];
        if (acasalamentosData.length === 0 && acasalamentoIdsFromMedia.size > 0) {
          const idsFromMedia = [...acasalamentoIdsFromMedia];
          const { data: acasalamentosViaMedia, error: acasalamentosViaMediaError } = await supabase
            .from('lote_fiv_acasalamentos')
            .select('id, aspiracao_doadora_id, dose_semen_id')
            .in('id', idsFromMedia);
          if (!acasalamentosViaMediaError && acasalamentosViaMedia && acasalamentosViaMedia.length > 0) {
            acasalamentosData = acasalamentosViaMedia;
          }
        }

        const aspiracaoIds = [...new Set(acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean))] as string[];
        const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))] as string[];

        if (aspiracaoIds.length > 0) {
          const { data: aspiracoesResult, error: aspiracoesError } = await supabase
            .from('aspiracoes_doadoras')
            .select('id, doadora_id')
            .in('id', aspiracaoIds);
          if (aspiracoesError) throw aspiracoesError;
          aspiracoesData = aspiracoesResult || [];

          const doadoraIds = [...new Set(aspiracoesData.map(a => a.doadora_id).filter(Boolean))] as string[];
          if (doadoraIds.length > 0) {
            const { data: doadorasResult, error: doadorasError } = await supabase
              .from('doadoras')
              .select('id, registro, raca')
              .in('id', doadoraIds);
            if (doadorasError) throw doadorasError;
            doadorasData = doadorasResult || [];
          }
        }

        if (doseIds.length > 0) {
          const { data: dosesResult, error: dosesError } = await supabase
            .from('doses_semen')
            .select(`
              id,
              touro:touros(id, nome, registro, raca)
            `)
            .in('id', doseIds);
          if (dosesError) throw dosesError;
          dosesData = dosesResult || [];
        }
      }

      if (acasalamentosData.length === 0) {
        const loteFivIdsFallback = [...new Set(embrioesFiltradosBase.map(e => e.lote_fiv_id).filter(Boolean))] as string[];
        if (loteFivIdsFallback.length > 0) {
          const { data: acasalamentosPorLote } = await supabase
            .from('lote_fiv_acasalamentos')
            .select('id, lote_fiv_id')
            .in('lote_fiv_id', loteFivIdsFallback);
        }
      }

      const acasalamentosMap = new Map(acasalamentosData.map(a => [a.id, a]));
      const aspiracoesMap = new Map(aspiracoesData.map(a => [a.id, a]));
      const doadorasMap = new Map(doadorasData.map(d => [d.id, d]));
      const dosesMap = new Map(dosesData.map(d => [d.id, d]));
      const clientesMap = new Map(clientes.map(c => [c.id, c.nome]));

      const embrioesCompletos = embrioesFiltradosBase.map((embriao) => {
        const acasalamento = embriao.lote_fiv_acasalamento_id
          ? acasalamentosMap.get(embriao.lote_fiv_acasalamento_id)
          : undefined;
        const aspiracao = acasalamento
          ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id)
          : undefined;
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;
        const touroRaw = dose?.touro ?? null;
        const touro = Array.isArray(touroRaw) ? touroRaw[0] : touroRaw;
        const clienteNome = embriao.cliente_id ? clientesMap.get(embriao.cliente_id) : undefined;

        return {
          ...embriao,
          doadora_registro: doadora?.registro,
          doadora_raca: doadora?.raca,
          touro_nome: touro?.nome || 'Touro desconhecido',
          touro_raca: touro?.raca,
          cliente_nome: clienteNome,
        };
      });

      const embrioesFiltrados = filtroRacaNormalizado
        ? embrioesCompletos.filter(e => {
            const raca = (e.doadora_raca || e.touro_raca || '').toLowerCase();
            return raca.includes(filtroRacaNormalizado);
          })
        : embrioesCompletos;

      setEmbrioesCongelados(embrioesFiltrados);
    } catch (error) {
      console.error('Erro ao carregar embriões congelados:', error);
      setEmbrioesCongelados([]);
    } finally {
      setLoadingCongelados(false);
    }
  };

  useEffect(() => {
    if (origemEmbriao !== 'CONGELADO') {
      setEmbrioesCongelados([]);
      return;
    }
    void loadEmbrioesCongelados();
  }, [origemEmbriao, filtroClienteId, filtroRaca, clientes.length]);


  const carregarReceptorasCioLivre = async (fazendaId: string) => {
    try {
      const { data: cioLivreData, error: cioLivreError } = await supabase
        .from('receptoras_cio_livre')
        .select('receptora_id, data_cio')
        .eq('fazenda_id', fazendaId)
        .eq('ativa', true);
      if (cioLivreError && cioLivreError.code !== 'PGRST205') {
        throw cioLivreError;
      }

      const receptoraIdsCioLivre = (cioLivreData || [])
        .map(c => c.receptora_id)
        .filter((id): id is string => !!id);
      if (receptoraIdsCioLivre.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: receptorasCioLivreInfo, error: receptorasError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .in('id', receptoraIdsCioLivre);
      if (receptorasError) throw receptorasError;

      const dataCioPorReceptora = new Map(
        (cioLivreData || []).map(c => [c.receptora_id, c.data_cio])
      );

      const receptorasBase = (receptorasCioLivreInfo || []).map(r => ({
        receptora_id: r.id,
        brinco: r.identificacao || 'N/A',
        protocolo_id: undefined,
        protocolo_receptora_id: undefined,
        data_te_prevista: undefined,
        data_limite_te: undefined,
        quantidade_embrioes: 0,
        ciclando_classificacao: undefined,
        qualidade_semaforo: undefined,
        origem: 'CIO_LIVRE' as const,
        data_cio: dataCioPorReceptora.get(r.id),
        status_reprodutivo: r.status_reprodutivo,
      }));

      return { receptoras: receptorasBase, receptorasDisponiveis: receptorasBase.length };
    } catch (error) {
      console.error('Erro ao carregar receptoras em cio livre:', error);
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
      return { receptoras: [], receptorasDisponiveis: 0 };
    }
  };

  // Função unificada para carregar receptoras (usada tanto em handleFazendaChange quanto em recarregarReceptoras)
  const carregarReceptorasDaFazenda = async (fazendaId: string) => {
    try {
      if (!dataPasso2) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: protocolosData, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('id')
        .eq('passo2_data', dataPasso2);
      if (protocolosError) throw protocolosError;

      const protocoloIds = [...new Set((protocolosData || []).map(p => p.id).filter(Boolean))];
      if (protocoloIds.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: statusViewData, error: statusViewError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('receptora_id, brinco, identificacao, data_te_prevista, data_limite_te, protocolo_id')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('protocolo_id', protocoloIds);
      if (statusViewError && statusViewError.code !== 'PGRST205') {
        throw statusViewError;
      }

      const statusViewSafe = statusViewData || [];
      const receptoraIds = [...new Set(statusViewSafe.map(s => s.receptora_id).filter(Boolean))];
      if (receptoraIds.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .in('receptora_id', receptoraIds)
        .eq('fazenda_id_atual', fazendaId);
      if (viewError) throw viewError;

      const receptoraIdsNaFazenda = new Set((viewData || []).map(v => v.receptora_id).filter(Boolean));
      const statusFiltrado = statusViewSafe.filter(s => receptoraIdsNaFazenda.has(s.receptora_id));
      const receptoraIdsFiltradas = [...new Set(statusFiltrado.map(s => s.receptora_id).filter(Boolean))];

      if (receptoraIdsFiltradas.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: receptorasStatusData, error: receptorasStatusError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .in('id', receptoraIdsFiltradas);
      if (receptorasStatusError) throw receptorasStatusError;

      const receptoraInfoMap = new Map(
        (receptorasStatusData || []).map(r => [r.id, r])
      );

      const protocoloIdsView = [...new Set(statusFiltrado.map(s => s.protocolo_id).filter(Boolean))];
      let prData: Array<{
        id: string;
        receptora_id: string;
        protocolo_id: string;
        status: string;
        ciclando_classificacao?: 'N' | 'CL' | null;
        qualidade_semaforo?: 1 | 2 | 3 | null;
      }> = [];
      if (protocoloIdsView.length > 0) {
        const { data: prDataRaw, error: prError } = await supabase
          .from('protocolo_receptoras')
          .select('id, receptora_id, protocolo_id, status, ciclando_classificacao, qualidade_semaforo')
          .in('protocolo_id', protocoloIdsView)
          .neq('status', 'INAPTA')
          .neq('status', 'UTILIZADA');
        if (prError && prError.code !== 'PGRST205') throw prError;
        prData = prDataRaw || [];
      }

      const prMap = new Map(prData.map(pr => [pr.receptora_id, pr]));

      const receptorasProtocolo = statusFiltrado
        .map((viewInfo) => {
          const info = receptoraInfoMap.get(viewInfo.receptora_id);
          const pr = prMap.get(viewInfo.receptora_id);
          const quantidadeSessao = contagemSessaoPorReceptora[viewInfo.receptora_id] || 0;
          return {
            receptora_id: viewInfo.receptora_id,
            brinco: viewInfo.brinco || info?.identificacao || 'N/A',
            identificacao: viewInfo.identificacao || info?.identificacao || '',
            protocolo_id: pr?.protocolo_id || viewInfo.protocolo_id,
            protocolo_receptora_id: pr?.id || '',
            data_te_prevista: viewInfo.data_te_prevista,
            data_limite_te: viewInfo.data_limite_te,
            quantidade_embrioes: quantidadeSessao,
            ciclando_classificacao: pr?.ciclando_classificacao ?? null,
            qualidade_semaforo: pr?.qualidade_semaforo ?? null,
            origem: 'PROTOCOLO' as const,
            status_reprodutivo: info?.status_reprodutivo,
          };
        })
        .filter(r => r.status_reprodutivo === 'SINCRONIZADA');

      let receptorasFinal = receptorasProtocolo;

      if (incluirCioLivre) {
        const { receptoras: receptorasCioLivre } = await carregarReceptorasCioLivre(fazendaId);
        receptorasFinal = [...receptorasFinal, ...receptorasCioLivre];
      }

      const receptorasSessao = Object.values(receptorasSessaoInfo)
        .filter(r => (contagemSessaoPorReceptora[r.receptora_id] || 0) === 1);
      const existentes = new Set(receptorasFinal.map(r => r.receptora_id));
      receptorasSessao.forEach(r => {
        if (!existentes.has(r.receptora_id)) {
          receptorasFinal.push({
            ...r,
            quantidade_embrioes: contagemSessaoPorReceptora[r.receptora_id] || 0,
          });
        }
      });

      receptorasFinal = receptorasFinal.map(r => ({
        ...r,
        quantidade_embrioes: contagemSessaoPorReceptora[r.receptora_id] || 0,
      }));

      setReceptoras(receptorasFinal);
      return { receptorasDisponiveis: receptorasFinal.length };
    } catch (error) {
      console.error('Erro ao carregar receptoras:', error);
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
      return { receptorasDisponiveis: 0 };
    }
  };

  // Função para recarregar receptoras sem limpar o pacote (usada após registrar transferência)
  const recarregarReceptoras = async (fazendaId: string) => {
    await carregarReceptorasDaFazenda(fazendaId);
  };

  const handleFazendaChange = async (fazendaId: string) => {
    const t0 = performance.now();
    // Se não há fazenda selecionada, limpar tudo (permitir sempre limpar)
    if (!fazendaId) {
      setFormData({
        ...formData,
        fazenda_id: '',
        pacote_id: '',
        protocolo_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
      });
      setCamposPacote({
        data_te: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
      });
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setReceptoras([]);
      return;
    }

    // Antes de carregar receptoras, tentar restaurar sessão em andamento para esta fazenda
    const sessaoRestaurada = await restaurarSessaoPorFazenda(fazendaId);
    
    if (!sessaoRestaurada) {      // Se não há sessão para restaurar, limpar estado anterior e carregar receptoras normalmente
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setCamposPacote({
        data_te: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
      });
    }

    // Carregar receptoras da fazenda após selecionar data do 2º passo
    if (dataPasso2) {
      await carregarReceptorasDaFazenda(fazendaId);
    } else {
      setReceptoras([]);
    }
    // Atualizar formData com a fazenda selecionada
    setFormData({
      ...formData,
      fazenda_id: fazendaId,
      // Se não restaurou sessão, limpar pacote
      pacote_id: sessaoRestaurada ? formData.pacote_id : '',
      protocolo_id: sessaoRestaurada ? formData.protocolo_id : '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });  };

  // Função para restaurar sessão por fazenda específica
  const restaurarSessaoPorFazenda = async (fazendaId: string): Promise<boolean> => {
    try {
      const { data: sessoesData, error: sessoesError } = await supabase
        .from('transferencias_sessoes')
        .select('*')
        .eq('fazenda_id', fazendaId)
        .eq('status', 'ABERTA')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (sessoesError && sessoesError.code !== 'PGRST205') {
        console.error('Erro ao restaurar sessão da fazenda no banco:', sessoesError);
      }
      if (sessoesData && sessoesData.length > 0) {
        const sessao = sessoesData[0];
        const transferenciasIds = Array.isArray(sessao?.transferencias_ids)
          ? sessao.transferencias_ids
          : [];
        let protocoloReceptoraIds = Array.isArray(sessao?.protocolo_receptora_ids)
          ? sessao.protocolo_receptora_ids
          : [];

        if (protocoloReceptoraIds.length === 0 && transferenciasIds.length > 0) {
          const { data: transferenciasSessaoData, error: transferenciasSessaoError } = await supabase
            .from('transferencias_embrioes')
            .select('protocolo_receptora_id')
            .in('id', transferenciasIds);
          if (!transferenciasSessaoError && transferenciasSessaoData) {
            protocoloReceptoraIds = [...new Set(
              transferenciasSessaoData
                .map(t => t.protocolo_receptora_id)
                .filter((id): id is string => !!id)
            )];
          }
        }

        let temProtocolosAtivos = false;
        if (protocoloReceptoraIds.length > 0) {
          const { data: protocolosData, error: protocolosError } = await supabase
            .from('protocolo_receptoras')
            .select('id, status')
            .in('id', protocoloReceptoraIds);
          if (!protocolosError && protocolosData) {
            temProtocolosAtivos = protocolosData.some(p => p.status !== 'UTILIZADA');
          }
        }

        if (!temProtocolosAtivos) {
          await supabase
            .from('transferencias_sessoes')
            .update({ status: 'ENCERRADA', updated_at: new Date().toISOString() })
            .eq('id', sessao.id);
          return false;
        }

        aplicarSessaoPersistida(sessao);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao restaurar sessão por fazenda:', error);
      return false;
    }
  };


  const handlePacoteChange = (pacoteId: string) => {
    const mudouPacote = pacoteId !== formData.pacote_id;
    if (mudouPacote) {
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
    }
    // Quando muda o pacote, limpar embrião e receptora, mas manter fazenda
    // Se já havia campos salvos para este pacote, restaurá-los
    setFormData({
      ...formData,
      pacote_id: pacoteId,
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
      data_te: camposPacote.data_te || formData.data_te,
      veterinario_responsavel: camposPacote.veterinario_responsavel || formData.veterinario_responsavel,
      tecnico_responsavel: camposPacote.tecnico_responsavel || formData.tecnico_responsavel,
    });
  };

  const handleOrigemEmbriaoChange = (valor: 'PACOTE' | 'CONGELADO') => {
    setOrigemEmbriao(valor);
    setEmbrioesPage(1);
    setFormData({
      ...formData,
      pacote_id: valor === 'PACOTE' ? formData.pacote_id : '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });
  };

  const handleDescartarReceptora = async () => {
    if (!formData.receptora_id) {
      toast({
        title: 'Erro',
        description: 'Nenhuma receptora selecionada para descartar',
        variant: 'destructive',
      });
      return;
    }

    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
    const brincoReceptora = receptoraSelecionada?.brinco || 'Receptora';
    const origemReceptora = receptoraSelecionada?.origem;

    const mensagemConfirmacao = origemReceptora === 'CIO_LIVRE'
      ? `Tem certeza que deseja descartar a receptora ${brincoReceptora}? Ela não receberá embrião e sairá da lista de cio livre.`
      : `Tem certeza que deseja descartar a receptora ${brincoReceptora}? Ela não receberá embrião e não poderá ser selecionada novamente neste protocolo.`;
    if (!confirm(mensagemConfirmacao)) {
      return;
    }

    try {
      setSubmitting(true);

      if (origemReceptora === 'CIO_LIVRE' || !formData.protocolo_receptora_id) {
        const { error: cioLivreError } = await supabase
          .from('receptoras_cio_livre')
          .update({ ativa: false })
          .eq('receptora_id', formData.receptora_id)
          .eq('ativa', true);
        if (cioLivreError) throw cioLivreError;

        const { error: atualizarReceptoraError } = await supabase
          .from('receptoras')
          .update({ status_cio_livre: 'REJEITADA', is_cio_livre: false })
          .eq('id', formData.receptora_id);
        if (atualizarReceptoraError) throw atualizarReceptoraError;
      } else {
        // Atualizar status para INAPTA (descartada)
        const { error: prError } = await supabase
          .from('protocolo_receptoras')
          .update({ 
            status: 'INAPTA',
            motivo_inapta: 'Descartada no menu de TE - não recebeu embrião'
          })
          .eq('id', formData.protocolo_receptora_id);

        if (prError) throw prError;
      }

      // Atualizar status da receptora para VAZIA quando descartada na TE
      // Atualizar diretamente sem validações para garantir que sempre atualiza
      if (formData.receptora_id) {
        const { error: statusError } = await supabase
          .from('receptoras')
          .update({ status_reprodutivo: 'VAZIA' })
          .eq('id', formData.receptora_id);
        
        if (statusError) {
          console.error('Erro ao atualizar status da receptora descartada:', statusError);
          // Não falhar se houver erro, mas logar para debug
          // O importante é que o status em protocolo_receptoras foi atualizado
        } else {
        }
      }

      toast({
        title: 'Receptora descartada',
        description: origemReceptora === 'CIO_LIVRE'
          ? `${brincoReceptora} foi descartada e saiu da lista de cio livre.`
          : `${brincoReceptora} foi descartada e não receberá embrião neste protocolo.`,
      });

      // Limpar seleção de receptora
      setFormData({
        ...formData,
        receptora_id: '',
        protocolo_receptora_id: '',
      });

      // Recarregar lista de receptoras (a descartada não aparecerá mais)
      if (formData.fazenda_id) {
        await recarregarReceptoras(formData.fazenda_id);
      }
    } catch (error) {
      console.error('Erro ao descartar receptora:', error);
      toast({
        title: 'Erro ao descartar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requerPacote = origemEmbriao === 'PACOTE';
    // Validações específicas com mensagens claras
    if (!formData.embriao_id) {
      toast({
        title: 'Embrião não selecionado',
        description: 'Por favor, selecione um embrião para realizar a transferência.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.fazenda_id || !dataPasso2 || !formData.receptora_id || !formData.data_te || (requerPacote && !formData.pacote_id)) {
      toast({
        title: 'Erro de validação',
        description: 'Todos os campos obrigatórios devem ser preenchidos',
        variant: 'destructive',
      });
      return;
    }
    // Validar quantidade máxima de embriões por receptora na sessão atual
    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
    
    if (!receptoraSelecionada) {
      toast({
        title: 'Receptora não disponível',
        description: 'A receptora selecionada não está disponível para transferência.',
        variant: 'destructive',
      });
      return;
    }

    const quantidadeSessao = contagemSessaoPorReceptora[formData.receptora_id] || 0;
    const permitirSegundaTe = quantidadeSessao === 1;

    if (quantidadeSessao >= 2) {
      toast({
        title: 'Limite atingido',
        description: 'Esta receptora já recebeu o máximo de 2 embriões permitidos.',
        variant: 'destructive',
      });
      return;
    }

    // Validar que a receptora está SINCRONIZADA antes de realizar a TE
    if (formData.receptora_id && !permitirSegundaTe) {
      const statusBase = receptoraSelecionada.status_reprodutivo || 'VAZIA';
      const statusAtual =
        receptoraSelecionada.origem === 'CIO_LIVRE'
          ? 'SINCRONIZADA'
          : statusBase;
      const validacao = validarTransicaoStatus(statusAtual, 'REALIZAR_TE');

      if (!validacao.valido) {
        toast({
          title: 'Erro de validação',
          description: validacao.mensagem || 'A receptora não pode receber embrião no estado atual',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setSubmitting(true);

      // Validar campos obrigatórios antes de inserir
      if (!formData.embriao_id) {
        toast({
          title: 'Erro de validação',
          description: 'Embrião não selecionado',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.receptora_id) {
        toast({
          title: 'Erro de validação',
          description: 'Receptora não selecionada',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.data_te) {
        toast({
          title: 'Erro de validação',
          description: 'Data da TE não informada',
          variant: 'destructive',
        });
        return;
      }

      // Validar que o veterinário responsável foi informado (campo obrigatório no banco)
      if (!formData.veterinario_responsavel || formData.veterinario_responsavel.trim() === '') {
        toast({
          title: 'Erro de validação',
          description: 'Veterinário responsável é obrigatório. Por favor, informe o nome do veterinário.',
          variant: 'destructive',
        });
        return;
      }

      const insertData: Record<string, string | null> = {
        embriao_id: formData.embriao_id,
        receptora_id: formData.receptora_id,
        protocolo_receptora_id: formData.protocolo_receptora_id || null,
        data_te: formData.data_te,
        tipo_te: origemEmbriao === 'CONGELADO' ? 'CONGELADO' : 'FRESCO',
        veterinario_responsavel: formData.veterinario_responsavel.trim(), // Campo obrigatório, sempre preenchido após validação
        tecnico_responsavel: formData.tecnico_responsavel?.trim() || null,
        status_te: 'REALIZADA',
        observacoes: formData.observacoes?.trim() || null,
      };

      const { data: teData, error: teError } = await supabase.from('transferencias_embrioes').insert([insertData]).select('id');

      if (teError) {
        console.error('Erro ao inserir transferência:', teError);
        console.error('Dados tentados:', insertData);
        
        // Se houver erro de constraint única, recarregar a lista silenciosamente
        // (o embrião não deveria aparecer na lista se já foi transferido)
        if (teError.code === '23505' && teError.message?.includes('unq_embriao_te_realizada')) {
          if (origemEmbriao === 'CONGELADO') {
            loadEmbrioesCongelados();
          } else {
            loadPacotes();
          }
          return;
        }
        
        throw teError;
      }
      // Adicionar o ID da transferência à sessão
      if (teData && teData[0]?.id) {
        setTransferenciasIdsSessao(prev => [...prev, teData[0].id]);
      }

      if (formData.receptora_id) {
        const { data: statusReceptora } = await supabase
          .from('receptoras')
          .select('id, status_reprodutivo')
          .eq('id', formData.receptora_id)
          .single();
      }

      const { error: embriaoError } = await supabase
        .from('embrioes')
        .update({ status_atual: 'TRANSFERIDO' })
        .eq('id', formData.embriao_id);

      if (embriaoError) throw embriaoError;

      // Atualizar status da receptora para SERVIDA imediatamente após a transferência
      const { error: statusReprodutivoError } = await supabase
        .from('receptoras')
        .update({ status_reprodutivo: 'SERVIDA' })
        .eq('id', formData.receptora_id);
      if (statusReprodutivoError) throw statusReprodutivoError;

      if (receptoraSelecionada?.origem === 'CIO_LIVRE') {
        const { error: confirmarCioLivreError } = await supabase
          .from('receptoras')
          .update({ status_cio_livre: 'CONFIRMADA', is_cio_livre: false })
          .eq('id', formData.receptora_id);
        if (confirmarCioLivreError) throw confirmarCioLivreError;

        const { error: inativarCioLivreError } = await supabase
          .from('receptoras_cio_livre')
          .update({ ativa: false })
          .eq('receptora_id', formData.receptora_id)
          .eq('ativa', true);
        if (inativarCioLivreError) throw inativarCioLivreError;

      }
      
      // Marcação de protocolo_receptoras como UTILIZADA será feita ao encerrar a sessão
      // Apenas adicionar à lista de transferências da sessão
      if (formData.protocolo_receptora_id) {
        setTransferenciasSessao(prev => {
          if (!prev.includes(formData.protocolo_receptora_id)) {
            return [...prev, formData.protocolo_receptora_id];
          }
          return prev;
        });
      }
      const novaContagem = (contagemSessaoPorReceptora[formData.receptora_id] || 0) + 1;
      setContagemSessaoPorReceptora(prev => ({
        ...prev,
        [formData.receptora_id]: novaContagem,
      }));
      setReceptorasSessaoInfo(prev => ({
        ...prev,
        [formData.receptora_id]: {
          ...receptoraSelecionada,
          quantidade_embrioes: novaContagem,
          status_reprodutivo: 'SERVIDA',
        },
      }));

      toast({
        title: 'Transferência realizada',
        description: 'Transferência de embrião registrada com sucesso',
      });

      // Salvar campos do pacote para manter preenchidos
      setCamposPacote({
        data_te: formData.data_te,
        veterinario_responsavel: formData.veterinario_responsavel,
        tecnico_responsavel: formData.tecnico_responsavel,
      });

      // Manter fazenda, pacote e TODOS os campos preenchidos, apenas limpar receptora e embrião
      setFormData({
        fazenda_id: formData.fazenda_id, // Manter fazenda selecionada
        pacote_id: origemEmbriao === 'PACOTE' ? formData.pacote_id : '',
        protocolo_id: formData.protocolo_id, // Manter protocolo selecionado
        embriao_id: '', // Limpar apenas embrião
        receptora_id: '', // Limpar apenas receptora
        protocolo_receptora_id: '', // Limpar apenas protocolo
        data_te: formData.data_te, // Manter data da TE
        veterinario_responsavel: formData.veterinario_responsavel, // Manter vet responsável
        tecnico_responsavel: formData.tecnico_responsavel, // Manter técnico responsável
        observacoes: '', // Limpar apenas observações
      });

      if (origemEmbriao === 'CONGELADO') {
        loadEmbrioesCongelados();
      } else {
        loadPacotes();
      }
      
      // Recarregar receptoras para atualizar a lista (sem limpar o pacote)
      if (formData.fazenda_id) {
        await recarregarReceptoras(formData.fazenda_id);
      }
    } catch (error) {
      console.error('Erro completo:', error);
      toast({
        title: 'Erro ao realizar transferência',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const visualizarRelatorioSessao = async () => {
    if (transferenciasIdsSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para visualizar.',
        variant: 'destructive',
      });
      return;
    }

    setIsVisualizacaoApenas(true);
    await gerarRelatorioSessao(true);
  };

  const gerarRelatorioSessao = async (apenasVisualizacao: boolean = false) => {
    const temTransferencias = transferenciasIdsSessao.length > 0;
    
    if (!temTransferencias) {
      if (!apenasVisualizacao) {
        toast({
          title: 'Nenhuma transferência na sessão',
          description: 'Não há transferências para gerar relatório.',
          variant: 'destructive',
        });
      }
      return;
    }
    
    if (!apenasVisualizacao && transferenciasSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para gerar relatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Buscar todas as transferências da sessão atual (baseado nos IDs das transferências)
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select(`
          *,
          embrioes (
            id,
            classificacao,
            status_atual,
            lote_fiv_id,
            lote_fiv_acasalamento_id
          ),
          receptoras (
            id,
            identificacao,
            nome
          )
        `)
        .in('id', transferenciasIdsSessao)
        .eq('status_te', 'REALIZADA')
        .order('created_at', { ascending: true });

      if (teError) throw teError;

      if (!transferenciasData || transferenciasData.length === 0) {
        toast({
          title: 'Erro ao gerar relatório',
          description: 'Não foi possível encontrar as transferências da sessão.',
          variant: 'destructive',
        });
        return;
      }

      // Enriquecer com informações de doadora e touro
      const acasalamentoIds = transferenciasData
        .map(t => t.embrioes?.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);

      let doadorasMap = new Map<string, string>();
      let tourosMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);

        if (acasalamentosData) {
          const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
          const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id).filter(Boolean))];

          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  const aspiracaoDoadoraMap = new Map(aspiracoesData.map(a => [a.id, a.doadora_id]));
                  aspiracoesData.forEach(a => {
                    const doadoraId = aspiracaoDoadoraMap.get(a.id);
                    if (doadoraId) {
                      const doadora = doadorasData.find(d => d.id === doadoraId);
                      if (doadora?.registro) {
                        doadorasMap.set(a.id, String(doadora.registro));
                      }
                    }
                  });
                }
              }
            }
          }

          if (doseIds.length > 0) {
            // Buscar doses com informações do touro relacionado
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select(`
                id,
                touro_id,
                touro:touros(id, nome, registro, raca)
              `)
              .in('id', doseIds);

            if (dosesData) {
              dosesData.forEach(d => {
                const touroRaw = (d as DoseComTouro).touro;
                const touro = Array.isArray(touroRaw) ? touroRaw[0] : touroRaw;
                tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
              });
            }
          }

          // Mapear acasalamentos para doadora e touro
          acasalamentosData.forEach(ac => {
            const aspiracaoId = ac.aspiracao_doadora_id;
            const doseId = ac.dose_semen_id;
            if (aspiracaoId && doseId) {
              const doadoraRegistro = doadorasMap.get(aspiracaoId);
              const touroNome = tourosMap.get(doseId);
              if (doadoraRegistro) doadorasMap.set(ac.id, doadoraRegistro);
              if (touroNome) tourosMap.set(ac.id, touroNome);
            }
          });
        }
      }

      // Montar dados do relatório
      const relatorio = (transferenciasData as TransferenciaRelatorioData[]).map((t) => {
        const acasalamentoId = t.embrioes?.lote_fiv_acasalamento_id;
        const doadoraRegistro = acasalamentoId ? (doadorasMap.get(acasalamentoId) || 'N/A') : 'N/A';
        const touroNome = acasalamentoId ? (tourosMap.get(acasalamentoId) || 'N/A') : 'N/A';
        // Buscar número do embrião do mapa ou usar ID como fallback
        const numeroEmbriao = (numerosFixosMap && numerosFixosMap.get(t.embriao_id))
          ? String(numerosFixosMap.get(t.embriao_id))
          : (t.embriao_id ? t.embriao_id.substring(0, 8) : 'N/A');

        const item: RelatorioTransferenciaItem = {
          numero_embriao: numeroEmbriao,
          doadora: doadoraRegistro,
          touro: touroNome,
          classificacao: t.embrioes?.classificacao || 'N/A',
          receptora_brinco: t.receptoras?.identificacao || 'N/A',
          receptora_nome: t.receptoras?.nome || 'N/A',
          data_te: t.data_te,
          veterinario: t.veterinario_responsavel || 'N/A',
          tecnico: t.tecnico_responsavel || 'N/A',
          observacoes: t.observacoes || '',
        };
        return item;
      });

      setRelatorioData(relatorio);
      setShowRelatorioDialog(true);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setIsVisualizacaoApenas(false);
    }
  };

  const handleEncerrarSessao = async () => {
    if (transferenciasIdsSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para encerrar nesta sessão.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      let protocoloIdsParaEncerrar = [...transferenciasSessao];
      if (protocoloIdsParaEncerrar.length === 0) {
        const { data: transferenciasSessaoData, error: transferenciasSessaoError } = await supabase
          .from('transferencias_embrioes')
          .select('protocolo_receptora_id')
          .in('id', transferenciasIdsSessao);
        if (transferenciasSessaoError) {
          console.error('Erro ao buscar protocolos da sessão:', transferenciasSessaoError);
          throw transferenciasSessaoError;
        }
        protocoloIdsParaEncerrar = [...new Set(
          (transferenciasSessaoData || [])
            .map(t => t.protocolo_receptora_id)
            .filter((id): id is string => !!id)
        )];
      }

      // Buscar IDs das receptoras que receberam embriões nesta sessão para atualizar status
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id')
        .in('id', transferenciasIdsSessao)
        .eq('status_te', 'REALIZADA');

      if (teError) {
        console.error('Erro ao buscar transferências para atualizar status das receptoras:', teError);
        throw teError;
      }
      const receptoraIds = [...new Set((transferenciasData || []).map(t => t.receptora_id).filter(Boolean))];
      if (receptoraIds.length === 0) {
        throw new Error('Nenhuma receptora encontrada para encerrar a sessão.');
      }

      const { error: rpcError } = await supabase.rpc('encerrar_sessao_te', {
        p_receptora_ids: receptoraIds,
        p_protocolo_receptora_ids: protocoloIdsParaEncerrar,
      });
      if (rpcError) {
        throw rpcError;
      }

      await encerrarSessaoNoBanco(formData.fazenda_id);

      toast({
        title: 'Sessão encerrada',
        description: `${transferenciasIdsSessao.length} transferência(s) finalizada(s) com sucesso.`,
      });

      // Limpar tudo
      setFormData({
        fazenda_id: '',
        pacote_id: '',
        protocolo_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        data_te: new Date().toISOString().split('T')[0],
        veterinario_responsavel: '',
        tecnico_responsavel: '',
        observacoes: '',
      });
      setOrigemEmbriao('PACOTE');
      setTipoPacoteReceptoras('PROTOCOLO');
      setFiltroClienteId('');
      setFiltroRaca('');

      setCamposPacote({
        data_te: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
      });

      const fazendaIdAnterior = formData.fazenda_id;
      
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setContagemSessaoPorReceptora({});
      setReceptorasSessaoInfo({});
      setShowRelatorioDialog(false);
      setRelatorioData([]);
      setEmbrioesPage(1);
      setEmbrioesCongelados([]);
      
      // Recarregar dados antes de limpar o formData
      await loadPacotes();
      if (fazendaIdAnterior) {
        await recarregarReceptoras(fazendaIdAnterior);
      }
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      toast({
        title: 'Erro ao encerrar sessão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const dataPasso2Selecionada = !!dataPasso2;
  const origemSelecionada = !!origemEmbriao;
  const embrioesDisponiveis = useMemo(() => {
    return pacoteSelecionado?.embrioes.filter(e => 
      e.status_atual === 'FRESCO'
    ) || [];
  }, [pacoteSelecionado]);
  const hasD8Limite = embrioesDisponiveis.some(e => e.d8_limite);

  useEffect(() => {
    setEmbrioesPage(1);
  }, [formData.pacote_id]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO') {
      setEmbrioesPage(1);
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO') {
      setFormData(prev => ({ ...prev, embriao_id: '' }));
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE));
    if (embrioesPage > totalPaginas) {
      setEmbrioesPage(totalPaginas);
    }
  }, [embrioesDisponiveis.length, embrioesPage, EMBRIOES_PAGE_SIZE]);

  // Criar mapa de números para rastreabilidade (mesma ordem do estoque)
  const numerosFixosEffectRuns = useRef(0);
  const numerosFixosMap = useMemo(() => {
    if (!formData.pacote_id || !pacoteSelecionado) {
      return new Map<string, number>();
    }
    const ordenados = [...embrioesDisponiveis].sort((a, b) => {
      const doadoraA = a.doadora_registro || '';
      const doadoraB = b.doadora_registro || '';
      if (doadoraA !== doadoraB) {
        return doadoraA.localeCompare(doadoraB);
      }
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dataA !== dataB) return dataA - dataB;
      return (a.id || '').localeCompare(b.id || '');
    });
    const numerosMap = new Map<string, number>();
    ordenados.forEach((embriao, index) => {
      numerosMap.set(embriao.id, index + 1);
    });
    return numerosMap;
  }, [formData.pacote_id, pacoteSelecionado, embrioesDisponiveis]);

  useEffect(() => {
    if (!formData.pacote_id || !pacoteSelecionado) return;
    numerosFixosEffectRuns.current += 1;
  }, [formData.pacote_id, pacoteSelecionado, numerosFixosMap]);


  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferência de Embriões (TE)"
        description="Destinar embriões para receptoras sincronizadas"
      />


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Nova Transferência
          </CardTitle>
            {/* Botões de Sessão - Topo do Card */}
            {formData.fazenda_id && transferenciasIdsSessao.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={visualizarRelatorioSessao}
                  className="bg-slate-600 hover:bg-slate-700"
                  disabled={submitting}
                  variant="default"
                  title="Visualizar relatório da sessão atual sem encerrar"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Visualizar Relatório ({transferenciasIdsSessao.length} transferência{transferenciasIdsSessao.length > 1 ? 's' : ''})
                </Button>
                <Button
                  type="button"
                  onClick={handleEncerrarSessao}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={submitting}
                  variant="default"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {submitting ? 'Gerando...' : `Encerrar Sessão (${transferenciasIdsSessao.length} transferência${transferenciasIdsSessao.length > 1 ? 's' : ''})`}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Parte Superior: Seleção de Fazenda, Pacote, Receptora e Campos Comuns */}
            <div className="space-y-4 border-b pb-6">
            {/* Passo 1: Selecionar Fazenda */}
            <div className="space-y-2">
              <Label htmlFor="fazenda_id">1. Fazenda onde estão as receptoras *</Label>
              <Select value={formData.fazenda_id} onValueChange={handleFazendaChange}>
                <SelectTrigger>
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


            {/* Passo 2: Selecionar Data do 2º Passo */}
            {formData.fazenda_id && (
              <div className="space-y-2">
                <Label htmlFor="data_passo2">2. Data do 2º Passo *</Label>
                <DatePickerBR
                  id="data_passo2"
                  value={dataPasso2}
                  onChange={(value) => setDataPasso2(value || '')}
                  required
                />
              </div>
            )}

            {/* Passo 3: Incluir CIO livre */}
            {formData.fazenda_id && dataPasso2Selecionada && (
              <div className="flex items-center gap-2">
                <Switch
                  id="incluir-cio-livre"
                  checked={incluirCioLivre}
                  onCheckedChange={setIncluirCioLivre}
                />
                <Label htmlFor="incluir-cio-livre" className="cursor-pointer text-sm">
                  Incluir CIO livre
                </Label>
              </div>
            )}

            {/* Passo 4: Origem do Embrião */}
            {formData.fazenda_id && dataPasso2Selecionada && (
              <div className="space-y-2">
                <Label htmlFor="origem_embriao">4. Origem do Embrião *</Label>
                <Select
                  value={origemEmbriao}
                  onValueChange={(value) => handleOrigemEmbriaoChange(value as 'PACOTE' | 'CONGELADO')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PACOTE">Pacote (Fresco)</SelectItem>
                    <SelectItem value="CONGELADO">Estoque Congelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Passo 5: Selecionar Pacote de Embriões (Frescos) */}
            {formData.fazenda_id && dataPasso2Selecionada && origemEmbriao === 'PACOTE' && (
              <div className="space-y-2">
                <Label htmlFor="pacote_id">5. Pacote de Embriões (Frescos) *</Label>
                <Select
                  value={formData.pacote_id}
                  onValueChange={handlePacoteChange}
                  disabled={!formData.fazenda_id || !dataPasso2Selecionada}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pacote" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacotesFiltrados.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Nenhum pacote disponível para esta fazenda
                      </div>
                    ) : (
                      pacotesFiltrados.map((pacote) => (
                        <SelectItem key={pacote.id} value={pacote.id}>
                          {formatDate(pacote.data_despacho)} - {pacote.total} embrião(ões) - 
                          {pacote.frescos > 0 && ` ${pacote.frescos} fresco(s)`}
                          {pacote.congelados > 0 && ` ${pacote.congelados} congelado(s)`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Passo 5 (Congelados): Filtros */}
            {formData.fazenda_id && dataPasso2Selecionada && origemEmbriao === 'CONGELADO' && (
              <div className="space-y-2">
                <Label>5. Filtros de Embriões Congelados *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="filtro_cliente">Cliente</Label>
                    <Select
                      value={filtroClienteId || '__all__'}
                      onValueChange={(value) => setFiltroClienteId(value === '__all__' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos os clientes</SelectItem>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro_raca">Raça</Label>
                    <Input
                      id="filtro_raca"
                      value={filtroRaca}
                      onChange={(e) => setFiltroRaca(e.target.value)}
                      placeholder="Ex.: Nelore, Holandesa"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Selecione ao menos um filtro para buscar embriões congelados.
                </p>
              </div>
            )}

              {/* Passo 6: Selecionar Receptora (lista) */}
              {formData.fazenda_id && dataPasso2Selecionada && origemSelecionada && (
                <div className="space-y-2">
                  <Label>6. Receptoras *</Label>
                  <div className="border rounded-lg p-4">
                    {receptoras.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Nenhuma receptora disponível para esta fazenda e data do 2º passo.
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-40">Ação</TableHead>
                              <TableHead>Receptora</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Origem</TableHead>
                              <TableHead>Sessão</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {receptoras.map((receptora) => {
                              const quantidadeSessao = contagemSessaoPorReceptora[receptora.receptora_id] || 0;
                              const selecionada = formData.receptora_id === receptora.receptora_id;
                              const podeSegundo = quantidadeSessao === 1;
                              const statusAtual = receptora.status_reprodutivo || (quantidadeSessao > 0 ? 'SERVIDA' : 'SINCRONIZADA');
                              return (
                                <TableRow
                                  key={receptora.receptora_id}
                                  className={selecionada ? 'bg-green-50' : 'hover:bg-slate-50'}
                                >
                                  <TableCell>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={podeSegundo ? 'default' : 'outline'}
                                      disabled={quantidadeSessao >= 2}
                                      onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          receptora_id: receptora.receptora_id,
                                          protocolo_receptora_id: receptora.protocolo_receptora_id || '',
                                          embriao_id: '',
                                        }));
                                      }}
                                    >
                                      {quantidadeSessao >= 2 ? 'Limite' : podeSegundo ? '2º embrião' : 'Selecionar'}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span>{receptora.brinco}</span>
                                      {receptora.origem === 'CIO_LIVRE' && (
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                                          Cio livre
                                        </Badge>
                                      )}
                                      {receptora.data_te_prevista && (
                                        <span className="text-slate-500 text-xs">
                                          (TE prevista: {formatDate(receptora.data_te_prevista)})
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {statusAtual}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {receptora.origem === 'CIO_LIVRE' ? 'CIO livre' : 'Protocolo'}
                                  </TableCell>
                                  <TableCell>
                                    {quantidadeSessao > 0 ? `${quantidadeSessao} TE` : '—'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Botão Descartar Receptora */}
                  {formData.receptora_id && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDescartarReceptora}
                      disabled={submitting}
                      title="Descartar receptora (não receberá embrião)"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Descartar receptora
                    </Button>
                  )}

                  {/* Exibir Qualidade e Ciclando quando receptora for selecionada */}
                  {formData.receptora_id && (() => {
                    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
                    const temQualidade = receptoraSelecionada?.qualidade_semaforo !== null && receptoraSelecionada?.qualidade_semaforo !== undefined;
                    const temCiclando = receptoraSelecionada?.ciclando_classificacao !== null && receptoraSelecionada?.ciclando_classificacao !== undefined;

                    if (temQualidade || temCiclando) {
                      return (
                        <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-2">Avaliação da Receptora:</p>
                          <div className="flex items-center gap-4">
                            {temCiclando && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">Ciclando:</span>
                                <CiclandoBadge
                                  value={receptoraSelecionada.ciclando_classificacao}
                                  variant="display"
                                  disabled={true}
                                />
                              </div>
                            )}
                            {temQualidade && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">Qualidade:</span>
                                <QualidadeSemaforo
                                  value={receptoraSelecionada.qualidade_semaforo}
                                  variant="single"
                                  disabled={true}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Campos Comuns: Data TE, Vet Responsável, Técnico Responsável */}
              {origemSelecionada && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_te">Data da TE *</Label>
                    <DatePickerBR
                      id="data_te"
                      value={formData.data_te}
                      onChange={(value) => {
                        const newDataTe = value || '';
                        setFormData({ ...formData, data_te: newDataTe });
                        setCamposPacote(prev => ({ ...prev, data_te: newDataTe }));
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="veterinario_responsavel">Veterinário Responsável *</Label>
                    <Input
                      id="veterinario_responsavel"
                      value={formData.veterinario_responsavel}
                      onChange={(e) => {
                        const newVet = e.target.value;
                        setFormData({ ...formData, veterinario_responsavel: newVet });
                        setCamposPacote(prev => ({ ...prev, veterinario_responsavel: newVet }));
                      }}
                      placeholder="Nome do veterinário"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
                    <Input
                      id="tecnico_responsavel"
                      value={formData.tecnico_responsavel}
                      onChange={(e) => {
                        const newTecnico = e.target.value;
                        setFormData({ ...formData, tecnico_responsavel: newTecnico });
                        setCamposPacote(prev => ({ ...prev, tecnico_responsavel: newTecnico }));
                      }}
                      placeholder="Nome do técnico"
                    />
                  </div>
                </div>
              )}

              {/* Botão Registrar Transferência - Parte Superior */}
              {formData.embriao_id && formData.receptora_id && (
                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={submitting}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {submitting ? 'Registrando...' : 'Registrar Transferência'}
                  </Button>
                </div>
              )}

            </div>

            {/* Lista de Embriões - Pacote (Fresco) */}
            {origemEmbriao === 'PACOTE' && formData.pacote_id && pacoteSelecionado && (
              <div className="space-y-4">
                <Label>7. Selecionar Embrião do Pacote *</Label>
                <div className="border rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900">Pacote selecionado</h3>
                    <p className="text-sm text-slate-600">
                      Data Despacho: {formatDate(pacoteSelecionado.data_despacho)} | 
                      Total: {pacoteSelecionado.total} embrião(ões)
                    </p>
                    {hasD8Limite && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="w-4 h-4" />
                        Embriões em D8: transferir ou congelar hoje. No D9 serão descartados automaticamente.
                      </div>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="text-center w-16">Nº</TableHead>
                          <TableHead>Doadora</TableHead>
                          <TableHead>Touro</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Dia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Ordenar embriões pelo número fixo (ordem crescente)
                          const embrioesOrdenados = [...embrioesDisponiveis].sort((a, b) => {
                            const numeroA = numerosFixosMap.get(a.id) || 9999;
                            const numeroB = numerosFixosMap.get(b.id) || 9999;
                            return numeroA - numeroB;
                          });

                          const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / EMBRIOES_PAGE_SIZE));
                          const paginaAtual = Math.min(embrioesPage, totalPaginas);
                          const inicio = (paginaAtual - 1) * EMBRIOES_PAGE_SIZE;
                          const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + EMBRIOES_PAGE_SIZE);

                          return embrioesPagina.map((embriao) => {
                            // Usar número fixo do mapa para rastreabilidade
                            const numeroFixo = numerosFixosMap.get(embriao.id) || 0;
                            
                            return (
                            <TableRow
                              key={embriao.id}
                              className={formData.embriao_id === embriao.id ? 'bg-green-50' : 'cursor-pointer hover:bg-slate-50'}
                              onClick={() => setFormData({ ...formData, embriao_id: embriao.id })}
                            >
                              <TableCell>
                                <input
                                  type="radio"
                                  name="embriao"
                                  value={embriao.id}
                                  checked={formData.embriao_id === embriao.id}
                                  onChange={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                  className="w-4 h-4"
                                />
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                  {numeroFixo}
                              </TableCell>
                              <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                              <TableCell>{embriao.touro_nome || '-'}</TableCell>
                              <TableCell>
                                {embriao.classificacao ? (
                                  <Badge variant="outline">{embriao.classificacao}</Badge>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={embriao.status_atual} />
                              </TableCell>
                              <TableCell>
                                {embriao.d8_limite ? (
                                  <Badge variant="destructive">D8</Badge>
                                ) : embriao.d7_pronto ? (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    D7
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                      <div>
                        {embrioesDisponiveis.length} embrião(ões) disponíveis
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEmbrioesPage(Math.max(1, embrioesPage - 1));
                          }}
                          disabled={embrioesPage === 1}
                        >
                          Anterior
                        </Button>
                        <span>
                          Página {Math.min(embrioesPage, Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE)))} de {Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE))}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const totalPaginas = Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE));
                            setEmbrioesPage(Math.min(totalPaginas, embrioesPage + 1));
                          }}
                          disabled={embrioesPage >= Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE))}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Embriões - Congelados */}
            {origemEmbriao === 'CONGELADO' && (
              <div className="space-y-4">
                <Label>7. Selecionar Embrião Congelado *</Label>
                <div className="border rounded-lg p-4">
                  {(!filtroClienteId && !filtroRaca.trim()) && (
                    <div className="text-sm text-slate-500">
                      Selecione um cliente ou informe a raça para listar embriões congelados.
                    </div>
                  )}
                  {loadingCongelados && (
                    <div className="text-sm text-slate-500">
                      Carregando embriões congelados...
                    </div>
                  )}
                  {!loadingCongelados && embrioesCongelados.length === 0 && (filtroClienteId || filtroRaca.trim()) && (
                    <div className="text-sm text-slate-500">
                      Nenhum embrião congelado encontrado para os filtros aplicados.
                    </div>
                  )}
                  {!loadingCongelados && embrioesCongelados.length > 0 && (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Doadora</TableHead>
                            <TableHead>Touro</TableHead>
                            <TableHead>Classificação</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const ordenados = [...embrioesCongelados].sort((a, b) => {
                              const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
                              const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
                              return dataB - dataA;
                            });
                            const totalPaginas = Math.max(1, Math.ceil(ordenados.length / EMBRIOES_PAGE_SIZE));
                            const paginaAtual = Math.min(embrioesPage, totalPaginas);
                            const inicio = (paginaAtual - 1) * EMBRIOES_PAGE_SIZE;
                            const embrioesPagina = ordenados.slice(inicio, inicio + EMBRIOES_PAGE_SIZE);

                            return embrioesPagina.map((embriao) => {
                              return (
                                <TableRow
                                  key={embriao.id}
                                  className={formData.embriao_id === embriao.id ? 'bg-green-50' : 'cursor-pointer hover:bg-slate-50'}
                                  onClick={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                >
                                  <TableCell>
                                    <input
                                      type="radio"
                                      name="embriao"
                                      value={embriao.id}
                                      checked={formData.embriao_id === embriao.id}
                                      onChange={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                      className="w-4 h-4"
                                    />
                                  </TableCell>
                                  <TableCell>{embriao.cliente_nome || '-'}</TableCell>
                                  <TableCell>
                                    {embriao.doadora_registro
                                      ? `${embriao.doadora_registro} - ${embriao.doadora_raca || '-'}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {embriao.touro_nome
                                      ? `${embriao.touro_nome} - ${embriao.touro_raca || '-'}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {embriao.classificacao ? (
                                      <Badge variant="outline">{embriao.classificacao}</Badge>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={embriao.status_atual} />
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <div>
                          {embrioesCongelados.length} embrião(ões) disponíveis
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEmbrioesPage(Math.max(1, embrioesPage - 1));
                            }}
                            disabled={embrioesPage === 1}
                          >
                            Anterior
                          </Button>
                          <span>
                            Página {Math.min(embrioesPage, Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE)))} de {Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE))}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const totalPaginas = Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE));
                              setEmbrioesPage(Math.min(totalPaginas, embrioesPage + 1));
                            }}
                            disabled={embrioesPage >= Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE))}
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Campo de Observações */}
            {formData.embriao_id && formData.receptora_id && (
              <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre a transferência"
                    rows={3}
                  />
                      </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Dialog do Relatório */}
      <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatório da Sessão de Transferência de Embriões
            </DialogTitle>
            <DialogDescription>
              Fazenda: {fazendas.find(f => f.id === formData.fazenda_id)?.nome || 'N/A'} | 
              Data da TE: {formData.data_te ? formatDate(formData.data_te) : 'N/A'} | 
              Total: {relatorioData.length} transferência(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Veterinário Responsável:</strong> {formData.veterinario_responsavel || 'N/A'}
                  </div>
              <div>
                <strong>Técnico Responsável:</strong> {formData.tecnico_responsavel || 'N/A'}
                </div>
                  </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Nº Embrião</TableHead>
                    <TableHead>Doadora</TableHead>
                    <TableHead>Touro</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Receptora (Brinco)</TableHead>
                    <TableHead>Receptora (Nome)</TableHead>
                    <TableHead>Data TE</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorioData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-semibold">{item.numero_embriao}</TableCell>
                      <TableCell>{item.doadora}</TableCell>
                      <TableCell>{item.touro}</TableCell>
                      <TableCell>{item.classificacao}</TableCell>
                      <TableCell className="font-semibold">{item.receptora_brinco}</TableCell>
                      <TableCell>{item.receptora_nome}</TableCell>
                      <TableCell>{item.data_te ? formatDate(item.data_te) : 'N/A'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{item.observacoes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                  </div>
                </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRelatorioDialog(false);
                setIsVisualizacaoApenas(false);
              }}
            >
              Fechar
            </Button>
            {!isVisualizacaoApenas && (
              <Button
                type="button"
                onClick={async () => {
                  setShowRelatorioDialog(false);
                  setIsVisualizacaoApenas(false);
                  await handleEncerrarSessao();
                }}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Encerrando...' : 'Confirmar e Encerrar Sessão'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





